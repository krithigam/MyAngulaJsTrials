/**
 * @license TruCode Encoder Essentials 3.1.0.363 Copyright (c) 2013 TruCode, LLC
 * This file contains works from other authors. See the included license-agreements
 * folder that is distributed alongside this file.
 * See https://wsstage.trucode.com/help for more information
 */

(function() {
/**
 * almond 0.2.4 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("vendor/require/almond", function(){});

//     Underscore.js 1.4.4
//     http://underscorejs.org
//     (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
//     Underscore may be freely distributed under the MIT license.

(function () {

    // Baseline setup
    // --------------

    // Establish the root object, `window` in the browser, or `global` on the server.
    var root = this;

    // Save the previous value of the `_` variable.
    var previousUnderscore = root._;

    // Establish the object that gets returned to break out of a loop iteration.
    var breaker = {};

    // Save bytes in the minified (but not gzipped) version:
    var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

    // Create quick reference variables for speed access to core prototypes.
    var push = ArrayProto.push,
        slice = ArrayProto.slice,
        concat = ArrayProto.concat,
        toString = ObjProto.toString,
        hasOwnProperty = ObjProto.hasOwnProperty;

    // All **ECMAScript 5** native function implementations that we hope to use
    // are declared here.
    var
      nativeForEach = ArrayProto.forEach,
      nativeMap = ArrayProto.map,
      nativeReduce = ArrayProto.reduce,
      nativeReduceRight = ArrayProto.reduceRight,
      nativeFilter = ArrayProto.filter,
      nativeEvery = ArrayProto.every,
      nativeSome = ArrayProto.some,
      nativeIndexOf = ArrayProto.indexOf,
      nativeLastIndexOf = ArrayProto.lastIndexOf,
      nativeIsArray = Array.isArray,
      nativeKeys = Object.keys,
      nativeBind = FuncProto.bind;

    // Create a safe reference to the Underscore object for use below.
    var _ = function (obj) {
        if (obj instanceof _) return obj;
        if (!(this instanceof _)) return new _(obj);
        this._wrapped = obj;
    };

    // Export the Underscore object for **Node.js**, with
    // backwards-compatibility for the old `require()` API. If we're in
    // the browser, add `_` as a global object via a string identifier,
    // for Closure Compiler "advanced" mode.
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = _;
        }
        exports._ = _;
    } else {
        // do not export into global namespace
        // root['_'] = _;
    }

    // Current version.
    _.VERSION = '1.4.4';

    // Collection Functions
    // --------------------

    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles objects with the built-in `forEach`, arrays, and raw objects.
    // Delegates to **ECMAScript 5**'s native `forEach` if available.
    var each = _.each = _.forEach = function (obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
            obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
            for (var i = 0, l = obj.length; i < l; i++) {
                if (iterator.call(context, obj[i], i, obj) === breaker) return;
            }
        } else {
            for (var key in obj) {
                if (_.has(obj, key)) {
                    if (iterator.call(context, obj[key], key, obj) === breaker) return;
                }
            }
        }
    };

    // Return the results of applying the iterator to each element.
    // Delegates to **ECMAScript 5**'s native `map` if available.
    _.map = _.collect = function (obj, iterator, context) {
        var results = [];
        if (obj == null) return results;
        if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
        each(obj, function (value, index, list) {
            results[results.length] = iterator.call(context, value, index, list);
        });
        return results;
    };

    var reduceError = 'Reduce of empty array with no initial value';

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
    _.reduce = _.foldl = _.inject = function (obj, iterator, memo, context) {
        var initial = arguments.length > 2;
        if (obj == null) obj = [];
        if (nativeReduce && obj.reduce === nativeReduce) {
            if (context) iterator = _.bind(iterator, context);
            return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
        }
        each(obj, function (value, index, list) {
            if (!initial) {
                memo = value;
                initial = true;
            } else {
                memo = iterator.call(context, memo, value, index, list);
            }
        });
        if (!initial) throw new TypeError(reduceError);
        return memo;
    };

    // The right-associative version of reduce, also known as `foldr`.
    // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
    _.reduceRight = _.foldr = function (obj, iterator, memo, context) {
        var initial = arguments.length > 2;
        if (obj == null) obj = [];
        if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
            if (context) iterator = _.bind(iterator, context);
            return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
        }
        var length = obj.length;
        if (length !== +length) {
            var keys = _.keys(obj);
            length = keys.length;
        }
        each(obj, function (value, index, list) {
            index = keys ? keys[--length] : --length;
            if (!initial) {
                memo = obj[index];
                initial = true;
            } else {
                memo = iterator.call(context, memo, obj[index], index, list);
            }
        });
        if (!initial) throw new TypeError(reduceError);
        return memo;
    };

    // Return the first value which passes a truth test. Aliased as `detect`.
    _.find = _.detect = function (obj, iterator, context) {
        var result;
        any(obj, function (value, index, list) {
            if (iterator.call(context, value, index, list)) {
                result = value;
                return true;
            }
        });
        return result;
    };

    // Return all the elements that pass a truth test.
    // Delegates to **ECMAScript 5**'s native `filter` if available.
    // Aliased as `select`.
    _.filter = _.select = function (obj, iterator, context) {
        var results = [];
        if (obj == null) return results;
        if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
        each(obj, function (value, index, list) {
            if (iterator.call(context, value, index, list)) results[results.length] = value;
        });
        return results;
    };

    // Return all the elements for which a truth test fails.
    _.reject = function (obj, iterator, context) {
        return _.filter(obj, function (value, index, list) {
            return !iterator.call(context, value, index, list);
        }, context);
    };

    // Determine whether all of the elements match a truth test.
    // Delegates to **ECMAScript 5**'s native `every` if available.
    // Aliased as `all`.
    _.every = _.all = function (obj, iterator, context) {
        iterator || (iterator = _.identity);
        var result = true;
        if (obj == null) return result;
        if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
        each(obj, function (value, index, list) {
            if (!(result = result && iterator.call(context, value, index, list))) return breaker;
        });
        return !!result;
    };

    // Determine if at least one element in the object matches a truth test.
    // Delegates to **ECMAScript 5**'s native `some` if available.
    // Aliased as `any`.
    var any = _.some = _.any = function (obj, iterator, context) {
        iterator || (iterator = _.identity);
        var result = false;
        if (obj == null) return result;
        if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
        each(obj, function (value, index, list) {
            if (result || (result = iterator.call(context, value, index, list))) return breaker;
        });
        return !!result;
    };

    // Determine if the array or object contains a given value (using `===`).
    // Aliased as `include`.
    _.contains = _.include = function (obj, target) {
        if (obj == null) return false;
        if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
        return any(obj, function (value) {
            return value === target;
        });
    };

    // Invoke a method (with arguments) on every item in a collection.
    _.invoke = function (obj, method) {
        var args = slice.call(arguments, 2);
        var isFunc = _.isFunction(method);
        return _.map(obj, function (value) {
            return (isFunc ? method : value[method]).apply(value, args);
        });
    };

    // Convenience version of a common use case of `map`: fetching a property.
    _.pluck = function (obj, key) {
        return _.map(obj, function (value) { return value[key]; });
    };

    // Convenience version of a common use case of `filter`: selecting only objects
    // containing specific `key:value` pairs.
    _.where = function (obj, attrs, first) {
        if (_.isEmpty(attrs)) return first ? null : [];
        return _[first ? 'find' : 'filter'](obj, function (value) {
            for (var key in attrs) {
                if (attrs[key] !== value[key]) return false;
            }
            return true;
        });
    };

    // Convenience version of a common use case of `find`: getting the first object
    // containing specific `key:value` pairs.
    _.findWhere = function (obj, attrs) {
        return _.where(obj, attrs, true);
    };

    // Return the maximum element or (element-based computation).
    // Can't optimize arrays of integers longer than 65,535 elements.
    // See: https://bugs.webkit.org/show_bug.cgi?id=80797
    _.max = function (obj, iterator, context) {
        if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
            return Math.max.apply(Math, obj);
        }
        if (!iterator && _.isEmpty(obj)) return -Infinity;
        var result = { computed: -Infinity, value: -Infinity };
        each(obj, function (value, index, list) {
            var computed = iterator ? iterator.call(context, value, index, list) : value;
            computed >= result.computed && (result = { value: value, computed: computed });
        });
        return result.value;
    };

    // Return the minimum element (or element-based computation).
    _.min = function (obj, iterator, context) {
        if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
            return Math.min.apply(Math, obj);
        }
        if (!iterator && _.isEmpty(obj)) return Infinity;
        var result = { computed: Infinity, value: Infinity };
        each(obj, function (value, index, list) {
            var computed = iterator ? iterator.call(context, value, index, list) : value;
            computed < result.computed && (result = { value: value, computed: computed });
        });
        return result.value;
    };

    // Shuffle an array.
    _.shuffle = function (obj) {
        var rand;
        var index = 0;
        var shuffled = [];
        each(obj, function (value) {
            rand = _.random(index++);
            shuffled[index - 1] = shuffled[rand];
            shuffled[rand] = value;
        });
        return shuffled;
    };

    // An internal function to generate lookup iterators.
    var lookupIterator = function (value) {
        return _.isFunction(value) ? value : function (obj) { return obj[value]; };
    };

    // Sort the object's values by a criterion produced by an iterator.
    _.sortBy = function (obj, value, context) {
        var iterator = lookupIterator(value);
        return _.pluck(_.map(obj, function (value, index, list) {
            return {
                value: value,
                index: index,
                criteria: iterator.call(context, value, index, list)
            };
        }).sort(function (left, right) {
            var a = left.criteria;
            var b = right.criteria;
            if (a !== b) {
                if (a > b || a === void 0) return 1;
                if (a < b || b === void 0) return -1;
            }
            return left.index < right.index ? -1 : 1;
        }), 'value');
    };

    // An internal function used for aggregate "group by" operations.
    var group = function (obj, value, context, behavior) {
        var result = {};
        var iterator = lookupIterator(value || _.identity);
        each(obj, function (value, index) {
            var key = iterator.call(context, value, index, obj);
            behavior(result, key, value);
        });
        return result;
    };

    // Groups the object's values by a criterion. Pass either a string attribute
    // to group by, or a function that returns the criterion.
    _.groupBy = function (obj, value, context) {
        return group(obj, value, context, function (result, key, value) {
            (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
        });
    };

    // Counts instances of an object that group by a certain criterion. Pass
    // either a string attribute to count by, or a function that returns the
    // criterion.
    _.countBy = function (obj, value, context) {
        return group(obj, value, context, function (result, key) {
            if (!_.has(result, key)) result[key] = 0;
            result[key]++;
        });
    };

    // Use a comparator function to figure out the smallest index at which
    // an object should be inserted so as to maintain order. Uses binary search.
    _.sortedIndex = function (array, obj, iterator, context) {
        iterator = iterator == null ? _.identity : lookupIterator(iterator);
        var value = iterator.call(context, obj);
        var low = 0, high = array.length;
        while (low < high) {
            var mid = (low + high) >>> 1;
            iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
        }
        return low;
    };

    // Safely convert anything iterable into a real, live array.
    _.toArray = function (obj) {
        if (!obj) return [];
        if (_.isArray(obj)) return slice.call(obj);
        if (obj.length === +obj.length) return _.map(obj, _.identity);
        return _.values(obj);
    };

    // Return the number of elements in an object.
    _.size = function (obj) {
        if (obj == null) return 0;
        return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
    };

    // Array Functions
    // ---------------

    // Get the first element of an array. Passing **n** will return the first N
    // values in the array. Aliased as `head` and `take`. The **guard** check
    // allows it to work with `_.map`.
    _.first = _.head = _.take = function (array, n, guard) {
        if (array == null) return void 0;
        return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
    };

    // Returns everything but the last entry of the array. Especially useful on
    // the arguments object. Passing **n** will return all the values in
    // the array, excluding the last N. The **guard** check allows it to work with
    // `_.map`.
    _.initial = function (array, n, guard) {
        return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
    };

    // Get the last element of an array. Passing **n** will return the last N
    // values in the array. The **guard** check allows it to work with `_.map`.
    _.last = function (array, n, guard) {
        if (array == null) return void 0;
        if ((n != null) && !guard) {
            return slice.call(array, Math.max(array.length - n, 0));
        } else {
            return array[array.length - 1];
        }
    };

    // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
    // Especially useful on the arguments object. Passing an **n** will return
    // the rest N values in the array. The **guard**
    // check allows it to work with `_.map`.
    _.rest = _.tail = _.drop = function (array, n, guard) {
        return slice.call(array, (n == null) || guard ? 1 : n);
    };

    // Trim out all falsy values from an array.
    _.compact = function (array) {
        return _.filter(array, _.identity);
    };

    // Internal implementation of a recursive `flatten` function.
    var flatten = function (input, shallow, output) {
        each(input, function (value) {
            if (_.isArray(value)) {
                shallow ? push.apply(output, value) : flatten(value, shallow, output);
            } else {
                output.push(value);
            }
        });
        return output;
    };

    // Return a completely flattened version of an array.
    _.flatten = function (array, shallow) {
        return flatten(array, shallow, []);
    };

    // Return a version of the array that does not contain the specified value(s).
    _.without = function (array) {
        return _.difference(array, slice.call(arguments, 1));
    };

    // Produce a duplicate-free version of the array. If the array has already
    // been sorted, you have the option of using a faster algorithm.
    // Aliased as `unique`.
    _.uniq = _.unique = function (array, isSorted, iterator, context) {
        if (_.isFunction(isSorted)) {
            context = iterator;
            iterator = isSorted;
            isSorted = false;
        }
        var initial = iterator ? _.map(array, iterator, context) : array;
        var results = [];
        var seen = [];
        each(initial, function (value, index) {
            if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
                seen.push(value);
                results.push(array[index]);
            }
        });
        return results;
    };

    // Produce an array that contains the union: each distinct element from all of
    // the passed-in arrays.
    _.union = function () {
        return _.uniq(concat.apply(ArrayProto, arguments));
    };

    // Produce an array that contains every item shared between all the
    // passed-in arrays.
    _.intersection = function (array) {
        var rest = slice.call(arguments, 1);
        return _.filter(_.uniq(array), function (item) {
            return _.every(rest, function (other) {
                return _.indexOf(other, item) >= 0;
            });
        });
    };

    // Take the difference between one array and a number of other arrays.
    // Only the elements present in just the first array will remain.
    _.difference = function (array) {
        var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
        return _.filter(array, function (value) { return !_.contains(rest, value); });
    };

    // Zip together multiple lists into a single array -- elements that share
    // an index go together.
    _.zip = function () {
        var args = slice.call(arguments);
        var length = _.max(_.pluck(args, 'length'));
        var results = new Array(length);
        for (var i = 0; i < length; i++) {
            results[i] = _.pluck(args, "" + i);
        }
        return results;
    };

    // Converts lists into objects. Pass either a single array of `[key, value]`
    // pairs, or two parallel arrays of the same length -- one of keys, and one of
    // the corresponding values.
    _.object = function (list, values) {
        if (list == null) return {};
        var result = {};
        for (var i = 0, l = list.length; i < l; i++) {
            if (values) {
                result[list[i]] = values[i];
            } else {
                result[list[i][0]] = list[i][1];
            }
        }
        return result;
    };

    // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
    // we need this function. Return the position of the first occurrence of an
    // item in an array, or -1 if the item is not included in the array.
    // Delegates to **ECMAScript 5**'s native `indexOf` if available.
    // If the array is large and already in sort order, pass `true`
    // for **isSorted** to use binary search.
    _.indexOf = function (array, item, isSorted) {
        if (array == null) return -1;
        var i = 0, l = array.length;
        if (isSorted) {
            if (typeof isSorted == 'number') {
                i = (isSorted < 0 ? Math.max(0, l + isSorted) : isSorted);
            } else {
                i = _.sortedIndex(array, item);
                return array[i] === item ? i : -1;
            }
        }
        if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
        for (; i < l; i++) if (array[i] === item) return i;
        return -1;
    };

    // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
    _.lastIndexOf = function (array, item, from) {
        if (array == null) return -1;
        var hasIndex = from != null;
        if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
            return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
        }
        var i = (hasIndex ? from : array.length);
        while (i--) if (array[i] === item) return i;
        return -1;
    };

    // Generate an integer Array containing an arithmetic progression. A port of
    // the native Python `range()` function. See
    // [the Python documentation](http://docs.python.org/library/functions.html#range).
    _.range = function (start, stop, step) {
        if (arguments.length <= 1) {
            stop = start || 0;
            start = 0;
        }
        step = arguments[2] || 1;

        var len = Math.max(Math.ceil((stop - start) / step), 0);
        var idx = 0;
        var range = new Array(len);

        while (idx < len) {
            range[idx++] = start;
            start += step;
        }

        return range;
    };

    // Function (ahem) Functions
    // ------------------

    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    _.bind = function (func, context) {
        if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
        var args = slice.call(arguments, 2);
        return function () {
            return func.apply(context, args.concat(slice.call(arguments)));
        };
    };

    // Partially apply a function by creating a version that has had some of its
    // arguments pre-filled, without changing its dynamic `this` context.
    _.partial = function (func) {
        var args = slice.call(arguments, 1);
        return function () {
            return func.apply(this, args.concat(slice.call(arguments)));
        };
    };

    // Bind all of an object's methods to that object. Useful for ensuring that
    // all callbacks defined on an object belong to it.
    _.bindAll = function (obj) {
        var funcs = slice.call(arguments, 1);
        if (funcs.length === 0) funcs = _.functions(obj);
        each(funcs, function (f) { obj[f] = _.bind(obj[f], obj); });
        return obj;
    };

    // Memoize an expensive function by storing its results.
    _.memoize = function (func, hasher) {
        var memo = {};
        hasher || (hasher = _.identity);
        return function () {
            var key = hasher.apply(this, arguments);
            return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
        };
    };

    // Delays a function for the given number of milliseconds, and then calls
    // it with the arguments supplied.
    _.delay = function (func, wait) {
        var args = slice.call(arguments, 2);
        return setTimeout(function () { return func.apply(null, args); }, wait);
    };

    // Defers a function, scheduling it to run after the current call stack has
    // cleared.
    _.defer = function (func) {
        return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
    };

    // Returns a function, that, when invoked, will only be triggered at most once
    // during a given window of time.
    _.throttle = function (func, wait) {
        var context, args, timeout, result;
        var previous = 0;
        var later = function () {
            previous = new Date;
            timeout = null;
            result = func.apply(context, args);
        };
        return function () {
            var now = new Date;
            var remaining = wait - (now - previous);
            context = this;
            args = arguments;
            if (remaining <= 0) {
                clearTimeout(timeout);
                timeout = null;
                previous = now;
                result = func.apply(context, args);
            } else if (!timeout) {
                timeout = setTimeout(later, remaining);
            }
            return result;
        };
    };

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    _.debounce = function (func, wait, immediate) {
        var timeout, result;
        return function () {
            var context = this, args = arguments;
            var later = function () {
                timeout = null;
                if (!immediate) result = func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) result = func.apply(context, args);
            return result;
        };
    };

    // Returns a function that will be executed at most one time, no matter how
    // often you call it. Useful for lazy initialization.
    _.once = function (func) {
        var ran = false, memo;
        return function () {
            if (ran) return memo;
            ran = true;
            memo = func.apply(this, arguments);
            func = null;
            return memo;
        };
    };

    // Returns the first function passed as an argument to the second,
    // allowing you to adjust arguments, run code before and after, and
    // conditionally execute the original function.
    _.wrap = function (func, wrapper) {
        return function () {
            var args = [func];
            push.apply(args, arguments);
            return wrapper.apply(this, args);
        };
    };

    // Returns a function that is the composition of a list of functions, each
    // consuming the return value of the function that follows.
    _.compose = function () {
        var funcs = arguments;
        return function () {
            var args = arguments;
            for (var i = funcs.length - 1; i >= 0; i--) {
                args = [funcs[i].apply(this, args)];
            }
            return args[0];
        };
    };

    // Returns a function that will only be executed after being called N times.
    _.after = function (times, func) {
        if (times <= 0) return func();
        return function () {
            if (--times < 1) {
                return func.apply(this, arguments);
            }
        };
    };

    // Object Functions
    // ----------------

    // Retrieve the names of an object's properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`
    _.keys = nativeKeys || function (obj) {
        if (obj !== Object(obj)) throw new TypeError('Invalid object');
        var keys = [];
        for (var key in obj) if (_.has(obj, key)) keys[keys.length] = key;
        return keys;
    };

    // Retrieve the values of an object's properties.
    _.values = function (obj) {
        var values = [];
        for (var key in obj) if (_.has(obj, key)) values.push(obj[key]);
        return values;
    };

    // Convert an object into a list of `[key, value]` pairs.
    _.pairs = function (obj) {
        var pairs = [];
        for (var key in obj) if (_.has(obj, key)) pairs.push([key, obj[key]]);
        return pairs;
    };

    // Invert the keys and values of an object. The values must be serializable.
    _.invert = function (obj) {
        var result = {};
        for (var key in obj) if (_.has(obj, key)) result[obj[key]] = key;
        return result;
    };

    // Return a sorted list of the function names available on the object.
    // Aliased as `methods`
    _.functions = _.methods = function (obj) {
        var names = [];
        for (var key in obj) {
            if (_.isFunction(obj[key])) names.push(key);
        }
        return names.sort();
    };

    // Extend a given object with all the properties in passed-in object(s).
    _.extend = function (obj) {
        each(slice.call(arguments, 1), function (source) {
            if (source) {
                for (var prop in source) {
                    obj[prop] = source[prop];
                }
            }
        });
        return obj;
    };

    // Return a copy of the object only containing the whitelisted properties.
    _.pick = function (obj) {
        var copy = {};
        var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
        each(keys, function (key) {
            if (key in obj) copy[key] = obj[key];
        });
        return copy;
    };

    // Return a copy of the object without the blacklisted properties.
    _.omit = function (obj) {
        var copy = {};
        var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
        for (var key in obj) {
            if (!_.contains(keys, key)) copy[key] = obj[key];
        }
        return copy;
    };

    // Fill in a given object with default properties.
    _.defaults = function (obj) {
        each(slice.call(arguments, 1), function (source) {
            if (source) {
                for (var prop in source) {
                    if (obj[prop] == null) obj[prop] = source[prop];
                }
            }
        });
        return obj;
    };

    // Create a (shallow-cloned) duplicate of an object.
    _.clone = function (obj) {
        if (!_.isObject(obj)) return obj;
        return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
    };

    // Invokes interceptor with the obj, and then returns obj.
    // The primary purpose of this method is to "tap into" a method chain, in
    // order to perform operations on intermediate results within the chain.
    _.tap = function (obj, interceptor) {
        interceptor(obj);
        return obj;
    };

    // Internal recursive comparison function for `isEqual`.
    var eq = function (a, b, aStack, bStack) {
        // Identical objects are equal. `0 === -0`, but they aren't identical.
        // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
        if (a === b) return a !== 0 || 1 / a == 1 / b;
        // A strict comparison is necessary because `null == undefined`.
        if (a == null || b == null) return a === b;
        // Unwrap any wrapped objects.
        if (a instanceof _) a = a._wrapped;
        if (b instanceof _) b = b._wrapped;
        // Compare `[[Class]]` names.
        var className = toString.call(a);
        if (className != toString.call(b)) return false;
        switch (className) {
            // Strings, numbers, dates, and booleans are compared by value.
            case '[object String]':
                // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
                // equivalent to `new String("5")`.
                return a == String(b);
            case '[object Number]':
                // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
                // other numeric values.
                return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
            case '[object Date]':
            case '[object Boolean]':
                // Coerce dates and booleans to numeric primitive values. Dates are compared by their
                // millisecond representations. Note that invalid dates with millisecond representations
                // of `NaN` are not equivalent.
                return +a == +b;
                // RegExps are compared by their source patterns and flags.
            case '[object RegExp]':
                return a.source == b.source &&
                       a.global == b.global &&
                       a.multiline == b.multiline &&
                       a.ignoreCase == b.ignoreCase;
        }
        if (typeof a != 'object' || typeof b != 'object') return false;
        // Assume equality for cyclic structures. The algorithm for detecting cyclic
        // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
        var length = aStack.length;
        while (length--) {
            // Linear search. Performance is inversely proportional to the number of
            // unique nested structures.
            if (aStack[length] == a) return bStack[length] == b;
        }
        // Add the first object to the stack of traversed objects.
        aStack.push(a);
        bStack.push(b);
        var size = 0, result = true;
        // Recursively compare objects and arrays.
        if (className == '[object Array]') {
            // Compare array lengths to determine if a deep comparison is necessary.
            size = a.length;
            result = size == b.length;
            if (result) {
                // Deep compare the contents, ignoring non-numeric properties.
                while (size--) {
                    if (!(result = eq(a[size], b[size], aStack, bStack))) break;
                }
            }
        } else {
            // Objects with different constructors are not equivalent, but `Object`s
            // from different frames are.
            var aCtor = a.constructor, bCtor = b.constructor;
            if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                                     _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
                return false;
            }
            // Deep compare objects.
            for (var key in a) {
                if (_.has(a, key)) {
                    // Count the expected number of properties.
                    size++;
                    // Deep compare each member.
                    if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
                }
            }
            // Ensure that both objects contain the same number of properties.
            if (result) {
                for (key in b) {
                    if (_.has(b, key) && !(size--)) break;
                }
                result = !size;
            }
        }
        // Remove the first object from the stack of traversed objects.
        aStack.pop();
        bStack.pop();
        return result;
    };

    // Perform a deep comparison to check if two objects are equal.
    _.isEqual = function (a, b) {
        return eq(a, b, [], []);
    };

    // Is a given array, string, or object empty?
    // An "empty" object has no enumerable own-properties.
    _.isEmpty = function (obj) {
        if (obj == null) return true;
        if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
        for (var key in obj) if (_.has(obj, key)) return false;
        return true;
    };

    // Is a given value a DOM element?
    _.isElement = function (obj) {
        return !!(obj && obj.nodeType === 1);
    };

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    _.isArray = nativeIsArray || function (obj) {
        return toString.call(obj) == '[object Array]';
    };

    // Is a given variable an object?
    _.isObject = function (obj) {
        return obj === Object(obj);
    };

    // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
    each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function (name) {
        _['is' + name] = function (obj) {
            return toString.call(obj) == '[object ' + name + ']';
        };
    });

    // Define a fallback version of the method in browsers (ahem, IE), where
    // there isn't any inspectable "Arguments" type.
    if (!_.isArguments(arguments)) {
        _.isArguments = function (obj) {
            return !!(obj && _.has(obj, 'callee'));
        };
    }

    // Optimize `isFunction` if appropriate.
    if (typeof (/./) !== 'function') {
        _.isFunction = function (obj) {
            return typeof obj === 'function';
        };
    }

    // Is a given object a finite number?
    _.isFinite = function (obj) {
        return isFinite(obj) && !isNaN(parseFloat(obj));
    };

    // Is the given value `NaN`? (NaN is the only number which does not equal itself).
    _.isNaN = function (obj) {
        return _.isNumber(obj) && obj != +obj;
    };

    // Is a given value a boolean?
    _.isBoolean = function (obj) {
        return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
    };

    // Is a given value equal to null?
    _.isNull = function (obj) {
        return obj === null;
    };

    // Is a given variable undefined?
    _.isUndefined = function (obj) {
        return obj === void 0;
    };

    // Shortcut function for checking if an object has a given property directly
    // on itself (in other words, not on a prototype).
    _.has = function (obj, key) {
        return hasOwnProperty.call(obj, key);
    };

    // Utility Functions
    // -----------------

    // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
    // previous owner. Returns a reference to the Underscore object.
    _.noConflict = function () {
        root._ = previousUnderscore;
        return this;
    };

    // Keep the identity function around for default iterators.
    _.identity = function (value) {
        return value;
    };

    // Run a function **n** times.
    _.times = function (n, iterator, context) {
        var accum = Array(n);
        for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
        return accum;
    };

    // Return a random integer between min and max (inclusive).
    _.random = function (min, max) {
        if (max == null) {
            max = min;
            min = 0;
        }
        return min + Math.floor(Math.random() * (max - min + 1));
    };

    // List of HTML entities for escaping.
    var entityMap = {
        escape: {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        }
    };
    entityMap.unescape = _.invert(entityMap.escape);

    // Regexes containing the keys and values listed immediately above.
    var entityRegexes = {
        escape: new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
        unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
    };

    // Functions for escaping and unescaping strings to/from HTML interpolation.
    _.each(['escape', 'unescape'], function (method) {
        _[method] = function (string) {
            if (string == null) return '';
            return ('' + string).replace(entityRegexes[method], function (match) {
                return entityMap[method][match];
            });
        };
    });

    // If the value of the named property is a function then invoke it;
    // otherwise, return it.
    _.result = function (object, property) {
        if (object == null) return null;
        var value = object[property];
        return _.isFunction(value) ? value.call(object) : value;
    };

    // Add your own custom functions to the Underscore object.
    _.mixin = function (obj) {
        each(_.functions(obj), function (name) {
            var func = _[name] = obj[name];
            _.prototype[name] = function () {
                var args = [this._wrapped];
                push.apply(args, arguments);
                return result.call(this, func.apply(_, args));
            };
        });
    };

    // Generate a unique integer id (unique within the entire client session).
    // Useful for temporary DOM ids.
    var idCounter = 0;
    _.uniqueId = function (prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
    };

    // By default, Underscore uses ERB-style template delimiters, change the
    // following template settings to use alternative delimiters.
    _.templateSettings = {
        evaluate: /<%([\s\S]+?)%>/g,
        interpolate: /<%=([\s\S]+?)%>/g,
        escape: /<%-([\s\S]+?)%>/g
    };

    // When customizing `templateSettings`, if you don't want to define an
    // interpolation, evaluation or escaping regex, we need one that is
    // guaranteed not to match.
    var noMatch = /(.)^/;

    // Certain characters need to be escaped so that they can be put into a
    // string literal.
    var escapes = {
        "'": "'",
        '\\': '\\',
        '\r': 'r',
        '\n': 'n',
        '\t': 't',
        '\u2028': 'u2028',
        '\u2029': 'u2029'
    };

    var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

    // JavaScript micro-templating, similar to John Resig's implementation.
    // Underscore templating handles arbitrary delimiters, preserves whitespace,
    // and correctly escapes quotes within interpolated code.
    _.template = function (text, data, settings) {
        var render;
        settings = _.defaults({}, settings, _.templateSettings);

        // Combine delimiters into one regular expression via alternation.
        var matcher = new RegExp([
          (settings.escape || noMatch).source,
          (settings.interpolate || noMatch).source,
          (settings.evaluate || noMatch).source
        ].join('|') + '|$', 'g');

        // Compile the template source, escaping string literals appropriately.
        var index = 0;
        var source = "__p+='";
        text.replace(matcher, function (match, escape, interpolate, evaluate, offset) {
            source += text.slice(index, offset)
              .replace(escaper, function (match) { return '\\' + escapes[match]; });

            if (escape) {
                source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
            }
            if (interpolate) {
                source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
            }
            if (evaluate) {
                source += "';\n" + evaluate + "\n__p+='";
            }
            index = offset + match.length;
            return match;
        });
        source += "';\n";

        // If a variable is not specified, place data values in local scope.
        if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

        source = "var __t,__p='',__j=Array.prototype.join," +
          "print=function(){__p+=__j.call(arguments,'');};\n" +
          source + "return __p;\n";

        try {
            render = new Function(settings.variable || 'obj', '_', source);
        } catch (e) {
            e.source = source;
            throw e;
        }

        if (data) return render(data, _);
        var template = function (data) {
            return render.call(this, data, _);
        };

        // Provide the compiled function source as a convenience for precompilation.
        template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

        return template;
    };

    // Add a "chain" function, which will delegate to the wrapper.
    _.chain = function (obj) {
        return _(obj).chain();
    };

    // OOP
    // ---------------
    // If Underscore is called as a function, it returns a wrapped object that
    // can be used OO-style. This wrapper holds altered versions of all the
    // underscore functions. Wrapped objects may be chained.

    // Helper function to continue chaining intermediate results.
    var result = function (obj) {
        return this._chain ? _(obj).chain() : obj;
    };

    // Add all of the Underscore functions to the wrapper object.
    _.mixin(_);

    // Add all mutator Array functions to the wrapper.
    each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function (name) {
        var method = ArrayProto[name];
        _.prototype[name] = function () {
            var obj = this._wrapped;
            method.apply(obj, arguments);
            if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
            return result.call(this, obj);
        };
    });

    // Add all accessor Array functions to the wrapper.
    each(['concat', 'join', 'slice'], function (name) {
        var method = ArrayProto[name];
        _.prototype[name] = function () {
            return result.call(this, method.apply(this._wrapped, arguments));
        };
    });

    _.extend(_.prototype, {

        // Start chaining a wrapped Underscore object.
        chain: function () {
            this._chain = true;
            return this;
        },

        // Extracts the result from a wrapped and chained object.
        value: function () {
            return this._wrapped;
        }

    });

    // AMD define happens at the end for compatibility with AMD loaders
    // that don't enforce next-turn semantics on modules.
    if (typeof define === 'function' && define.amd) {
        define('underscore',[], function () {
            return _;
        });
    }

}).call(this);
define('jql',[], function () {
    if (typeof DEBUG !== 'undefined' && DEBUG) { log('not subbing for jq 1.8/1.9 compat & kendoui changes...'); }
    return $;
});
//     Backbone.js 1.0.0 (modified to add AMD registration and avoid global export)

//     (c) 2010-2013 Jeremy Ashkenas, DocumentCloud Inc.
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function (root, factory) {
    // Set up Backbone appropriately for the environment.
    if (typeof exports !== 'undefined') {
        // Node/CommonJS, no need for jQuery in that case.
        factory(root, exports, require('underscore'));
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        // define(['underscore', 'jquery', 'exports'], function (_, $, exports) {
        // wrapped jquery loader
        define('Backbone',['underscore', 'jql', 'exports'], function (_, $, exports) {
            // Export global even in AMD case in case this script is loaded with
            // others that may still expect a global Backbone.

            // DO NOT export global even in AMD case
            //root.Backbone = factory(root, exports, _, $);
            factory(root, exports, _, $);
        });
    } else {
        // Browser globals
        root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
    }
}(this, function (root, Backbone, _, $) {

    // Initial Setup
    // -------------

    // Save the previous value of the `Backbone` variable, so that it can be
    // restored later on, if `noConflict` is used.
    var previousBackbone = root.Backbone;

    // Create local references to array methods we'll want to use later.
    var array = [];
    var push = array.push;
    var slice = array.slice;
    var splice = array.splice;

    // Current version of the library. Keep in sync with `package.json`.
    Backbone.VERSION = '1.0.0';

    // For Backbone's purposes, jQuery, Zepto, or Ender owns the `$` variable.
    Backbone.$ = $;

    // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
    // to its previous owner. Returns a reference to this Backbone object.
    Backbone.noConflict = function () {
        root.Backbone = previousBackbone;
        return this;
    };

    // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
    // will fake `"PUT"` and `"DELETE"` requests via the `_method` parameter and
    // set a `X-Http-Method-Override` header.
    Backbone.emulateHTTP = false;

    // Turn on `emulateJSON` to support legacy servers that can't deal with direct
    // `application/json` requests ... will encode the body as
    // `application/x-www-form-urlencoded` instead and will send the model in a
    // form param named `model`.
    Backbone.emulateJSON = false;

    // Backbone.Events
    // ---------------

    // A module that can be mixed in to *any object* in order to provide it with
    // custom events. You may bind with `on` or remove with `off` callback
    // functions to an event; `trigger`-ing an event fires all callbacks in
    // succession.
    //
    //     var object = {};
    //     _.extend(object, Backbone.Events);
    //     object.on('expand', function(){ alert('expanded'); });
    //     object.trigger('expand');
    //
    var Events = Backbone.Events = {

        // Bind an event to a `callback` function. Passing `"all"` will bind
        // the callback to all events fired.
        on: function (name, callback, context) {
            if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
            this._events || (this._events = {});
            var events = this._events[name] || (this._events[name] = []);
            events.push({ callback: callback, context: context, ctx: context || this });
            return this;
        },

        // Bind an event to only be triggered a single time. After the first time
        // the callback is invoked, it will be removed.
        once: function (name, callback, context) {
            if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
            var self = this;
            var once = _.once(function () {
                self.off(name, once);
                callback.apply(this, arguments);
            });
            once._callback = callback;
            return this.on(name, once, context);
        },

        // Remove one or many callbacks. If `context` is null, removes all
        // callbacks with that function. If `callback` is null, removes all
        // callbacks for the event. If `name` is null, removes all bound
        // callbacks for all events.
        off: function (name, callback, context) {
            var retain, ev, events, names, i, l, j, k;
            if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
            if (!name && !callback && !context) {
                this._events = {};
                return this;
            }

            names = name ? [name] : _.keys(this._events);
            for (i = 0, l = names.length; i < l; i++) {
                name = names[i];
                if (events = this._events[name]) {
                    this._events[name] = retain = [];
                    if (callback || context) {
                        for (j = 0, k = events.length; j < k; j++) {
                            ev = events[j];
                            if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                                (context && context !== ev.context)) {
                                retain.push(ev);
                            }
                        }
                    }
                    if (!retain.length) delete this._events[name];
                }
            }

            return this;
        },

        // Trigger one or many events, firing all bound callbacks. Callbacks are
        // passed the same arguments as `trigger` is, apart from the event name
        // (unless you're listening on `"all"`, which will cause your callback to
        // receive the true name of the event as the first argument).
        trigger: function (name) {
            if (!this._events) return this;
            var args = slice.call(arguments, 1);
            if (!eventsApi(this, 'trigger', name, args)) return this;
            var events = this._events[name];
            var allEvents = this._events.all;
            if (events) triggerEvents(events, args);
            if (allEvents) triggerEvents(allEvents, arguments);
            return this;
        },

        // Tell this object to stop listening to either specific events ... or
        // to every object it's currently listening to.
        stopListening: function (obj, name, callback) {
            var listeners = this._listeners;
            if (!listeners) return this;
            var deleteListener = !name && !callback;
            if (typeof name === 'object') callback = this;
            if (obj) (listeners = {})[obj._listenerId] = obj;
            for (var id in listeners) {
                listeners[id].off(name, callback, this);
                if (deleteListener) delete this._listeners[id];
            }
            return this;
        }

    };

    // Regular expression used to split event strings.
    var eventSplitter = /\s+/;

    // Implement fancy features of the Events API such as multiple event
    // names `"change blur"` and jQuery-style event maps `{change: action}`
    // in terms of the existing API.
    var eventsApi = function (obj, action, name, rest) {
        if (!name) return true;

        // Handle event maps.
        if (typeof name === 'object') {
            for (var key in name) {
                obj[action].apply(obj, [key, name[key]].concat(rest));
            }
            return false;
        }

        // Handle space separated event names.
        if (eventSplitter.test(name)) {
            var names = name.split(eventSplitter);
            for (var i = 0, l = names.length; i < l; i++) {
                obj[action].apply(obj, [names[i]].concat(rest));
            }
            return false;
        }

        return true;
    };

    // A difficult-to-believe, but optimized internal dispatch function for
    // triggering events. Tries to keep the usual cases speedy (most internal
    // Backbone events have 3 arguments).
    var triggerEvents = function (events, args) {
        var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
        switch (args.length) {
            case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
            case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
            case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
            case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
            default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
        }
    };

    var listenMethods = { listenTo: 'on', listenToOnce: 'once' };

    // Inversion-of-control versions of `on` and `once`. Tell *this* object to
    // listen to an event in another object ... keeping track of what it's
    // listening to.
    _.each(listenMethods, function (implementation, method) {
        Events[method] = function (obj, name, callback) {
            var listeners = this._listeners || (this._listeners = {});
            var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
            listeners[id] = obj;
            if (typeof name === 'object') callback = this;
            obj[implementation](name, callback, this);
            return this;
        };
    });

    // Aliases for backwards compatibility.
    Events.bind = Events.on;
    Events.unbind = Events.off;

    // Allow the `Backbone` object to serve as a global event bus, for folks who
    // want global "pubsub" in a convenient place.
    _.extend(Backbone, Events);

    // Backbone.Model
    // --------------

    // Backbone **Models** are the basic data object in the framework --
    // frequently representing a row in a table in a database on your server.
    // A discrete chunk of data and a bunch of useful, related methods for
    // performing computations and transformations on that data.

    // Create a new model with the specified attributes. A client id (`cid`)
    // is automatically generated and assigned for you.
    var Model = Backbone.Model = function (attributes, options) {
        var defaults;
        var attrs = attributes || {};
        options || (options = {});
        this.cid = _.uniqueId('c');
        this.attributes = {};
        _.extend(this, _.pick(options, modelOptions));
        if (options.parse) attrs = this.parse(attrs, options) || {};
        if (defaults = _.result(this, 'defaults')) {
            attrs = _.defaults({}, attrs, defaults);
        }
        this.set(attrs, options);
        this.changed = {};
        this.initialize.apply(this, arguments);
    };

    // A list of options to be attached directly to the model, if provided.
    var modelOptions = ['url', 'urlRoot', 'collection'];

    // Attach all inheritable methods to the Model prototype.
    _.extend(Model.prototype, Events, {

        // A hash of attributes whose current and previous value differ.
        changed: null,

        // The value returned during the last failed validation.
        validationError: null,

        // The default name for the JSON `id` attribute is `"id"`. MongoDB and
        // CouchDB users may want to set this to `"_id"`.
        idAttribute: 'id',

        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function () { },

        // Return a copy of the model's `attributes` object.
        toJSON: function (options) {
            return _.clone(this.attributes);
        },

        // Proxy `Backbone.sync` by default -- but override this if you need
        // custom syncing semantics for *this* particular model.
        sync: function () {
            return Backbone.sync.apply(this, arguments);
        },

        // Get the value of an attribute.
        get: function (attr) {
            return this.attributes[attr];
        },

        // Get the HTML-escaped value of an attribute.
        escape: function (attr) {
            return _.escape(this.get(attr));
        },

        // Returns `true` if the attribute contains a value that is not null
        // or undefined.
        has: function (attr) {
            return this.get(attr) != null;
        },

        // Set a hash of model attributes on the object, firing `"change"`. This is
        // the core primitive operation of a model, updating the data and notifying
        // anyone who needs to know about the change in state. The heart of the beast.
        set: function (key, val, options) {
            var attr, attrs, unset, changes, silent, changing, prev, current;
            if (key == null) return this;

            // Handle both `"key", value` and `{key: value}` -style arguments.
            if (typeof key === 'object') {
                attrs = key;
                options = val;
            } else {
                (attrs = {})[key] = val;
            }

            options || (options = {});

            // Run validation.
            if (!this._validate(attrs, options)) return false;

            // Extract attributes and options.
            unset = options.unset;
            silent = options.silent;
            changes = [];
            changing = this._changing;
            this._changing = true;

            if (!changing) {
                this._previousAttributes = _.clone(this.attributes);
                this.changed = {};
            }
            current = this.attributes, prev = this._previousAttributes;

            // Check for changes of `id`.
            if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

            // For each `set` attribute, update or delete the current value.
            for (attr in attrs) {
                val = attrs[attr];
                if (!_.isEqual(current[attr], val)) changes.push(attr);
                if (!_.isEqual(prev[attr], val)) {
                    this.changed[attr] = val;
                } else {
                    delete this.changed[attr];
                }
                unset ? delete current[attr] : current[attr] = val;
            }

            // Trigger all relevant attribute changes.
            if (!silent) {
                if (changes.length) this._pending = true;
                for (var i = 0, l = changes.length; i < l; i++) {
                    this.trigger('change:' + changes[i], this, current[changes[i]], options);
                }
            }

            // You might be wondering why there's a `while` loop here. Changes can
            // be recursively nested within `"change"` events.
            if (changing) return this;
            if (!silent) {
                while (this._pending) {
                    this._pending = false;
                    this.trigger('change', this, options);
                }
            }
            this._pending = false;
            this._changing = false;
            return this;
        },

        // Remove an attribute from the model, firing `"change"`. `unset` is a noop
        // if the attribute doesn't exist.
        unset: function (attr, options) {
            return this.set(attr, void 0, _.extend({}, options, { unset: true }));
        },

        // Clear all attributes on the model, firing `"change"`.
        clear: function (options) {
            var attrs = {};
            for (var key in this.attributes) attrs[key] = void 0;
            return this.set(attrs, _.extend({}, options, { unset: true }));
        },

        // Determine if the model has changed since the last `"change"` event.
        // If you specify an attribute name, determine if that attribute has changed.
        hasChanged: function (attr) {
            if (attr == null) return !_.isEmpty(this.changed);
            return _.has(this.changed, attr);
        },

        // Return an object containing all the attributes that have changed, or
        // false if there are no changed attributes. Useful for determining what
        // parts of a view need to be updated and/or what attributes need to be
        // persisted to the server. Unset attributes will be set to undefined.
        // You can also pass an attributes object to diff against the model,
        // determining if there *would be* a change.
        changedAttributes: function (diff) {
            if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
            var val, changed = false;
            var old = this._changing ? this._previousAttributes : this.attributes;
            for (var attr in diff) {
                if (_.isEqual(old[attr], (val = diff[attr]))) continue;
                (changed || (changed = {}))[attr] = val;
            }
            return changed;
        },

        // Get the previous value of an attribute, recorded at the time the last
        // `"change"` event was fired.
        previous: function (attr) {
            if (attr == null || !this._previousAttributes) return null;
            return this._previousAttributes[attr];
        },

        // Get all of the attributes of the model at the time of the previous
        // `"change"` event.
        previousAttributes: function () {
            return _.clone(this._previousAttributes);
        },

        // Fetch the model from the server. If the server's representation of the
        // model differs from its current attributes, they will be overridden,
        // triggering a `"change"` event.
        fetch: function (options) {
            options = options ? _.clone(options) : {};
            if (options.parse === void 0) options.parse = true;
            var model = this;
            var success = options.success;
            options.success = function (resp) {
                if (!model.set(model.parse(resp, options), options)) return false;
                if (success) success(model, resp, options);
                model.trigger('sync', model, resp, options);
            };
            wrapError(this, options);
            return this.sync('read', this, options);
        },

        // Set a hash of model attributes, and sync the model to the server.
        // If the server returns an attributes hash that differs, the model's
        // state will be `set` again.
        save: function (key, val, options) {
            var attrs, method, xhr, attributes = this.attributes;

            // Handle both `"key", value` and `{key: value}` -style arguments.
            if (key == null || typeof key === 'object') {
                attrs = key;
                options = val;
            } else {
                (attrs = {})[key] = val;
            }

            // If we're not waiting and attributes exist, save acts as `set(attr).save(null, opts)`.
            if (attrs && (!options || !options.wait) && !this.set(attrs, options)) return false;

            options = _.extend({ validate: true }, options);

            // Do not persist invalid models.
            if (!this._validate(attrs, options)) return false;

            // Set temporary attributes if `{wait: true}`.
            if (attrs && options.wait) {
                this.attributes = _.extend({}, attributes, attrs);
            }

            // After a successful server-side save, the client is (optionally)
            // updated with the server-side state.
            if (options.parse === void 0) options.parse = true;
            var model = this;
            var success = options.success;
            options.success = function (resp) {
                // Ensure attributes are restored during synchronous saves.
                model.attributes = attributes;
                var serverAttrs = model.parse(resp, options);
                if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
                if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
                    return false;
                }
                if (success) success(model, resp, options);
                model.trigger('sync', model, resp, options);
            };
            wrapError(this, options);

            method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
            if (method === 'patch') options.attrs = attrs;
            xhr = this.sync(method, this, options);

            // Restore attributes.
            if (attrs && options.wait) this.attributes = attributes;

            return xhr;
        },

        // Destroy this model on the server if it was already persisted.
        // Optimistically removes the model from its collection, if it has one.
        // If `wait: true` is passed, waits for the server to respond before removal.
        destroy: function (options) {
            options = options ? _.clone(options) : {};
            var model = this;
            var success = options.success;

            var destroy = function () {
                model.trigger('destroy', model, model.collection, options);
            };

            options.success = function (resp) {
                if (options.wait || model.isNew()) destroy();
                if (success) success(model, resp, options);
                if (!model.isNew()) model.trigger('sync', model, resp, options);
            };

            if (this.isNew()) {
                options.success();
                return false;
            }
            wrapError(this, options);

            var xhr = this.sync('delete', this, options);
            if (!options.wait) destroy();
            return xhr;
        },

        // Default URL for the model's representation on the server -- if you're
        // using Backbone's restful methods, override this to change the endpoint
        // that will be called.
        url: function () {
            var base = _.result(this, 'urlRoot') || _.result(this.collection, 'url') || urlError();
            if (this.isNew()) return base;
            return base + (base.charAt(base.length - 1) === '/' ? '' : '/') + encodeURIComponent(this.id);
        },

        // **parse** converts a response into the hash of attributes to be `set` on
        // the model. The default implementation is just to pass the response along.
        parse: function (resp, options) {
            return resp;
        },

        // Create a new model with identical attributes to this one.
        clone: function () {
            return new this.constructor(this.attributes);
        },

        // A model is new if it has never been saved to the server, and lacks an id.
        isNew: function () {
            return this.id == null;
        },

        // Check if the model is currently in a valid state.
        isValid: function (options) {
            return this._validate({}, _.extend(options || {}, { validate: true }));
        },

        // Run validation against the next complete set of model attributes,
        // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
        _validate: function (attrs, options) {
            if (!options.validate || !this.validate) return true;
            attrs = _.extend({}, this.attributes, attrs);
            var error = this.validationError = this.validate(attrs, options) || null;
            if (!error) return true;
            this.trigger('invalid', this, error, _.extend(options || {}, { validationError: error }));
            return false;
        }

    });

    // Underscore methods that we want to implement on the Model.
    var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];

    // Mix in each Underscore method as a proxy to `Model#attributes`.
    _.each(modelMethods, function (method) {
        Model.prototype[method] = function () {
            var args = slice.call(arguments);
            args.unshift(this.attributes);
            return _[method].apply(_, args);
        };
    });

    // Backbone.Collection
    // -------------------

    // If models tend to represent a single row of data, a Backbone Collection is
    // more analagous to a table full of data ... or a small slice or page of that
    // table, or a collection of rows that belong together for a particular reason
    // -- all of the messages in this particular folder, all of the documents
    // belonging to this particular author, and so on. Collections maintain
    // indexes of their models, both in order, and for lookup by `id`.

    // Create a new **Collection**, perhaps to contain a specific type of `model`.
    // If a `comparator` is specified, the Collection will maintain
    // its models in sort order, as they're added and removed.
    var Collection = Backbone.Collection = function (models, options) {
        options || (options = {});
        if (options.url) this.url = options.url;
        if (options.model) this.model = options.model;
        if (options.comparator !== void 0) this.comparator = options.comparator;
        this._reset();
        this.initialize.apply(this, arguments);
        if (models) this.reset(models, _.extend({ silent: true }, options));
    };

    // Default options for `Collection#set`.
    var setOptions = { add: true, remove: true, merge: true };
    var addOptions = { add: true, merge: false, remove: false };

    // Define the Collection's inheritable methods.
    _.extend(Collection.prototype, Events, {

        // The default model for a collection is just a **Backbone.Model**.
        // This should be overridden in most cases.
        model: Model,

        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function () { },

        // The JSON representation of a Collection is an array of the
        // models' attributes.
        toJSON: function (options) {
            return this.map(function (model) { return model.toJSON(options); });
        },

        // Proxy `Backbone.sync` by default.
        sync: function () {
            return Backbone.sync.apply(this, arguments);
        },

        // Add a model, or list of models to the set.
        add: function (models, options) {
            return this.set(models, _.defaults(options || {}, addOptions));
        },

        // Remove a model, or a list of models from the set.
        remove: function (models, options) {
            models = _.isArray(models) ? models.slice() : [models];
            options || (options = {});
            var i, l, index, model;
            for (i = 0, l = models.length; i < l; i++) {
                model = this.get(models[i]);
                if (!model) continue;
                delete this._byId[model.id];
                delete this._byId[model.cid];
                index = this.indexOf(model);
                this.models.splice(index, 1);
                this.length--;
                if (!options.silent) {
                    options.index = index;
                    model.trigger('remove', model, this, options);
                }
                this._removeReference(model);
            }
            return this;
        },

        // Update a collection by `set`-ing a new list of models, adding new ones,
        // removing models that are no longer present, and merging models that
        // already exist in the collection, as necessary. Similar to **Model#set**,
        // the core operation for updating the data contained by the collection.
        set: function (models, options) {
            options = _.defaults(options || {}, setOptions);
            if (options.parse) models = this.parse(models, options);
            if (!_.isArray(models)) models = models ? [models] : [];
            var i, l, model, attrs, existing, sort;
            var at = options.at;
            var sortable = this.comparator && (at == null) && options.sort !== false;
            var sortAttr = _.isString(this.comparator) ? this.comparator : null;
            var toAdd = [], toRemove = [], modelMap = {};

            // Turn bare objects into model references, and prevent invalid models
            // from being added.
            for (i = 0, l = models.length; i < l; i++) {
                if (!(model = this._prepareModel(models[i], options))) continue;

                // If a duplicate is found, prevent it from being added and
                // optionally merge it into the existing model.
                if (existing = this.get(model)) {
                    if (options.remove) modelMap[existing.cid] = true;
                    if (options.merge) {
                        existing.set(model.attributes, options);
                        if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
                    }

                    // This is a new model, push it to the `toAdd` list.
                } else if (options.add) {
                    toAdd.push(model);

                    // Listen to added models' events, and index models for lookup by
                    // `id` and by `cid`.
                    model.on('all', this._onModelEvent, this);
                    this._byId[model.cid] = model;
                    if (model.id != null) this._byId[model.id] = model;
                }
            }

            // Remove nonexistent models if appropriate.
            if (options.remove) {
                for (i = 0, l = this.length; i < l; ++i) {
                    if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
                }
                if (toRemove.length) this.remove(toRemove, options);
            }

            // See if sorting is needed, update `length` and splice in new models.
            if (toAdd.length) {
                if (sortable) sort = true;
                this.length += toAdd.length;
                if (at != null) {
                    splice.apply(this.models, [at, 0].concat(toAdd));
                } else {
                    push.apply(this.models, toAdd);
                }
            }

            // Silently sort the collection if appropriate.
            if (sort) this.sort({ silent: true });

            if (options.silent) return this;

            // Trigger `add` events.
            for (i = 0, l = toAdd.length; i < l; i++) {
                (model = toAdd[i]).trigger('add', model, this, options);
            }

            // Trigger `sort` if the collection was sorted.
            if (sort) this.trigger('sort', this, options);
            return this;
        },

        // When you have more items than you want to add or remove individually,
        // you can reset the entire set with a new list of models, without firing
        // any granular `add` or `remove` events. Fires `reset` when finished.
        // Useful for bulk operations and optimizations.
        reset: function (models, options) {
            options || (options = {});
            for (var i = 0, l = this.models.length; i < l; i++) {
                this._removeReference(this.models[i]);
            }
            options.previousModels = this.models;
            this._reset();
            this.add(models, _.extend({ silent: true }, options));
            if (!options.silent) this.trigger('reset', this, options);
            return this;
        },

        // Add a model to the end of the collection.
        push: function (model, options) {
            model = this._prepareModel(model, options);
            this.add(model, _.extend({ at: this.length }, options));
            return model;
        },

        // Remove a model from the end of the collection.
        pop: function (options) {
            var model = this.at(this.length - 1);
            this.remove(model, options);
            return model;
        },

        // Add a model to the beginning of the collection.
        unshift: function (model, options) {
            model = this._prepareModel(model, options);
            this.add(model, _.extend({ at: 0 }, options));
            return model;
        },

        // Remove a model from the beginning of the collection.
        shift: function (options) {
            var model = this.at(0);
            this.remove(model, options);
            return model;
        },

        // Slice out a sub-array of models from the collection.
        slice: function (begin, end) {
            return this.models.slice(begin, end);
        },

        // Get a model from the set by id.
        get: function (obj) {
            if (obj == null) return void 0;
            return this._byId[obj.id != null ? obj.id : obj.cid || obj];
        },

        // Get the model at the given index.
        at: function (index) {
            return this.models[index];
        },

        // Return models with matching attributes. Useful for simple cases of
        // `filter`.
        where: function (attrs, first) {
            if (_.isEmpty(attrs)) return first ? void 0 : [];
            return this[first ? 'find' : 'filter'](function (model) {
                for (var key in attrs) {
                    if (attrs[key] !== model.get(key)) return false;
                }
                return true;
            });
        },

        // Return the first model with matching attributes. Useful for simple cases
        // of `find`.
        findWhere: function (attrs) {
            return this.where(attrs, true);
        },

        // Force the collection to re-sort itself. You don't need to call this under
        // normal circumstances, as the set will maintain sort order as each item
        // is added.
        sort: function (options) {
            if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
            options || (options = {});

            // Run sort based on type of `comparator`.
            if (_.isString(this.comparator) || this.comparator.length === 1) {
                this.models = this.sortBy(this.comparator, this);
            } else {
                this.models.sort(_.bind(this.comparator, this));
            }

            if (!options.silent) this.trigger('sort', this, options);
            return this;
        },

        // Figure out the smallest index at which a model should be inserted so as
        // to maintain order.
        sortedIndex: function (model, value, context) {
            value || (value = this.comparator);
            var iterator = _.isFunction(value) ? value : function (model) {
                return model.get(value);
            };
            return _.sortedIndex(this.models, model, iterator, context);
        },

        // Pluck an attribute from each model in the collection.
        pluck: function (attr) {
            return _.invoke(this.models, 'get', attr);
        },

        // Fetch the default set of models for this collection, resetting the
        // collection when they arrive. If `reset: true` is passed, the response
        // data will be passed through the `reset` method instead of `set`.
        fetch: function (options) {
            options = options ? _.clone(options) : {};
            if (options.parse === void 0) options.parse = true;
            var success = options.success;
            var collection = this;
            options.success = function (resp) {
                var method = options.reset ? 'reset' : 'set';
                collection[method](resp, options);
                if (success) success(collection, resp, options);
                collection.trigger('sync', collection, resp, options);
            };
            wrapError(this, options);
            return this.sync('read', this, options);
        },

        // Create a new instance of a model in this collection. Add the model to the
        // collection immediately, unless `wait: true` is passed, in which case we
        // wait for the server to agree.
        create: function (model, options) {
            options = options ? _.clone(options) : {};
            if (!(model = this._prepareModel(model, options))) return false;
            if (!options.wait) this.add(model, options);
            var collection = this;
            var success = options.success;
            options.success = function (resp) {
                if (options.wait) collection.add(model, options);
                if (success) success(model, resp, options);
            };
            model.save(null, options);
            return model;
        },

        // **parse** converts a response into a list of models to be added to the
        // collection. The default implementation is just to pass it through.
        parse: function (resp, options) {
            return resp;
        },

        // Create a new collection with an identical list of models as this one.
        clone: function () {
            return new this.constructor(this.models);
        },

        // Private method to reset all internal state. Called when the collection
        // is first initialized or reset.
        _reset: function () {
            this.length = 0;
            this.models = [];
            this._byId = {};
        },

        // Prepare a hash of attributes (or other model) to be added to this
        // collection.
        _prepareModel: function (attrs, options) {
            if (attrs instanceof Model) {
                if (!attrs.collection) attrs.collection = this;
                return attrs;
            }
            options || (options = {});
            options.collection = this;
            var model = new this.model(attrs, options);
            if (!model._validate(attrs, options)) {
                this.trigger('invalid', this, attrs, options);
                return false;
            }
            return model;
        },

        // Internal method to sever a model's ties to a collection.
        _removeReference: function (model) {
            if (this === model.collection) delete model.collection;
            model.off('all', this._onModelEvent, this);
        },

        // Internal method called every time a model in the set fires an event.
        // Sets need to update their indexes when models change ids. All other
        // events simply proxy through. "add" and "remove" events that originate
        // in other collections are ignored.
        _onModelEvent: function (event, model, collection, options) {
            if ((event === 'add' || event === 'remove') && collection !== this) return;
            if (event === 'destroy') this.remove(model, options);
            if (model && event === 'change:' + model.idAttribute) {
                delete this._byId[model.previous(model.idAttribute)];
                if (model.id != null) this._byId[model.id] = model;
            }
            this.trigger.apply(this, arguments);
        }

    });

    // Underscore methods that we want to implement on the Collection.
    // 90% of the core usefulness of Backbone Collections is actually implemented
    // right here:
    var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
      'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
      'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
      'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
      'tail', 'drop', 'last', 'without', 'indexOf', 'shuffle', 'lastIndexOf',
      'isEmpty', 'chain'];

    // Mix in each Underscore method as a proxy to `Collection#models`.
    _.each(methods, function (method) {
        Collection.prototype[method] = function () {
            var args = slice.call(arguments);
            args.unshift(this.models);
            return _[method].apply(_, args);
        };
    });

    // Underscore methods that take a property name as an argument.
    var attributeMethods = ['groupBy', 'countBy', 'sortBy'];

    // Use attributes instead of properties.
    _.each(attributeMethods, function (method) {
        Collection.prototype[method] = function (value, context) {
            var iterator = _.isFunction(value) ? value : function (model) {
                return model.get(value);
            };
            return _[method](this.models, iterator, context);
        };
    });

    // Backbone.View
    // -------------

    // Backbone Views are almost more convention than they are actual code. A View
    // is simply a JavaScript object that represents a logical chunk of UI in the
    // DOM. This might be a single item, an entire list, a sidebar or panel, or
    // even the surrounding frame which wraps your whole app. Defining a chunk of
    // UI as a **View** allows you to define your DOM events declaratively, without
    // having to worry about render order ... and makes it easy for the view to
    // react to specific changes in the state of your models.

    // Creating a Backbone.View creates its initial element outside of the DOM,
    // if an existing element is not provided...
    var View = Backbone.View = function (options) {
        this.cid = _.uniqueId('view');
        this._configure(options || {});
        this._ensureElement();
        this.initialize.apply(this, arguments);
        this.delegateEvents();
    };

    // Cached regex to split keys for `delegate`.
    var delegateEventSplitter = /^(\S+)\s*(.*)$/;

    // List of view options to be merged as properties.
    var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

    // Set up all inheritable **Backbone.View** properties and methods.
    _.extend(View.prototype, Events, {

        // The default `tagName` of a View's element is `"div"`.
        tagName: 'div',

        // jQuery delegate for element lookup, scoped to DOM elements within the
        // current view. This should be prefered to global lookups where possible.
        $: function (selector) {
            return this.$el.find(selector);
        },

        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function () { },

        // **render** is the core function that your view should override, in order
        // to populate its element (`this.el`), with the appropriate HTML. The
        // convention is for **render** to always return `this`.
        render: function () {
            return this;
        },

        // Remove this view by taking the element out of the DOM, and removing any
        // applicable Backbone.Events listeners.
        remove: function () {
            this.$el.remove();
            this.stopListening();
            return this;
        },

        // Change the view's element (`this.el` property), including event
        // re-delegation.
        setElement: function (element, delegate) {
            if (this.$el) this.undelegateEvents();
            this.$el = element instanceof Backbone.$ ? element : Backbone.$(element);
            this.el = this.$el[0];
            if (delegate !== false) this.delegateEvents();
            return this;
        },

        // Set callbacks, where `this.events` is a hash of
        //
        // *{"event selector": "callback"}*
        //
        //     {
        //       'mousedown .title':  'edit',
        //       'click .button':     'save'
        //       'click .open':       function(e) { ... }
        //     }
        //
        // pairs. Callbacks will be bound to the view, with `this` set properly.
        // Uses event delegation for efficiency.
        // Omitting the selector binds the event to `this.el`.
        // This only works for delegate-able events: not `focus`, `blur`, and
        // not `change`, `submit`, and `reset` in Internet Explorer.
        delegateEvents: function (events) {
            if (!(events || (events = _.result(this, 'events')))) return this;
            this.undelegateEvents();
            for (var key in events) {
                var method = events[key];
                if (!_.isFunction(method)) method = this[events[key]];
                if (!method) continue;

                var match = key.match(delegateEventSplitter);
                var eventName = match[1], selector = match[2];
                method = _.bind(method, this);
                eventName += '.delegateEvents' + this.cid;
                if (selector === '') {
                    this.$el.on(eventName, method);
                } else {
                    this.$el.on(eventName, selector, method);
                }
            }
            return this;
        },

        // Clears all callbacks previously bound to the view with `delegateEvents`.
        // You usually don't need to use this, but may wish to if you have multiple
        // Backbone views attached to the same DOM element.
        undelegateEvents: function () {
            this.$el.off('.delegateEvents' + this.cid);
            return this;
        },

        // Performs the initial configuration of a View with a set of options.
        // Keys with special meaning *(e.g. model, collection, id, className)* are
        // attached directly to the view.  See `viewOptions` for an exhaustive
        // list.
        _configure: function (options) {
            if (this.options) options = _.extend({}, _.result(this, 'options'), options);
            _.extend(this, _.pick(options, viewOptions));
            this.options = options;
        },

        // Ensure that the View has a DOM element to render into.
        // If `this.el` is a string, pass it through `$()`, take the first
        // matching element, and re-assign it to `el`. Otherwise, create
        // an element from the `id`, `className` and `tagName` properties.
        _ensureElement: function () {
            if (!this.el) {
                var attrs = _.extend({}, _.result(this, 'attributes'));
                if (this.id) attrs.id = _.result(this, 'id');
                if (this.className) attrs['class'] = _.result(this, 'className');
                var $el = Backbone.$('<' + _.result(this, 'tagName') + '>').attr(attrs);
                this.setElement($el, false);
            } else {
                this.setElement(_.result(this, 'el'), false);
            }
        }

    });

    // Backbone.sync
    // -------------

    // Override this function to change the manner in which Backbone persists
    // models to the server. You will be passed the type of request, and the
    // model in question. By default, makes a RESTful Ajax request
    // to the model's `url()`. Some possible customizations could be:
    //
    // * Use `setTimeout` to batch rapid-fire updates into a single request.
    // * Send up the models as XML instead of JSON.
    // * Persist models via WebSockets instead of Ajax.
    //
    // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
    // as `POST`, with a `_method` parameter containing the true HTTP method,
    // as well as all requests with the body as `application/x-www-form-urlencoded`
    // instead of `application/json` with the model in a param named `model`.
    // Useful when interfacing with server-side languages like **PHP** that make
    // it difficult to read the body of `PUT` requests.
    Backbone.sync = function (method, model, options) {
        var type = methodMap[method];

        // Default options, unless specified.
        _.defaults(options || (options = {}), {
            emulateHTTP: Backbone.emulateHTTP,
            emulateJSON: Backbone.emulateJSON
        });

        // Default JSON-request options.
        var params = { type: type, dataType: 'json' };

        // Ensure that we have a URL.
        if (!options.url) {
            params.url = _.result(model, 'url') || urlError();
        }

        // Ensure that we have the appropriate request data.
        if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
            params.contentType = 'application/json';
            params.data = JSON.stringify(options.attrs || model.toJSON(options));
        }

        // For older servers, emulate JSON by encoding the request into an HTML-form.
        if (options.emulateJSON) {
            params.contentType = 'application/x-www-form-urlencoded';
            params.data = params.data ? { model: params.data } : {};
        }

        // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
        // And an `X-HTTP-Method-Override` header.
        if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
            params.type = 'POST';
            if (options.emulateJSON) params.data._method = type;
            var beforeSend = options.beforeSend;
            options.beforeSend = function (xhr) {
                xhr.setRequestHeader('X-HTTP-Method-Override', type);
                if (beforeSend) return beforeSend.apply(this, arguments);
            };
        }

        // Don't process data on a non-GET request.
        if (params.type !== 'GET' && !options.emulateJSON) {
            params.processData = false;
        }

        // If we're sending a `PATCH` request, and we're in an old Internet Explorer
        // that still has ActiveX enabled by default, override jQuery to use that
        // for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
        if (params.type === 'PATCH' && window.ActiveXObject &&
              !(window.external && window.external.msActiveXFilteringEnabled)) {
            params.xhr = function () {
                return new ActiveXObject("Microsoft.XMLHTTP");
            };
        }

        // Make the request, allowing the user to override any Ajax options.
        var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
        model.trigger('request', model, xhr, options);
        return xhr;
    };

    // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
    var methodMap = {
        'create': 'POST',
        'update': 'PUT',
        'patch': 'PATCH',
        'delete': 'DELETE',
        'read': 'GET'
    };

    // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
    // Override this if you'd like to use a different library.
    Backbone.ajax = function () {
        return Backbone.$.ajax.apply(Backbone.$, arguments);
    };

    // Backbone.Router
    // ---------------

    // Routers map faux-URLs to actions, and fire events when routes are
    // matched. Creating a new one sets its `routes` hash, if not set statically.
    var Router = Backbone.Router = function (options) {
        options || (options = {});
        if (options.routes) this.routes = options.routes;
        this._bindRoutes();
        this.initialize.apply(this, arguments);
    };

    // Cached regular expressions for matching named param parts and splatted
    // parts of route strings.
    var optionalParam = /\((.*?)\)/g;
    var namedParam = /(\(\?)?:\w+/g;
    var splatParam = /\*\w+/g;
    var escapeRegExp = /[\-{}\[\]+?.,\\\^$|#\s]/g;

    // Set up all inheritable **Backbone.Router** properties and methods.
    _.extend(Router.prototype, Events, {

        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function () { },

        // Manually bind a single named route to a callback. For example:
        //
        //     this.route('search/:query/p:num', 'search', function(query, num) {
        //       ...
        //     });
        //
        route: function (route, name, callback) {
            if (!_.isRegExp(route)) route = this._routeToRegExp(route);
            if (_.isFunction(name)) {
                callback = name;
                name = '';
            }
            if (!callback) callback = this[name];
            var router = this;
            Backbone.history.route(route, function (fragment) {
                var args = router._extractParameters(route, fragment);
                callback && callback.apply(router, args);
                router.trigger.apply(router, ['route:' + name].concat(args));
                router.trigger('route', name, args);
                Backbone.history.trigger('route', router, name, args);
            });
            return this;
        },

        // Simple proxy to `Backbone.history` to save a fragment into the history.
        navigate: function (fragment, options) {
            Backbone.history.navigate(fragment, options);
            return this;
        },

        // Bind all defined routes to `Backbone.history`. We have to reverse the
        // order of the routes here to support behavior where the most general
        // routes can be defined at the bottom of the route map.
        _bindRoutes: function () {
            if (!this.routes) return;
            this.routes = _.result(this, 'routes');
            var route, routes = _.keys(this.routes);
            while ((route = routes.pop()) != null) {
                this.route(route, this.routes[route]);
            }
        },

        // Convert a route string into a regular expression, suitable for matching
        // against the current location hash.
        _routeToRegExp: function (route) {
            route = route.replace(escapeRegExp, '\\$&')
                         .replace(optionalParam, '(?:$1)?')
                         .replace(namedParam, function (match, optional) {
                             return optional ? match : '([^\/]+)';
                         })
                         .replace(splatParam, '(.*?)');
            return new RegExp('^' + route + '$');
        },

        // Given a route, and a URL fragment that it matches, return the array of
        // extracted decoded parameters. Empty or unmatched parameters will be
        // treated as `null` to normalize cross-browser behavior.
        _extractParameters: function (route, fragment) {
            var params = route.exec(fragment).slice(1);
            return _.map(params, function (param) {
                return param ? decodeURIComponent(param) : null;
            });
        }

    });

    // Backbone.History
    // ----------------

    // Handles cross-browser history management, based on either
    // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
    // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
    // and URL fragments. If the browser supports neither (old IE, natch),
    // falls back to polling.
    var History = Backbone.History = function () {
        this.handlers = [];
        _.bindAll(this, 'checkUrl');

        // Ensure that `History` can be used outside of the browser.
        if (typeof window !== 'undefined') {
            this.location = window.location;
            this.history = window.history;
        }
    };

    // Cached regex for stripping a leading hash/slash and trailing space.
    var routeStripper = /^[#\/]|\s+$/g;

    // Cached regex for stripping leading and trailing slashes.
    var rootStripper = /^\/+|\/+$/g;

    // Cached regex for detecting MSIE.
    var isExplorer = /msie [\w.]+/;

    // Cached regex for removing a trailing slash.
    var trailingSlash = /\/$/;

    // Has the history handling already been started?
    History.started = false;

    // Set up all inheritable **Backbone.History** properties and methods.
    _.extend(History.prototype, Events, {

        // The default interval to poll for hash changes, if necessary, is
        // twenty times a second.
        interval: 50,

        // Gets the true hash value. Cannot use location.hash directly due to bug
        // in Firefox where location.hash will always be decoded.
        getHash: function (window) {
            var match = (window || this).location.href.match(/#(.*)$/);
            return match ? match[1] : '';
        },

        // Get the cross-browser normalized URL fragment, either from the URL,
        // the hash, or the override.
        getFragment: function (fragment, forcePushState) {
            if (fragment == null) {
                if (this._hasPushState || !this._wantsHashChange || forcePushState) {
                    fragment = this.location.pathname;
                    var root = this.root.replace(trailingSlash, '');
                    if (!fragment.indexOf(root)) fragment = fragment.substr(root.length);
                } else {
                    fragment = this.getHash();
                }
            }
            return fragment.replace(routeStripper, '');
        },

        // Start the hash change handling, returning `true` if the current URL matches
        // an existing route, and `false` otherwise.
        start: function (options) {
            if (History.started) throw new Error("Backbone.history has already been started");
            History.started = true;

            // Figure out the initial configuration. Do we need an iframe?
            // Is pushState desired ... is it available?
            this.options = _.extend({}, { root: '/' }, this.options, options);
            this.root = this.options.root;
            this._wantsHashChange = this.options.hashChange !== false;
            this._wantsPushState = !!this.options.pushState;
            this._hasPushState = !!(this.options.pushState && this.history && this.history.pushState);
            var fragment = this.getFragment();
            var docMode = document.documentMode;
            var oldIE = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

            // Normalize root to always include a leading and trailing slash.
            this.root = ('/' + this.root + '/').replace(rootStripper, '/');

            if (oldIE && this._wantsHashChange) {
                this.iframe = Backbone.$('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo('body')[0].contentWindow;
                this.navigate(fragment);
            }

            // Depending on whether we're using pushState or hashes, and whether
            // 'onhashchange' is supported, determine how we check the URL state.
            if (this._hasPushState) {
                Backbone.$(window).on('popstate', this.checkUrl);
            } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
                Backbone.$(window).on('hashchange', this.checkUrl);
            } else if (this._wantsHashChange) {
                this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
            }

            // Determine if we need to change the base url, for a pushState link
            // opened by a non-pushState browser.
            this.fragment = fragment;
            var loc = this.location;
            var atRoot = loc.pathname.replace(/[^\/]$/, '$&/') === this.root;

            // If we've started off with a route from a `pushState`-enabled browser,
            // but we're currently in a browser that doesn't support it...
            if (this._wantsHashChange && this._wantsPushState && !this._hasPushState && !atRoot) {
                this.fragment = this.getFragment(null, true);
                this.location.replace(this.root + this.location.search + '#' + this.fragment);
                // Return immediately as browser will do redirect to new url
                return true;

                // Or if we've started out with a hash-based route, but we're currently
                // in a browser where it could be `pushState`-based instead...
            } else if (this._wantsPushState && this._hasPushState && atRoot && loc.hash) {
                this.fragment = this.getHash().replace(routeStripper, '');
                this.history.replaceState({}, document.title, this.root + this.fragment + loc.search);
            }

            if (!this.options.silent) return this.loadUrl();
        },

        // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
        // but possibly useful for unit testing Routers.
        stop: function () {
            Backbone.$(window).off('popstate', this.checkUrl).off('hashchange', this.checkUrl);
            clearInterval(this._checkUrlInterval);
            History.started = false;
        },

        // Add a route to be tested when the fragment changes. Routes added later
        // may override previous routes.
        route: function (route, callback) {
            this.handlers.unshift({ route: route, callback: callback });
        },

        // Checks the current URL to see if it has changed, and if it has,
        // calls `loadUrl`, normalizing across the hidden iframe.
        checkUrl: function (e) {
            var current = this.getFragment();
            if (current === this.fragment && this.iframe) {
                current = this.getFragment(this.getHash(this.iframe));
            }
            if (current === this.fragment) return false;
            if (this.iframe) this.navigate(current);
            this.loadUrl() || this.loadUrl(this.getHash());
        },

        // Attempt to load the current URL fragment. If a route succeeds with a
        // match, returns `true`. If no defined routes matches the fragment,
        // returns `false`.
        loadUrl: function (fragmentOverride) {
            var fragment = this.fragment = this.getFragment(fragmentOverride);
            var matched = _.any(this.handlers, function (handler) {
                if (handler.route.test(fragment)) {
                    handler.callback(fragment);
                    return true;
                }
            });
            return matched;
        },

        // Save a fragment into the hash history, or replace the URL state if the
        // 'replace' option is passed. You are responsible for properly URL-encoding
        // the fragment in advance.
        //
        // The options object can contain `trigger: true` if you wish to have the
        // route callback be fired (not usually desirable), or `replace: true`, if
        // you wish to modify the current URL without adding an entry to the history.
        navigate: function (fragment, options) {
            if (!History.started) return false;
            if (!options || options === true) options = { trigger: options };
            fragment = this.getFragment(fragment || '');
            if (this.fragment === fragment) return;
            this.fragment = fragment;
            var url = this.root + fragment;

            // If pushState is available, we use it to set the fragment as a real URL.
            if (this._hasPushState) {
                this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

                // If hash changes haven't been explicitly disabled, update the hash
                // fragment to store history.
            } else if (this._wantsHashChange) {
                this._updateHash(this.location, fragment, options.replace);
                if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
                    // Opening and closing the iframe tricks IE7 and earlier to push a
                    // history entry on hash-tag change.  When replace is true, we don't
                    // want this.
                    if (!options.replace) this.iframe.document.open().close();
                    this._updateHash(this.iframe.location, fragment, options.replace);
                }

                // If you've told us that you explicitly don't want fallback hashchange-
                // based history, then `navigate` becomes a page refresh.
            } else {
                return this.location.assign(url);
            }
            if (options.trigger) this.loadUrl(fragment);
        },

        // Update the hash location, either replacing the current entry, or adding
        // a new one to the browser history.
        _updateHash: function (location, fragment, replace) {
            if (replace) {
                var href = location.href.replace(/(javascript:|#).*$/, '');
                location.replace(href + '#' + fragment);
            } else {
                // Some browsers require that `hash` contains a leading #.
                location.hash = '#' + fragment;
            }
        }

    });

    // Create the default Backbone.history.
    Backbone.history = new History;

    // Helpers
    // -------

    // Helper function to correctly set up the prototype chain, for subclasses.
    // Similar to `goog.inherits`, but uses a hash of prototype properties and
    // class properties to be extended.
    var extend = function (protoProps, staticProps) {
        var parent = this;
        var child;

        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call the parent's constructor.
        if (protoProps && _.has(protoProps, 'constructor')) {
            child = protoProps.constructor;
        } else {
            child = function () { return parent.apply(this, arguments); };
        }

        // Add static properties to the constructor function, if supplied.
        _.extend(child, parent, staticProps);

        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        var Surrogate = function () { this.constructor = child; };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate;

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) _.extend(child.prototype, protoProps);

        // Set a convenience property in case the parent's prototype is needed
        // later.
        child.__super__ = parent.prototype;

        return child;
    };

    // Set up inheritance for the model, collection, router, view and history.
    Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

    // Throw an error when a URL is needed, and none is supplied.
    var urlError = function () {
        throw new Error('A "url" property or function must be specified');
    };

    // Wrap an optional error callback with a fallback error event.
    var wrapError = function (model, options) {
        var error = options.error;
        options.error = function (resp) {
            if (error) error(model, resp, options);
            model.trigger('error', model, resp, options);
        };
    };

    return Backbone;
}));

//     keymaster.js
//     (c) 2011-2012 Thomas Fuchs
//     keymaster.js may be freely distributed under the MIT license.

; (function (global) {

    var k,
      exportKey,
      _handlers = {},
      _mods = { 16: false, 18: false, 17: false, 91: false },
      _scope = 'all',
      // modifier keys
      _MODIFIERS = {
          '⇧': 16, shift: 16,
          '⌥': 18, alt: 18, option: 18,
          '⌃': 17, ctrl: 17, control: 17,
          '⌘': 91, command: 91
      },
      // special keys
      _MAP = {
          backspace: 8, tab: 9, clear: 12,
          enter: 13, 'return': 13,
          esc: 27, escape: 27, space: 32,
          left: 37, up: 38,
          right: 39, down: 40,
          del: 46, 'delete': 46,
          home: 36, end: 35,
          pageup: 33, pagedown: 34,
          ',': 188, '.': 190, '/': 191,
          '`': 192, '-': 189, '=': 187,
          ';': 186, '\'': 222,
          '[': 219, ']': 221, '\\': 220
      },
    code = function (x) {
        return _MAP[x] || x.toUpperCase().charCodeAt(0);
    },
      _downKeys = [];

    for (k = 1; k < 20; k++) _MODIFIERS['f' + k] = 111 + k;

    // IE doesn't support Array#indexOf, so have a simple replacement
    function index(array, item) {
        var i = array.length;
        while (i--) if (array[i] === item) return i;
        return -1;
    }

    var modifierMap = {
        16: 'shiftKey',
        18: 'altKey',
        17: 'ctrlKey',
        91: 'metaKey'
    };
    function updateModifierKey(event) {
        for (k in _mods) _mods[k] = event[modifierMap[k]];
    };

    // handle keydown event
    function dispatch(event, scope) {
        var key, handler, k, i, modifiersMatch;
        key = event.keyCode;

        if (index(_downKeys, key) == -1) {
            _downKeys.push(key);
        }

        // if a modifier key, set the key.<modifierkeyname> property to true and return
        if (key == 93 || key == 224) key = 91; // right command on webkit, command on Gecko
        if (key in _mods) {
            _mods[key] = true;
            // 'assignKey' from inside this closure is exported to window.key
            for (k in _MODIFIERS) if (_MODIFIERS[k] == key) assignKey[k] = true;
            return;
        }
        updateModifierKey(event);

        // see if we need to ignore the keypress (ftiler() can can be overridden)
        // by default ignore key presses if a select, textarea, or input is focused
        if (!assignKey.filter.call(this, event)) return;

        // abort if no potentially matching shortcuts found
        if (!(key in _handlers)) return;

        // for each potential shortcut
        for (i = 0; i < _handlers[key].length; i++) {
            handler = _handlers[key][i];

            // see if it's in the current scope
            if (handler.scope == scope || handler.scope == 'all') {
                // check if modifiers match if any
                modifiersMatch = handler.mods.length > 0;
                for (k in _mods)
                    if ((!_mods[k] && index(handler.mods, +k) > -1) ||
                      (_mods[k] && index(handler.mods, +k) == -1)) modifiersMatch = false;
                // call the handler and stop the event if neccessary
                if ((handler.mods.length == 0 && !_mods[16] && !_mods[18] && !_mods[17] && !_mods[91]) || modifiersMatch) {
                    if (handler.method(event, handler) === false) {
                        if (event.preventDefault) event.preventDefault();
                        else event.returnValue = false;
                        if (event.stopPropagation) event.stopPropagation();
                        if (event.cancelBubble) event.cancelBubble = true;
                    }
                }
            }
        }
    };

    // unset modifier keys on keyup
    function clearModifier(event) {
        var key = event.keyCode, k,
            i = index(_downKeys, key);

        // remove key from _downKeys
        if (i >= 0) {
            _downKeys.splice(i, 1);
        }

        if (key == 93 || key == 224) key = 91;
        if (key in _mods) {
            _mods[key] = false;
            for (k in _MODIFIERS) if (_MODIFIERS[k] == key) assignKey[k] = false;
        }
    };

    function resetModifiers() {
        for (k in _mods) _mods[k] = false;
        for (k in _MODIFIERS) assignKey[k] = false;
    }

    function getKeys(key) {
        var keys;
        key = key.replace(/\s/g, '');
        keys = key.split(',');
        if ((keys[keys.length - 1]) == '') {
            keys[keys.length - 2] += ',';
        }
        return keys;
    }

    function getMods(key) {
        var mods = key.slice(0, key.length - 1);
        for (var mi = 0; mi < mods.length; mi++)
            mods[mi] = _MODIFIERS[mods[mi]];
        return mods;
    }

    function compareArray(a1, a2) {
        if (a1.length != a2.length) return false;
        for (var i = 0; i < a1.length; i++) {
            if (a1[i] !== a2[i]) return false;
        }
        return true;
    }

    // parse and assign shortcut
    function assignKey(key, scope, method) {
        var keys = getKeys(key),
            mods;

        if (method === undefined) {
            method = scope;
            scope = 'all';
        }
        
        // for each shortcut
        for (var i = 0; i < keys.length; i++) {
            // set modifier keys if any
            mods = [];
            key = keys[i].split('+');
            if (key.length > 1) {
                mods = getMods(key);
                key = [key[key.length - 1]];
            }
            // convert to keycode and...
            key = key[0]
            key = code(key);
            // ...store handler
            if (!(key in _handlers)) _handlers[key] = [];
            _handlers[key].push({ shortcut: keys[i], scope: scope, method: method, key: keys[i], mods: mods });
        }
    };

    // Returns true if the key with code 'keyCode' is currently down
    // Converts strings into key codes.
    function isPressed(keyCode) {
        if (typeof (keyCode) == 'string') {
            keyCode = code(keyCode);
        }
        return index(_downKeys, keyCode) != -1;
    }

    function getPressedKeyCodes() {
        return _downKeys.slice(0);
    }

    function filter(event) {
        if (getScope().indexOf('searchbar') !== -1 || getScope().indexOf('codebooks:tabular') !== -1) return true;
        var tagName = (event.target || event.srcElement).tagName;
        // ignore keypressed in any elements that support keyboard data input
        return !(tagName == 'INPUT' || tagName == 'SELECT' || tagName == 'TEXTAREA');
    }

    // initialize key.<modifier> to false
    for (k in _MODIFIERS) assignKey[k] = false;

    // set current scope (default 'all')
    function setScope(scope) { _scope = scope || 'all' };
    function getScope() { return _scope || 'all' };

    // unbind all handlers for given key in current scope
    function unbindKey(key, scope) {
        var keys = key.split('+'),
            mods = [],
            i,
            obj;

        if (keys.length > 1) {
            mods = getMods(keys);
            key = keys[keys.length - 1];
        }

        key = code(key);

        if (scope === undefined) {
            scope = getScope();
        }
        if (!_handlers[key]) {
            return;
        }
        for (i in _handlers[key]) {
            obj = _handlers[key][i];
            if (obj.scope === scope && compareArray(obj.mods, mods)) {
                _handlers[key][i] = {};
            }
        }
    }

    // delete all handlers for a given scope
    function deleteScope(scope) {
        var key, handlers, i;

        for (key in _handlers) {
            handlers = _handlers[key];
            for (i = 0; i < handlers.length;) {
                if (handlers[i].scope === scope) handlers.splice(i, 1);
                else i++;
            }
        }
    };

    // cross-browser events
    function addEvent(object, event, method) {
        if (object.addEventListener)
            object.addEventListener(event, method, false);
        else if (object.attachEvent)
            object.attachEvent('on' + event, function () { method(window.event) });
    };

    // set the handlers globally on document
    addEvent(document, 'keydown', function (event) { dispatch(event, _scope) }); // Passing _scope to a callback to ensure it remains the same by execution. Fixes #48
    addEvent(document, 'keyup', clearModifier);

    // reset modifiers to false whenever the window is (re)focused.
    addEvent(window, 'focus', resetModifiers);

    // store previously defined key
    var previousKey = global.key;

    // restore previously defined key and return reference to our key object
    function noConflict() {
        var k = global.key;
        global.key = previousKey;
        return k;
    }

    // set window.key and window.key.set/get/deleteScope, and the default filter
    exportKey = assignKey;
    exportKey.setScope = setScope;
    exportKey.getScope = getScope;
    exportKey.deleteScope = deleteScope;
    exportKey.filter = filter;
    exportKey.isPressed = isPressed;
    exportKey.getPressedKeyCodes = getPressedKeyCodes;
    exportKey.noConflict = noConflict;
    exportKey.unbind = unbindKey;

    // AMD define happens at the end for compatibility with AMD loaders
    // that don't enforce next-turn semantics on modules.
    if (typeof define === 'function' && define.amd) {
        define('keymaster',[], function () {
            return exportKey;
        });
    } else {
        global.key = exportKey;
    }

    if (typeof module !== 'undefined') module.exports = exportKey;

})(this);
define('vendor/backbone/plugins/backbone.shortcuts',["keymaster", "Backbone", "underscore"], function (key, Backbone, _) {

    var Shortcuts;

    Shortcuts = function (options) {
        this.cid = _.uniqueId("backbone.shortcuts");
        this.initialize.apply(this, arguments);
        return this.delegateShortcuts();
    };

    _.extend(Shortcuts.prototype, Backbone.Events, {
        initialize: function () { },
        delegateShortcuts: function () {
            var callback, match, method, scope, shortcut, shortcutKey, _ref, _results;
            if (!this.shortcuts) return;
            _ref = this.shortcuts;
            _results = [];
            for (shortcut in _ref) {
                callback = _ref[shortcut];
                if (!_.isFunction(callback)) method = this[callback];
                if (!method) throw new Error("Method " + callback + " does not exist");
                match = shortcut.match(/^(\S+)\s*(.*)$/);
                shortcutKey = match[1];
                scope = match[2] === "" ? "all" : match[2];
                method = _.bind(method, this);
                _results.push(key(shortcutKey, scope, method));
            }
            return _results;
        },
        undelegateShortcuts: function () {
            if (!this.shortcuts) return;
            var _ref, shortcut, match, shortcutKey, scope;
            _ref = this.shortcuts;
            for (shortcut in _ref) {
                match = shortcut.match(/^(\S+)\s*(.*)$/);
                shortcutKey = match[1];
                scope = match[2] === "" ? "all" : match[2];
                key.unbind(shortcutKey, scope);
            }
        }
    });

    Backbone.Shortcuts = Shortcuts;

    Backbone.Shortcuts.extend = Backbone.View.extend;

});
/**
 * @license RequireJS text 2.0.5 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/text for details
 */
/*jslint regexp: true */
/*global require: false, XMLHttpRequest: false, ActiveXObject: false,
  define: false, window: false, process: false, Packages: false,
  java: false, location: false */

define('text',['module'], function (module) {
    

    var text, fs,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = [],
        masterConfig = (module.config && module.config()) || {};

    text = {
        version: '2.0.5',

        strip: function (content) {
            //Strips <?xml ...?> declarations so that external SVG and XML
            //documents can be added to a document without worry. Also, if the string
            //is an HTML document, only the part inside the body tag is returned.
            if (content) {
                content = content.replace(xmlRegExp, "");
                var matches = content.match(bodyRegExp);
                if (matches) {
                    content = matches[1];
                }
            } else {
                content = "";
            }
            return content;
        },

        jsEscape: function (content) {
            return content.replace(/(['\\])/g, '\\$1')
                .replace(/[\f]/g, "\\f")
                .replace(/[\b]/g, "\\b")
                .replace(/[\n]/g, "\\n")
                .replace(/[\t]/g, "\\t")
                .replace(/[\r]/g, "\\r")
                .replace(/[\u2028]/g, "\\u2028")
                .replace(/[\u2029]/g, "\\u2029");
        },

        createXhr: masterConfig.createXhr || function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else if (typeof ActiveXObject !== "undefined") {
                for (i = 0; i < 3; i += 1) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        /**
         * Parses a resource name into its component parts. Resource names
         * look like: module/name.ext!strip, where the !strip part is
         * optional.
         * @param {String} name the resource name
         * @returns {Object} with properties "moduleName", "ext" and "strip"
         * where strip is a boolean.
         */
        parseName: function (name) {
            var modName, ext, temp,
                strip = false,
                index = name.indexOf("."),
                isRelative = name.indexOf('./') === 0 ||
                             name.indexOf('../') === 0;

            if (index !== -1 && (!isRelative || index > 1)) {
                modName = name.substring(0, index);
                ext = name.substring(index + 1, name.length);
            } else {
                modName = name;
            }

            temp = ext || modName;
            index = temp.indexOf("!");
            if (index !== -1) {
                //Pull off the strip arg.
                strip = temp.substring(index + 1) === "strip";
                temp = temp.substring(0, index);
                if (ext) {
                    ext = temp;
                } else {
                    modName = temp;
                }
            }

            return {
                moduleName: modName,
                ext: ext,
                strip: strip
            };
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port) {
            var uProtocol, uHostName, uPort,
                match = text.xdRegExp.exec(url);
            if (!match) {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                   (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
                   ((!uPort && !uHostName) || uPort === port);
        },

        finishLoad: function (name, strip, content, onLoad) {
            content = strip ? text.strip(content) : content;
            if (masterConfig.isBuild) {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config) {
            //Name has format: some.module.filext!strip
            //The strip part is optional.
            //if strip is present, then that means only get the string contents
            //inside a body tag in an HTML string. For XML/SVG content it means
            //removing the <?xml ...?> declarations so the content can be inserted
            //into the current doc without problems.

            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config.isBuild && !config.inlineText) {
                onLoad();
                return;
            }

            masterConfig.isBuild = config.isBuild;

            var parsed = text.parseName(name),
                nonStripName = parsed.moduleName +
                    (parsed.ext ? '.' + parsed.ext : ''),
                url = req.toUrl(nonStripName),
                useXhr = (masterConfig.useXhr) ||
                         text.useXhr;

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
                text.get(url, function (content) {
                    text.finishLoad(name, parsed.strip, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            } else {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension, but do not include the
                //!strip part to avoid file system issues.
                req([nonStripName], function (content) {
                    text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                                    parsed.strip, content, onLoad);
                });
            }
        },

        write: function (pluginName, moduleName, write, config) {
            if (buildMap.hasOwnProperty(moduleName)) {
                var content = text.jsEscape(buildMap[moduleName]);
                write.asModule(pluginName + "!" + moduleName,
                               "define(function () { return '" +
                                   content +
                               "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config) {
            var parsed = text.parseName(moduleName),
                extPart = parsed.ext ? '.' + parsed.ext : '',
                nonStripName = parsed.moduleName + extPart,
                //Use a '.js' file name so that it indicates it is a
                //script that can be loaded across domains.
                fileName = req.toUrl(parsed.moduleName + extPart) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            text.load(nonStripName, req, function (value) {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents) {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents) {
                    return write.asModule(moduleName, fileName, contents);
                };

                text.write(pluginName, nonStripName, textWrite, config);
            }, config);
        }
    };

    if (masterConfig.env === 'node' || (!masterConfig.env &&
            typeof process !== "undefined" &&
            process.versions &&
            !!process.versions.node)) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        text.get = function (url, callback) {
            var file = fs.readFileSync(url, 'utf8');
            //Remove BOM (Byte Mark Order) from utf8 files if it is there.
            if (file.indexOf('\uFEFF') === 0) {
                file = file.substring(1);
            }
            callback(file);
        };
    } else if (masterConfig.env === 'xhr' || (!masterConfig.env &&
            text.createXhr())) {
        text.get = function (url, callback, errback, headers) {
            var xhr = text.createXhr(), header;
            xhr.open('GET', url, true);

            //Allow plugins direct access to xhr headers
            if (headers) {
                for (header in headers) {
                    if (headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header.toLowerCase(), headers[header]);
                    }
                }
            }

            //Allow overrides specified in config
            if (masterConfig.onXhr) {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt) {
                var status, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    status = xhr.status;
                    if (status > 399 && status < 600) {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        errback(err);
                    } else {
                        callback(xhr.responseText);
                    }
                }
            };
            xhr.send(null);
        };
    } else if (masterConfig.env === 'rhino' || (!masterConfig.env &&
            typeof Packages !== 'undefined' && typeof java !== 'undefined')) {
        //Why Java, why is this so awkward?
        text.get = function (url, callback) {
            var stringBuffer, line,
                encoding = "utf-8",
                file = new java.io.File(url),
                lineSeparator = java.lang.System.getProperty("line.separator"),
                input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                content = '';
            try {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();

                // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                // http://www.unicode.org/faq/utf_bom.html

                // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                if (line && line.length() && line.charAt(0) === 0xfeff) {
                    // Eat the BOM, since we've already found the encoding on this file,
                    // and we plan to concatenating this buffer with others; the BOM should
                    // only appear at the top of a file.
                    line = line.substring(1);
                }

                stringBuffer.append(line);

                while ((line = input.readLine()) !== null) {
                    stringBuffer.append(lineSeparator);
                    stringBuffer.append(line);
                }
                //Make sure we return a JavaScript string and not a Java string.
                content = String(stringBuffer.toString()); //String
            } finally {
                input.close();
            }
            callback(content);
        };
    }

    return text;
});

define('text!controls/codebooks/templates/codebooks.html',[],function () { return '<div class="k-content codebooks">\r\n    <div class="codebooks-wrap splitter-wrap">\r\n        <div>\r\n            <div class="searchbar" data-pane-index="10"></div>\r\n        </div>\r\n        <div class="bottom-wrap">\r\n            <div class="results-wrap">\r\n                <div class="index-wrap">\r\n                    <div>\r\n                        <div class="index-header"></div>\r\n                    </div>\r\n                    <div class="index-mid-wrap pane-scrollable">\r\n                        <div class="index-results" data-pane-index="20">\r\n                            <div class="pane-content pane-text pane-slim-n default-pane<% if (!hideResearch) { print(\' pane-slim-e\'); } %>"></div>\r\n                            <div class="pane-content pane-text pane-slim-n pcs-pane<% if (!hideResearch) { print(\' pane-slim-e\'); } %>" style="display:none"></div>\r\n                        </div>\r\n                    </div>\r\n                </div>\r\n                <div class="tabular-wrap">\r\n                    <div>\r\n                        <div class="tabular-header"></div>\r\n                    </div>\r\n                    <div>\r\n                        <div class="tabular-results pane-scrollable" data-pane-index="30">\r\n                            <div class="pane-content pane-text pane-slim-n<% if (!hideResearch) { print(\' pane-slim-e\'); } %>"></div>\r\n                        </div>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n            <% if (!hideResearch) { %>\r\n            <div>\r\n                <div class="research-outer-wrap">\r\n                    <!-- splitter -->\r\n                    <div class="research-wrap">\r\n                        <div class="pane-content pane-slim-e pane-slim-s pane-slim-w">\r\n                            <div class="heading-slim">Research</div>\r\n                        </div>\r\n                        <div class="research-mid-wrap pane-scrollable">\r\n                            <div class="research-pane-wrap pane-content pane-slim" data-pane-index="40"></div>\r\n                        </div>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n            <% } %>\r\n        </div>\r\n    </div>\r\n</div>';});

define('text!controls/codebooks/templates/searchbar/searchbar.html',[],function () { return '<% var randomId = Math.random().toString().replace(\'0.\',\'\'); %>\r\n<div class="pane-content form-inline">\r\n    <label for="search-box-<%= randomId %>" class="pad-right">Search for</label>\r\n    <input class="search-box k-input" id="search-box-<%= randomId %>" type="text" placeholder="search terms or code...">\r\n    <span class="pad-right pad-left">in</span>\r\n    <select class="book-list">\r\n        <% this.codeBooks.each(function(item) { %>\r\n        <option value="<%= item.get(\'id\') %>"><%= item.get(\'title\') %></option>\r\n        <% }); %>\r\n    </select>\r\n    <button type="submit" class="search-btn k-button pad-left" disabled="disabled">Search</button>\r\n    <div class="search-options">\r\n        <label class="checkbox find-all" style="display:none">\r\n            <input type="checkbox" value="FindAll" /> Find All\r\n        </label>\r\n        <label class="checkbox use-anesthesia" style="display:none">\r\n            <input type="checkbox" value="UseAnesthesiaCodes" /> Include Anesthesia Codes\r\n        </label>\r\n    </div>\r\n    <div class="additional-reference">\r\n        <a href="javascript:void(0)" class="show-modifiers" style="display:none">Modifiers</a>\r\n    </div>\r\n    <span class="tc-loading k-loading k-icon">Loading</span>\r\n</div>';});

define('text!controls/codebooks/templates/searchbar/codebooks-error.html',[],function () { return '<span class="alert alert-error codebooks-error">Trouble listing books. <a href="javascript:void(0)" class="codebooks-retry">Try again.</a></span>';});

var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/searchbarViewModel',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    
    var SearchbarViewModel = (function (_super) {
        __extends(SearchbarViewModel, _super);
        function SearchbarViewModel(options) {
            this.defaults = {
                codeBooks: null,
                bookValue: null,
                searchOption: null
            };
                _super.call(this, options);
        }
        return SearchbarViewModel;
    })(Backbone.Model);
    exports.SearchbarViewModel = SearchbarViewModel;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/codebook',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var CodeBook = (function (_super) {
        __extends(CodeBook, _super);
        function CodeBook(options) {
            this.defaults = function () {
                return {
                    id: -1,
                    title: -1
                };
            };
                _super.call(this, options);
        }
        CodeBook.prototype.initialize = function () {
            // do nothing
                    };
        return CodeBook;
    })(Backbone.Model);
    exports.CodeBook = CodeBook;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/codebookCollection',["require", "exports", "Backbone", "controls/codebooks/models/codebook"], function(require, exports, __Backbone__, __CB__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var CB = __CB__;

    var CodeBookCollection = (function (_super) {
        __extends(CodeBookCollection, _super);
        function CodeBookCollection() {
            _super.apply(this, arguments);

            this.model = CB.CodeBook;
        }
        return CodeBookCollection;
    })(Backbone.Collection);
    exports.CodeBookCollection = CodeBookCollection;    
})
;
define('kendoui/kendo.core',["jql"],function(e){var t={cultures:{}},n=eval,r=e.extend,i=e.each,o=e.proxy,s=e.isArray,a=e.noop,u=Math,f,l=window.JSON||{},c={},d=/%/,p=/\{(\d+)(:[^\}]+)?\}/g,m=/(\d+?)px\s*(\d+?)px\s*(\d+?)px\s*(\d+?)?/i,h=/^(\+|-?)\d+(\.?)\d*$/,g="function",v="string",y="number",w="object",b="null",M="boolean",S="undefined",T={},x={},O=[].slice,D=window.Globalize;t.version="2013.2.918";function k(){}k.extend=function(e){var t=function(){},n,i=this,o=e&&e.init?e.init:function(){i.apply(this,arguments)},s;t.prototype=i.prototype;s=o.fn=o.prototype=new t;for(n in e){if(typeof e[n]===w&&!(e[n]instanceof Array)&&e[n]!==null){s[n]=r(true,{},t.prototype[n],e[n])}else{s[n]=e[n]}}s.constructor=o;o.extend=i.extend;return o};function C(e){return typeof e==="function"}t.isFunction=C;var z=function(){this._defaultPrevented=true};var H=function(){return this._defaultPrevented===true};var E=k.extend({init:function(){this._events={}},bind:function(e,t,n){var r=this,i,o=typeof e===v?[e]:e,s,a,u,f=typeof t===g,l;if(t===undefined){for(i in e){r.bind(i,e[i])}return r}for(i=0,s=o.length;i<s;i++){e=o[i];u=f?t:t[e];if(u){if(n){a=u;u=function(){r.unbind(e,u);a.apply(r,arguments)}}l=r._events[e]=r._events[e]||[];l.push(u)}}return r},one:function(e,t){return this.bind(e,t,true)},first:function(e,t){var n=this,r,i=typeof e===v?[e]:e,o,s,a=typeof t===g,u;for(r=0,o=i.length;r<o;r++){e=i[r];s=a?t:t[e];if(s){u=n._events[e]=n._events[e]||[];u.unshift(s)}}return n},trigger:function(e,t){var n=this,r=n._events[e],i,o;if(r){t=t||{};t.sender=n;t._defaultPrevented=false;t.preventDefault=z;t.isDefaultPrevented=H;r=r.slice();for(i=0,o=r.length;i<o;i++){r[i].call(n,t)}return t._defaultPrevented===true}return false},unbind:function(e,t){var n=this,r=n._events[e],i;if(e===undefined){n._events={}}else if(r){if(t){for(i=r.length-1;i>=0;i--){if(r[i]===t){r.splice(i,1)}}}else{n._events[e]=[]}}return n}});function P(e,t){if(t){return"'"+e.split("'").join("\\'").split('\\"').join('\\\\\\"').replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/\t/g,"\\t")+"'"}else{var n=e.charAt(0),r=e.substring(1);if(n==="="){return"+("+r+")+"}else if(n===":"){return"+e("+r+")+"}else{return";"+e+";o+="}}}var A=/^\w+/,N=/\$\{([^}]*)\}/g,F=/\\\}/g,_=/__CURLY__/g,I=/\\#/g,W=/__SHARP__/g,U=["","0","00","000","0000"];f={paramName:"data",useWithBlock:true,render:function(e,t){var n,r,i="";for(n=0,r=t.length;n<r;n++){i+=e(t[n])}return i},compile:function(n,i){var o=r({},this,i),s=o.paramName,a=s.match(A)[0],u=o.useWithBlock,f='var o,e=function (value){return ("" + value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");};',l,c,d;if(C(n)){if(n.length===2){return function(t){return n(e,{data:t}).join("")}}return n}f+=u?"with("+s+"){":"";f+="o=";c=n.replace(F,"__CURLY__").replace(N,"#=e($1)#").replace(_,"}").replace(I,"__SHARP__").split("#");for(d=0;d<c.length;d++){f+=P(c[d],d%2===0)}f+=u?";}":";";f+="return o;";f=f.replace(W,"#");try{l=new Function(a,f);l._slotCount=Math.floor(c.length/2);return l}catch(p){throw new Error(t.format("Invalid template:'{0}' Generated code:'{1}'",n,f))}}};function L(e,t,n){e=e+"";t=t||2;n=t-e.length;if(n){return U[t].substring(0,n)+e}return e}!function(){var e=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,t,n,r={"\b":"\\b","	":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},i,o={}.toString;if(typeof Date.prototype.toJSON!==g){Date.prototype.toJSON=function(){var e=this;return isFinite(e.valueOf())?L(e.getUTCFullYear(),4)+"-"+L(e.getUTCMonth()+1)+"-"+L(e.getUTCDate())+"T"+L(e.getUTCHours())+":"+L(e.getUTCMinutes())+":"+L(e.getUTCSeconds())+"Z":null};String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(){return this.valueOf()}}function s(t){e.lastIndex=0;return e.test(t)?'"'+t.replace(e,function(e){var t=r[e];return typeof t===v?t:"\\u"+("0000"+e.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+t+'"'}function a(e,r){var u,f,l,c,d=t,p,m=r[e],h;if(m&&typeof m===w&&typeof m.toJSON===g){m=m.toJSON(e)}if(typeof i===g){m=i.call(r,e,m)}h=typeof m;if(h===v){return s(m)}else if(h===y){return isFinite(m)?String(m):b}else if(h===M||h===b){return String(m)}else if(h===w){if(!m){return b}t+=n;p=[];if(o.apply(m)==="[object Array]"){c=m.length;for(u=0;u<c;u++){p[u]=a(u,m)||b}l=p.length===0?"[]":t?"[\n"+t+p.join(",\n"+t)+"\n"+d+"]":"["+p.join(",")+"]";t=d;return l}if(i&&typeof i===w){c=i.length;for(u=0;u<c;u++){if(typeof i[u]===v){f=i[u];l=a(f,m);if(l){p.push(s(f)+(t?": ":":")+l)}}}}else{for(f in m){if(Object.hasOwnProperty.call(m,f)){l=a(f,m);if(l){p.push(s(f)+(t?": ":":")+l)}}}}l=p.length===0?"{}":t?"{\n"+t+p.join(",\n"+t)+"\n"+d+"}":"{"+p.join(",")+"}";t=d;return l}}if(typeof l.stringify!==g){l.stringify=function(e,r,o){var s;t="";n="";if(typeof o===y){for(s=0;s<o;s+=1){n+=" "}}else if(typeof o===v){n=o}i=r;if(r&&typeof r!==g&&(typeof r!==w||typeof r.length!==y)){throw new Error("JSON.stringify")}return a("",{"":e})}}}();!function(){var e=/dddd|ddd|dd|d|MMMM|MMM|MM|M|yyyy|yy|HH|H|hh|h|mm|m|fff|ff|f|tt|ss|s|"[^"]*"|'[^']*'/g,n=/^(n|c|p|e)(\d*)$/i,r=/(\\.)|(['][^']*[']?)|(["][^"]*["]?)/g,i=/\,/g,s="",a=".",f=",",l="#",c="0",d="??",m="en-US",h={}.toString;t.cultures["en-US"]={name:m,numberFormat:{pattern:["-n"],decimals:2,",":",",".":".",groupSize:[3],percent:{pattern:["-n %","n %"],decimals:2,",":",",".":".",groupSize:[3],symbol:"%"},currency:{pattern:["($n)","$n"],decimals:2,",":",",".":".",groupSize:[3],symbol:"$"}},calendars:{standard:{days:{names:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],namesAbbr:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],namesShort:["Su","Mo","Tu","We","Th","Fr","Sa"]},months:{names:["January","February","March","April","May","June","July","August","September","October","November","December"],namesAbbr:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]},AM:["AM","am","AM"],PM:["PM","pm","PM"],patterns:{d:"M/d/yyyy",D:"dddd, MMMM dd, yyyy",F:"dddd, MMMM dd, yyyy h:mm:ss tt",g:"M/d/yyyy h:mm tt",G:"M/d/yyyy h:mm:ss tt",m:"MMMM dd",M:"MMMM dd",s:"yyyy'-'MM'-'ddTHH':'mm':'ss",t:"h:mm tt",T:"h:mm:ss tt",u:"yyyy'-'MM'-'dd HH':'mm':'ss'Z'",y:"MMMM, yyyy",Y:"MMMM, yyyy"},"/":"/",":":":",firstDay:0,twoDigitYearMax:2029}}};function g(e){if(e){if(e.numberFormat){return e}if(typeof e===v){var n=t.cultures;return n[e]||n[e.split("-")[0]]||null}return null}return null}function w(e){if(e){e=g(e)}return e||t.cultures.current}function b(e){e.groupSizes=e.groupSize;e.percent.groupSizes=e.percent.groupSize;e.currency.groupSizes=e.currency.groupSize}t.culture=function(e){var n=t.cultures,r;if(e!==undefined){r=g(e)||n[m];r.calendar=r.calendars.standard;n.current=r;if(D){b(r.numberFormat)}}else{return n.current}};t.findCulture=g;t.getCulture=w;t.culture(m);function M(t,n,r){r=w(r);var i=r.calendars.standard,o=i.days,s=i.months;n=i.patterns[n]||n;return n.replace(e,function(e){var n;if(e==="d"){n=t.getDate()}else if(e==="dd"){n=L(t.getDate())}else if(e==="ddd"){n=o.namesAbbr[t.getDay()]}else if(e==="dddd"){n=o.names[t.getDay()]}else if(e==="M"){n=t.getMonth()+1}else if(e==="MM"){n=L(t.getMonth()+1)}else if(e==="MMM"){n=s.namesAbbr[t.getMonth()]}else if(e==="MMMM"){n=s.names[t.getMonth()]}else if(e==="yy"){n=L(t.getFullYear()%100)}else if(e==="yyyy"){n=L(t.getFullYear(),4)}else if(e==="h"){n=t.getHours()%12||12}else if(e==="hh"){n=L(t.getHours()%12||12)}else if(e==="H"){n=t.getHours()}else if(e==="HH"){n=L(t.getHours())}else if(e==="m"){n=t.getMinutes()}else if(e==="mm"){n=L(t.getMinutes())}else if(e==="s"){n=t.getSeconds()}else if(e==="ss"){n=L(t.getSeconds())}else if(e==="f"){n=u.floor(t.getMilliseconds()/100)}else if(e==="ff"){n=u.floor(t.getMilliseconds()/10)}else if(e==="fff"){n=t.getMilliseconds()}else if(e==="tt"){n=t.getHours()<12?i.AM[0]:i.PM[0]}return n!==undefined?n:e.slice(1,e.length-1)})}function S(e,t,o){o=w(o);var u=o.numberFormat,p=u.groupSize[0],m=u[f],h=u[a],g=u.decimals,v=u.pattern[0],y=[],b,M,S,x,O,D=e<0,k,C,z,H,E=s,P=s,A,N,F,_,I,W,U,L,j,R,B,J,Y,$=-1,V;if(e===undefined){return s}if(!isFinite(e)){return e}if(!t){return o.name.length?e.toLocaleString():e.toString()}O=n.exec(t);if(O){t=O[1].toLowerCase();M=t==="c";S=t==="p";if(M||S){u=M?u.currency:u.percent;p=u.groupSize[0];m=u[f];h=u[a];g=u.decimals;b=u.symbol;v=u.pattern[D?0:1]}x=O[2];if(x){g=+x}if(t==="e"){return x?e.toExponential(g):e.toExponential()}if(S){e*=100}e=T(e,g);e=e.split(a);k=e[0];C=e[1];if(D){k=k.substring(1)}P=k;z=k.length;if(z>=p){P=s;for(A=0;A<z;A++){if(A>0&&(z-A)%p===0){P+=m}P+=k.charAt(A)}}if(C){P+=h+C}if(t==="n"&&!D){return P}e=s;for(A=0,N=v.length;A<N;A++){F=v.charAt(A);if(F==="n"){e+=P}else if(F==="$"||F==="%"){e+=b}else{e+=F}}return e}if(D){e=-e}if(t.indexOf("'")>-1||t.indexOf('"')>-1||t.indexOf("\\")>-1){t=t.replace(r,function(e){var t=e.charAt(0).replace("\\",""),n=e.slice(1).replace(t,"");y.push(n);return d})}t=t.split(";");if(D&&t[1]){t=t[1];I=true}else if(e===0){t=t[2]||t[0];if(t.indexOf(l)==-1&&t.indexOf(c)==-1){return t}}else{t=t[0]}B=t.indexOf("%");J=t.indexOf("$");S=B!=-1;M=J!=-1;if(S){e*=100}if(M&&t[J-1]==="\\"){t=t.split("\\").join("");M=false}if(M||S){u=M?u.currency:u.percent;p=u.groupSize[0];m=u[f];h=u[a];g=u.decimals;b=u.symbol}_=t.indexOf(f)>-1;if(_){t=t.replace(i,s)}W=t.indexOf(a);N=t.length;if(W!=-1){C=e.toString().split("e");if(C[1]){C=T(e,Math.abs(C[1]))}else{C=C[0]}C=C.split(a)[1]||s;L=t.lastIndexOf(c)-W;U=t.lastIndexOf(l)-W;j=L>-1;R=U>-1;A=C.length;if(!j&&!R){t=t.substring(0,W)+t.substring(W+1);N=t.length;W=-1;A=0}if(j&&L>U){A=L}else if(U>L){if(R&&A>U){A=U}else if(j&&A<L){A=L}}if(A>-1){e=T(e,A)}}else{e=T(e)}U=t.indexOf(l);Y=L=t.indexOf(c);if(U==-1&&L!=-1){$=L}else if(U!=-1&&L==-1){$=U}else{$=U>L?L:U}U=t.lastIndexOf(l);L=t.lastIndexOf(c);if(U==-1&&L!=-1){V=L}else if(U!=-1&&L==-1){V=U}else{V=U>L?U:L}if($==N){V=$}if($!=-1){P=e.toString().split(a);k=P[0];C=P[1]||s;z=k.length;H=C.length;if(_){if(z===p&&z<W-Y){k=m+k}else if(z>p){P=s;for(A=0;A<z;A++){if(A>0&&(z-A)%p===0){P+=m}P+=k.charAt(A)}k=P}}e=t.substring(0,$);if(D&&!I){e+="-"}for(A=$;A<N;A++){F=t.charAt(A);if(W==-1){if(V-A<z){e+=k;break}}else{if(L!=-1&&L<A){E=s}if(W-A<=z&&W-A>-1){e+=k;A=W}if(W===A){e+=(C?h:s)+C;A+=V-W+1;continue}}if(F===c){e+=F;E=F}else if(F===l){e+=E}}if(V>=$){e+=t.substring(V+1)}if(M||S){P=s;for(A=0,N=e.length;A<N;A++){F=e.charAt(A);P+=F==="$"||F==="%"?b:F}e=P}N=y.length;if(N){for(A=0;A<N;A++){e=e.replace(d,y[A])}}}return e}var T=function(e,t){var n=Math.pow(10,t||0);return(Math.round(e*n)/n).toFixed(t)};var x=function(e,t,n){if(t){if(h.call(e)==="[object Date]"){return M(e,t,n)}else if(typeof e===y){return S(e,t,n)}}return e!==undefined?e:""};if(D){x=o(D.format,D)}t.format=function(e){var t=arguments;return e.replace(p,function(e,n,r){var i=t[parseInt(n,10)+1];return x(i,r?r.substring(1):"")})};t._extractFormat=function(e){if(e.slice(0,3)==="{0:"){e=e.slice(3,e.length-1)}return e};t._activeElement=function(){try{return document.activeElement}catch(e){return document.documentElement.activeElement}};t._round=T;t.toString=x}();!function(){var n=/\u00A0/g,r=/[eE][\-+]?[0-9]+/,i=/[+|\-]\d{1,2}/,o=/[+|\-]\d{1,2}:\d{2}/,a=/^\/Date\((.*?)\)\/$/,u=["G","g","d","F","D","y","m","T","t"],f={2:/^\d{1,2}/,4:/^\d{4}/},l={}.toString;function c(e,t,n){return!(e>=t&&e<=n)}function d(e){return e.charAt(0)}function p(t){return e.map(t,d)}function m(e,t){if(!t&&e.getHours()===23){e.setHours(e.getHours()+2)}}function h(e){var t=0,n=e.length,r=[];for(;t<n;t++){r[t]=(e[t]+"").toLowerCase()}return r}function g(e){var t={},n;for(n in e){t[n]=h(e[n])}return t}function v(e,t,n){if(!e){return null}var r=function(e){var n=0;while(t[S]===e){n++;S++}if(n>0){S-=1}return n},s=function(t){var n=f[t]||new RegExp("^\\d{1,"+t+"}"),r=e.substr(T,t).match(n);if(r){r=r[0];T+=r.length;return parseInt(r,10)}return null},a=function(t,n){var r=0,i=t.length,o,s,a;for(;r<i;r++){o=t[r];s=o.length;a=e.substr(T,s);if(n){a=a.toLowerCase()}if(a==o){T+=s;return r+1}}return null},u=function(){var n=false;if(e.charAt(T)===t[S]){T++;n=true}return n},l=n.calendars.standard,d=null,h=null,v=null,y=null,w=null,b=null,M=null,S=0,T=0,x=false,O=new Date,D=l.twoDigitYearMax||2029,k=O.getFullYear(),C,z,H,E,P,A,N,F,_,I,W,U;if(!t){t="d"}E=l.patterns[t];if(E){t=E}t=t.split("");H=t.length;for(;S<H;S++){C=t[S];if(x){if(C==="'"){x=false}else{u()}}else{if(C==="d"){z=r("d");if(!l._lowerDays){l._lowerDays=g(l.days)}v=z<3?s(2):a(l._lowerDays[z==3?"namesAbbr":"names"],true);if(v===null||c(v,1,31)){return null}}else if(C==="M"){z=r("M");if(!l._lowerMonths){l._lowerMonths=g(l.months)}h=z<3?s(2):a(l._lowerMonths[z==3?"namesAbbr":"names"],true);if(h===null||c(h,1,12)){return null}h-=1}else if(C==="y"){z=r("y");d=s(z);if(d===null){return null}if(z==2){if(typeof D==="string"){D=k+parseInt(D,10)}d=k-k%100+d;if(d>D){d-=100}}}else if(C==="h"){r("h");y=s(2);if(y==12){y=0}if(y===null||c(y,0,11)){return null}}else if(C==="H"){r("H");y=s(2);if(y===null||c(y,0,23)){return null}}else if(C==="m"){r("m");w=s(2);if(w===null||c(w,0,59)){return null}}else if(C==="s"){r("s");b=s(2);if(b===null||c(b,0,59)){return null}}else if(C==="f"){z=r("f");M=s(z);if(M!==null&&z>3){M=parseInt(M.toString().substring(0,3),10)}if(M===null||c(M,0,999)){return null}}else if(C==="t"){z=r("t");_=l.AM;I=l.PM;if(z===1){_=p(_);I=p(I)}P=a(I);if(!P&&!a(_)){return null}}else if(C==="z"){A=true;z=r("z");if(e.substr(T,1)==="Z"){if(!N){return null}u();continue}F=e.substr(T,6).match(z>2?o:i);if(!F){return null}F=F[0];T=F.length;F=F.split(":");W=parseInt(F[0],10);if(c(W,-12,13)){return null}if(z>2){U=parseInt(F[1],10);if(isNaN(U)||c(U,0,59)){return null}}}else if(C==="T"){N=u()}else if(C==="'"){x=true;u()}else if(!u()){return null}}}if(d===null){d=k}if(P&&y<12){y+=12}if(v===null){v=1}if(A){if(W){y+=-W}if(U){w+=-U}e=new Date(Date.UTC(d,h,v,y,w,b,M))}else{e=new Date(d,h,v,y,w,b,M);m(e,y)}if(d<100){e.setFullYear(d)}if(e.getDate()!==v&&A===undefined){return null}return e}t.parseDate=function(e,n,r){if(l.call(e)==="[object Date]"){return e}var i=0,o=null,f,c;if(e&&e.indexOf("/D")===0){o=a.exec(e);if(o){return new Date(parseInt(o[1],10))}}r=t.getCulture(r);if(!n){n=[];c=r.calendar.patterns;f=u.length;for(;i<f;i++){n[i]=c[u[i]]}i=0;n.push("yyyy/MM/dd HH:mm:ss","yyyy/MM/dd HH:mm","yyyy/MM/dd","ddd MMM dd yyyy HH:mm:ss","yyyy-MM-ddTHH:mm:ss.fffffffzzz","yyyy-MM-ddTHH:mm:ss.fffzzz","yyyy-MM-ddTHH:mm:sszzz","yyyy-MM-ddTHH:mmzzz","yyyy-MM-ddTHH:mmzz","yyyy-MM-ddTHH:mm:ss","yyyy-MM-ddTHH:mm","yyyy-MM-dd HH:mm:ss","yyyy-MM-dd HH:mm","yyyy-MM-dd")}n=s(n)?n:[n];f=n.length;for(;i<f;i++){o=v(e,n[i],r);if(o){return o}}return o};t.parseInt=function(e,n){var r=t.parseFloat(e,n);if(r){r=r|0}return r};t.parseFloat=function(e,i,o){if(!e&&e!==0){return null}if(typeof e===y){return e}e=e.toString();i=t.getCulture(i);var s=i.numberFormat,a=s.percent,u=s.currency,f=u.symbol,l=a.symbol,c=e.indexOf("-"),d,p;if(r.test(e)){e=parseFloat(e.replace(s["."],"."));if(isNaN(e)){e=null}return e}if(c>0){return null}else{c=c>-1}if(e.indexOf(f)>-1||o&&o.toLowerCase().indexOf("c")>-1){s=u;d=s.pattern[0].replace("$",f).split("n");if(e.indexOf(d[0])>-1&&e.indexOf(d[1])>-1){e=e.replace(d[0],"").replace(d[1],"");c=true}}else if(e.indexOf(l)>-1){p=true;s=a;f=l}e=e.replace("-","").replace(f,"").replace(n," ").split(s[","].replace(n," ")).join("").replace(s["."],".");e=parseFloat(e);if(isNaN(e)){e=null}else if(c){e*=-1}if(e&&p){e/=100}return e};if(D){t.parseDate=function(e,t,n){if(l.call(e)==="[object Date]"){return e}return D.parseDate(e,t,n)};t.parseFloat=function(e,t){if(typeof e===y){return e}if(e===undefined||e===null){return null}e=D.parseFloat(e,t);return isNaN(e)?null:e}}}();function j(n){var r=c.browser,i,o=n.css("direction")=="rtl";if(!n.parent().hasClass("k-animation-container")){var s=n.css(t.support.transitions.css+"box-shadow")||n.css("box-shadow"),a=s?s.match(m)||[0,0,0,0,0]:[0,0,0,0,0],f=u.max(+a[3],+(a[4]||0)),l=-a[1]+f,p=+a[1]+f,h=+a[2]+f,g=n[0].style.width,v=n[0].style.height,y=d.test(g),w=d.test(v);if(r.opera){l=p=h=5}i=y||w;if(!y){g=n.outerWidth()}if(!w){v=n.outerHeight()}n.wrap(e("<div/>").addClass("k-animation-container").css({width:g,height:v,marginLeft:l*(o?1:-1),paddingLeft:l,paddingRight:p,paddingBottom:h}));if(i){n.css({width:"100%",height:"100%",boxSizing:"border-box",mozBoxSizing:"border-box",webkitBoxSizing:"border-box"})}}else{var b=n.parent(".k-animation-container"),M=b[0].style;if(b.is(":hidden")){b.show()}i=d.test(M.width)||d.test(M.height);if(!i){b.css({width:n.outerWidth(),height:n.outerHeight()})}}if(r.msie&&u.floor(r.version)<=7){n.css({zoom:1});n.children(".k-menu").width(n.width())}return n.parent()}function R(e){var t=1,n=arguments.length;for(t=1;t<n;t++){B(e,arguments[t])}return e}function B(e,n){var r=t.data.ObservableArray,i=t.data.DataSource,o,s,a,u;for(o in n){s=n[o];a=typeof s;if(a===w&&s!==null&&s.constructor!==Array&&s.constructor!==r&&s.constructor!==i){if(s instanceof Date){e[o]=new Date(s.getTime())}else{u=e[o];if(typeof u===w){e[o]=u||{}}else{e[o]={}}B(e[o],s)}}else if(a!==S){e[o]=s}}return e}function J(e,t,n){for(var r in t){if(t.hasOwnProperty(r)&&t[r].test(e)){return r}}return n!==undefined?n:e}function Y(n,r){var i={},o;if(document.defaultView&&document.defaultView.getComputedStyle){o=document.defaultView.getComputedStyle(n,"");if(r){e.each(r,function(e,t){i[t]=o.getPropertyValue(t)})}}else{o=n.currentStyle;if(r){e.each(r,function(e,t){i[t]=o[t.replace(/\-(\w)/g,function(e,t){return t.toUpperCase()})]})}}if(!t.size(i)){i=o}return i}!function(){c.scrollbar=function(){var e=document.createElement("div"),t;e.style.cssText="overflow:scroll;overflow-x:hidden;zoom:1;clear:both";e.innerHTML="&nbsp;";document.body.appendChild(e);t=e.offsetWidth-e.scrollWidth;document.body.removeChild(e);return t};c.isRtl=function(t){return e(t).closest(".k-rtl").length>0};var t=document.createElement("table");try{t.innerHTML="<tr><td></td></tr>";c.tbodyInnerHtml=true}catch(n){c.tbodyInnerHtml=false}c.touch="ontouchstart"in window;c.msPointers=navigator.msPointerEnabled;c.pointers=navigator.pointerEnabled;var r=c.transitions=false,o=c.transforms=false,s="HTMLElement"in window?HTMLElement.prototype:[];c.hasHW3D="WebKitCSSMatrix"in window&&"m11"in new window.WebKitCSSMatrix||"MozPerspective"in document.documentElement.style||"msPerspective"in document.documentElement.style;i(["Moz","webkit","O","ms"],function(){var e=this.toString(),n=typeof t.style[e+"Transition"]===v;if(n||typeof t.style[e+"Transform"]===v){var i=e.toLowerCase();o={css:i!="ms"?"-"+i+"-":"",prefix:e,event:i==="o"||i==="webkit"?i:""};if(n){r=o;r.event=r.event?r.event+"TransitionEnd":"transitionend"}return false}});c.transforms=o;c.transitions=r;c.devicePixelRatio=window.devicePixelRatio===undefined?1:window.devicePixelRatio;try{c.screenWidth=window.outerWidth||window.screen?window.screen.availWidth:window.innerWidth;c.screenHeight=window.outerHeight||window.screen?window.screen.availHeight:window.innerHeight}catch(n){c.screenWidth=window.screen.availWidth;c.screenHeight=window.screen.availHeight}c.detectOS=function(e){var t=false,n,r=[],i=!/mobile safari/i.test(e),o={fire:/(Silk)\/(\d+)\.(\d+(\.\d+)?)/,android:/(Android|Android.*(?:Opera|Firefox).*?\/)\s*(\d+)\.(\d+(\.\d+)?)/,iphone:/(iPhone|iPod).*OS\s+(\d+)[\._]([\d\._]+)/,ipad:/(iPad).*OS\s+(\d+)[\._]([\d_]+)/,meego:/(MeeGo).+NokiaBrowser\/(\d+)\.([\d\._]+)/,webos:/(webOS)\/(\d+)\.(\d+(\.\d+)?)/,blackberry:/(BlackBerry|BB10).*?Version\/(\d+)\.(\d+(\.\d+)?)/,playbook:/(PlayBook).*?Tablet\s*OS\s*(\d+)\.(\d+(\.\d+)?)/,wp:/(Windows Phone(?: OS)?)\s(\d+)\.(\d+(\.\d+)?)/,windows:/(MSIE)\s+(\d+)\.(\d+(\.\d+)?)/,ffos:/(Mobile).*rv:(\d+)\.(\d+(\.\d+)?).*Firefox/},s={ios:/^i(phone|pad|pod)$/i,android:/^android|fire$/i,blackberry:/^blackberry|playbook/i,windows:/windows/,wp:/wp/,meego:/meego|ffos/},a={tablet:/playbook|ipad|fire/i},u={omini:/Opera\sMini/i,omobile:/Opera\sMobi/i,firefox:/Firefox|Fennec/i,mobilesafari:/version\/.*safari/i,chrome:/chrome/i,webkit:/webkit/i,ie:/MSIE|Windows\sPhone/i};for(var f in o){if(o.hasOwnProperty(f)){r=e.match(o[f]);if(r){if(f=="windows"&&"plugins"in navigator){return false}t={};t.device=f;t.tablet=J(f,a,false);t.browser=J(e,u,"default");t.name=J(f,s);t[t.name]=true;t.majorVersion=r[2];t.minorVersion=r[3].replace("_",".");n=t.minorVersion.replace(".","").substr(0,2);t.flatVersion=t.majorVersion+n+new Array(3-(n.length<3?n.length:2)).join("0");t.appMode=window.navigator.standalone||/file|local|wmapp/.test(window.location.protocol)||typeof window.PhoneGap!==S||typeof window.cordova!==S;if(t.android&&(c.devicePixelRatio<1.5&&t.flatVersion<400||i)&&(c.screenWidth>800||c.screenHeight>800)){t.tablet=f}break}}}return t};var a=c.mobileOS=c.detectOS(navigator.userAgent);c.wpDevicePixelRatio=a.wp?screen.width/320:0;c.kineticScrollNeeded=a&&(c.touch||c.msPointers||c.pointers);c.hasNativeScrolling=false;if(a.ios&&a.majorVersion>4||a.android&&a.majorVersion>2||a.wp){c.hasNativeScrolling=a}c.mouseAndTouchPresent=c.touch&&!(c.mobileOS.ios||c.mobileOS.android);c.detectBrowser=function(e){var t=false,n=[],r={webkit:/(chrome)[ \/]([\w.]+)/i,safari:/(webkit)[ \/]([\w.]+)/i,opera:/(opera)(?:.*version|)[ \/]([\w.]+)/i,msie:/(msie\s|trident.*? rv:)([\w.]+)/i,mozilla:/(mozilla)(?:.*? rv:([\w.]+)|)/i};for(var i in r){if(r.hasOwnProperty(i)){n=e.match(r[i]);if(n){t={};t[i]=true;t[n[1].toLowerCase()]=true;t.version=parseInt(document.documentMode||n[2],10);break}}}return t};c.browser=c.detectBrowser(navigator.userAgent);c.zoomLevel=function(){try{return c.touch?document.documentElement.clientWidth/window.innerWidth:c.browser.msie&&c.browser.version>=10?(top||window).outerWidth/(top||window).innerWidth:1}catch(e){return 1}};c.cssBorderSpacing=typeof document.documentElement.style.borderSpacing!="undefined"&&!(c.browser.msie&&c.browser.version<8);!function(t){var n,r=parseInt(t.version,10);if(t.msie){n="ie"}else if(t.mozilla){n="ff"}else if(t.safari){n="safari"}else if(t.webkit){n="webkit"}else if(t.opera){n="opera"}if(n){e(document.documentElement).addClass("k-"+n+" k-"+n+r)}}(c.browser);c.eventCapture=document.documentElement.addEventListener;c.placeholder="placeholder"in document.createElement("input");c.stableSort=function(){var e=[0,1,2,3,4,5,6,7,8,9,10,11,12].sort(function(){return 0});return e[0]===0&&e[1]===1&&e[2]===2&&e[3]===3&&e[4]===4&&e[5]===5&&e[6]===6&&e[7]===7&&e[8]===8&&e[9]===9&&e[10]===10&&e[11]===11&&e[12]===12}();c.matchesSelector=s.webkitMatchesSelector||s.mozMatchesSelector||s.msMatchesSelector||s.oMatchesSelector||s.matchesSelector||function(t){var n=document.querySelectorAll?(this.parentNode||document).querySelectorAll(t)||[]:e(t),r=n.length;while(r--){if(n[r]==this){return true}}return false};c.pushState=window.history&&window.history.pushState;var u=document.documentMode;c.hashChange="onhashchange"in window&&!(c.browser.msie&&(!u||u<=8))}();function $(e){var t=0,n;for(n in e){if(e.hasOwnProperty(n)&&n!="toJSON"){t++}}return t}function V(e,n,r){if(!n){n="offset"}var i=e[n](),o=c.mobileOS;if(c.touch&&o.ios&&o.flatVersion<410){var s=n=="offset"?i:e.offset(),a=i.left==s.left&&i.top==s.top;if(a){return{top:i.top-window.scrollY,left:i.left-window.scrollX}}}if((t.support.pointers||t.support.msPointers)&&!r){i.top-=window.pageYOffset-document.documentElement.scrollTop;i.left-=window.pageXOffset-document.documentElement.scrollLeft}return i}var G={left:{reverse:"right"},right:{reverse:"left"},down:{reverse:"up"},up:{reverse:"down"},top:{reverse:"bottom"},bottom:{reverse:"top"},"in":{reverse:"out"},out:{reverse:"in"}};function q(e){var t={};i(typeof e==="string"?e.split(" "):e,function(e){t[e]=this});return t}function K(e){return new t.effects.Element(e)}var Q={};e.extend(Q,{Element:function(t){this.element=e(t)},promise:function(e,t){if(!e.is(":visible")){e.css({display:e.data("olddisplay")||"block"}).css("display")}if(t.hide){e.data("olddisplay",e.css("display")).hide()}if(t.init){t.init()}if(t.completeCallback){t.completeCallback(e)}e.dequeue()},transitionPromise:function(e,n,r){var i=t.wrap(e);i.append(n);e.hide();n.show();if(r.completeCallback){r.completeCallback(e)}return e}});function X(e,t,n,i){if(typeof e===v){if(C(t)){i=t;t=400;n=false}if(C(n)){i=n;n=false}if(typeof t===M){n=t;t=400}e={effects:e,duration:t,reverse:n,complete:i}}return r({effects:{},duration:400,reverse:false,init:a,teardown:a,hide:false},e,{completeCallback:e.complete,complete:a})}function Z(t,n,r,i,o){var s=0,a=t.length,u;for(;s<a;s++){u=e(t[s]);u.queue(function(){Q.promise(u,X(n,r,i,o))})}return t}function et(e,t,n,r,i,o){return Q.transitionPromise(e,t,X(n,r,i,o))}function tt(e,t,n,r){if(t){t=t.split(" ");i(t,function(t,n){e.toggleClass(n,r)})}return e}if(!("kendoAnimate"in e.fn)){r(e.fn,{kendoStop:function(e,t){return this.stop(e,t)},kendoAnimate:function(e,t,n,r){return Z(this,e,t,n,r)},kendoAnimateTo:function(e,t,n,r,i){return et(this,e,t,n,r,i)},kendoAddClass:function(e,n){return t.toggleClass(this,e,n,true)},kendoRemoveClass:function(e,n){return t.toggleClass(this,e,n,false)},kendoToggleClass:function(e,n,r){return t.toggleClass(this,e,n,r)}})}var nt=/&/g,rt=/</g,it=/>/g;function ot(e){return(""+e).replace(nt,"&amp;").replace(rt,"&lt;").replace(it,"&gt;")}var st=function(e){return e.target};if(c.touch){st=function(e){var t="originalEvent"in e?e.originalEvent.changedTouches:"changedTouches"in e?e.changedTouches:null;return t?document.elementFromPoint(t[0].clientX,t[0].clientY):e.target};i(["swipe","swipeLeft","swipeRight","swipeUp","swipeDown","doubleTap","tap"],function(t,n){e.fn[n]=function(e){return this.bind(n,e)}})}if(c.touch){if(!c.mobileOS){c.mousedown="mousedown touchstart";c.mouseup="mouseup touchend";c.mousemove="mousemove touchmove";c.mousecancel="mouseleave touchcancel";c.click="click";c.resize="resize"}else{c.mousedown="touchstart";c.mouseup="touchend";c.mousemove="touchmove";c.mousecancel="touchcancel";c.click="touchend";c.resize="orientationchange"}}else if(c.pointers){c.mousemove="pointermove";c.mousedown="pointerdown";c.mouseup="pointerup";c.mousecancel="pointercancel";c.click="pointerup";c.resize="orientationchange resize"}else if(c.msPointers){c.mousemove="MSPointerMove";c.mousedown="MSPointerDown";c.mouseup="MSPointerUp";c.mousecancel="MSPointerCancel";c.click="MSPointerUp";c.resize="orientationchange resize"}else{c.mousemove="mousemove";c.mousedown="mousedown";c.mouseup="mouseup";c.mousecancel="mouseleave";c.click="click";c.resize="resize"}var at=function(e,t){var n=t||"d",r,i,o,s,a=1;for(i=0,o=e.length;i<o;i++){s=e[i];if(s!==""){r=s.indexOf("[");if(r!==0){if(r==-1){s="."+s}else{a++;s="."+s.substring(0,r)+" || {})"+s.substring(r)}}a++;n+=s+(i<o-1?" || {})":")")}}return new Array(a).join("(")+n},ut=/^([a-z]+:)?\/\//i;r(t,{ui:t.ui||{},fx:t.fx||K,effects:t.effects||Q,mobile:t.mobile||{},data:t.data||{},dataviz:t.dataviz||{ui:{roles:{}}},keys:{INSERT:45,DELETE:46,BACKSPACE:8,TAB:9,ENTER:13,ESC:27,LEFT:37,UP:38,RIGHT:39,DOWN:40,END:35,HOME:36,SPACEBAR:32,PAGEUP:33,PAGEDOWN:34,F2:113,F10:121,F12:123},support:t.support||c,animate:t.animate||Z,ns:"",attr:function(e){return"data-"+t.ns+e},wrap:j,deepExtend:R,getComputedStyles:Y,size:$,getOffset:t.getOffset||V,parseEffects:t.parseEffects||q,toggleClass:t.toggleClass||tt,directions:t.directions||G,Observable:E,Class:k,Template:f,template:o(f.compile,f),render:o(f.render,f),stringify:o(l.stringify,l),eventTarget:st,htmlEncode:ot,isLocalUrl:function(e){return e&&!ut.test(e)},expr:function(e,t,n){e=e||"";if(typeof t==v){n=t;t=false}n=n||"d";if(e&&e.charAt(0)!=="["){e="."+e}if(t){e=at(e.split("."),n)}else{e=n+e}return e},getter:function(e,n){return T[e]=T[e]||new Function("d","return "+t.expr(e,n))},setter:function(e){return x[e]=x[e]||new Function("d,value",t.expr(e)+"=value")},accessor:function(e){return{get:t.getter(e),set:t.setter(e)}},guid:function(){var e="",t,n;for(t=0;t<32;t++){n=u.random()*16|0;if(t==8||t==12||t==16||t==20){e+="-"}e+=(t==12?4:t==16?n&3|8:n).toString(16)}return e},roleSelector:function(e){return e.replace(/(\S+)/g,"["+t.attr("role")+"=$1],").slice(0,-1)},triggeredByInput:function(e){return/^(label|input|textarea|select)$/i.test(e.target.tagName)},logToConsole:function(e){var t=window.console;if(typeof t!="undefined"&&t.log){t.log(e)}}});var ft=E.extend({init:function(e,n){var i=this;i.element=t.jQuery(e).handler(i);E.fn.init.call(i);n=i.options=r(true,{},i.options,n);if(!i.element.attr(t.attr("role"))){i.element.attr(t.attr("role"),(n.name||"").toLowerCase())}i.element.data("kendo"+n.prefix+n.name,i);i.bind(i.events,n)},events:[],options:{prefix:""},_hasBindingTarget:function(){return!!this.element[0].kendoBindingTarget},_tabindex:function(e){e=e||this.wrapper;var t=this.element,n="tabindex",r=e.attr(n)||t.attr(n);t.removeAttr(n);e.attr(n,!isNaN(r)?r:0)},setOptions:function(t){var n=this,r=0,i=n.events.length,o;for(;r<i;r++){o=n.events[r];if(n.options[o]&&t[o]){n.unbind(o,n.options[o])}}e.extend(n.options,t);n.bind(n.events,t)},destroy:function(){var e=this;e.element.removeData("kendo"+e.options.prefix+e.options.name);e.element.removeData("handler");e.unbind()}});t.notify=a;var lt=/template$/i,ct=/^\s*(?:\{(?:.|\r\n|\n)*\}|\[(?:.|\r\n|\n)*\])\s*$/,dt=/^\{(\d+)(:[^\}]+)?\}/,pt=/([A-Z])/g;function mt(e,r){var i;if(r.indexOf("data")===0){r=r.substring(4);r=r.charAt(0).toLowerCase()+r.substring(1)}r=r.replace(pt,"-$1");i=e.getAttribute("data-"+t.ns+r);if(i===null){i=undefined}else if(i==="null"){i=null}else if(i==="true"){i=true}else if(i==="false"){i=false}else if(h.test(i)){i=parseFloat(i)}else if(ct.test(i)&&!dt.test(i)){i=n("("+i+")")}return i}function ht(n,r){var i={},o,s;for(o in r){s=mt(n,o);if(s!==undefined){if(lt.test(o)){s=t.template(e("#"+s).html())}i[o]=s}}return i}t.initWidget=function(n,r,i){var o,s,a,u,f,l,c,d;if(!i){i=t.ui.roles}else if(i.roles){i=i.roles}n=n.nodeType?n:n[0];l=n.getAttribute("data-"+t.ns+"role");if(!l){return}if(l.indexOf(".")===-1){a=i[l]}else{a=t.getter(l)(window)}if(!a){return}d=mt(n,"dataSource");r=e.extend({},ht(n,a.fn.options),r);if(d){if(typeof d===v){r.dataSource=t.getter(d)(window)}else{r.dataSource=d}}for(u=0,f=a.fn.events.length;u<f;u++){s=a.fn.events[u];c=mt(n,s);if(c!==undefined){r[s]=t.getter(c)(window)}}o=e(n).data("kendo"+a.fn.options.prefix+a.fn.options.name);if(!o){o=new a(n,r)}else{o.setOptions(r)}return o};t.rolesFromNamespaces=function(e){var n=[],i,o;if(!e[0]){e=[t.ui,t.dataviz.ui]}for(i=0,o=e.length;i<o;i++){n[i]=e[i].roles}return r.apply(null,[{}].concat(n.reverse()))};t.init=function(n){var r=t.rolesFromNamespaces(O.call(arguments,1));e(n).find("[data-"+t.ns+"role]").andSelf().each(function(){t.initWidget(this,{},r)})};t.destroy=function(n){e(n).find("[data-"+t.ns+"role]").andSelf().each(function(){var n=e(this),r=t.widgetInstance(n,t.ui)||t.widgetInstance(n,t.mobile.ui)||t.widgetInstance(n,t.dataviz.ui);if(r){r.destroy()}})};t.parseOptions=ht;r(t.ui,{Widget:ft,roles:{},progress:function(n,r){var i=n.find(".k-loading-mask"),o=t.support,s=o.browser,a,u,f,l;if(r){if(!i.length){a=o.isRtl(n);u=a?"right":"left";l=n.scrollLeft();f=s.webkit?!a?0:n[0].scrollWidth-n.width()-2*l:0;i=e("<div class='k-loading-mask'><span class='k-loading-text'>Loading...</span><div class='k-loading-image'/><div class='k-loading-color'/></div>").width("100%").height("100%").css("top",n.scrollTop()).css(u,Math.abs(l)+f).prependTo(n)}}else if(i){i.remove()}},plugin:function(n,r,i){var o=n.fn.options.name,s;r=r||t.ui;i=i||"";r[o]=n;r.roles[o.toLowerCase()]=n;s="getKendo"+i+o;o="kendo"+i+o;e.fn[o]=function(r){var i=this,s;if(typeof r===v){s=O.call(arguments,1);this.each(function(){var n=e.data(this,o),a,u;if(!n){throw new Error(t.format("Cannot call method '{0}' of {1} before it is initialized",r,o))}a=n[r];if(typeof a!==g){throw new Error(t.format("Cannot find method '{0}' of {1}",r,o))}u=a.apply(n,s);if(u!==undefined){i=u;return false}})}else{this.each(function(){new n(this,r)})}return i};e.fn[s]=function(){return this.data(o)}}});var gt={bind:function(){return this}};var vt=ft.extend({init:function(e,t){ft.fn.init.call(this,e,t);this.element.autoApplyNS();this.wrapper=this.element;this.element.addClass("km-widget")
},destroy:function(){ft.fn.destroy.call(this);this.element.kendoDestroy()},options:{prefix:"Mobile"},events:[],view:function(){var e=this.element.closest(t.roleSelector("view splitview modalview drawer"));return t.widgetInstance(e,t.mobile.ui)},container:function(){var e=this.element.closest(t.roleSelector("view layout modalview drawer"));return t.widgetInstance(e,t.mobile.ui)||gt}});r(t.mobile,{init:function(e){t.init(e,t.mobile.ui,t.ui,t.dataviz.ui)},ui:{Widget:vt,roles:{},plugin:function(e){t.ui.plugin(e,t.mobile.ui,"Mobile")}}});t.touchScroller=function(n,r){return e(n).map(function(n,i){i=e(i);if(c.kineticScrollNeeded&&t.mobile.ui.Scroller&&!i.data("kendoMobileScroller")){i.kendoMobileScroller(r);return i.data("kendoMobileScroller")}else{return false}})[0]};t.preventDefault=function(e){e.preventDefault()};t.widgetInstance=function(e,n){var r=n.roles[e.data(t.ns+"role")];if(r){return e.data("kendo"+r.fn.options.prefix+r.fn.options.name)}};t.onResize=function(t){var n=t;if(c.mobileOS.android){n=function(){setTimeout(t,600)}}e(window).on(c.resize,n);return n};t.unbindResize=function(t){e(window).off(c.resize,t)};t.attrValue=function(e,n){return e.data(t.ns+n)};t.days={Sunday:0,Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6};function yt(e,t){var n=e.nodeName.toLowerCase();return(/input|select|textarea|button|object/.test(n)?!e.disabled:"a"===n?e.href||t:t)&&wt(e)}function wt(t){return!e(t).parents().andSelf().filter(function(){return e.css(this,"visibility")==="hidden"||e.expr.filters.hidden(this)}).length}e.extend(e.expr[":"],{focusable:function(t){var n=e.attr(t,"tabindex");return yt(t,!isNaN(n)&&n>-1)}});var bt=["mousedown","mousemove","mouseenter","mouseleave","mouseover","mouseout","mouseup","click"];var Mt="label, input, [data-rel=external]";var St={setupMouseMute:function(){var t=0,n=bt.length,r=document.documentElement;if(St.mouseTrap||!c.eventCapture){return}St.mouseTrap=true;St.bustClick=false;St.captureMouse=false;var i=function(t){if(St.captureMouse){if(t.type==="click"){if(St.bustClick&&!e(t.target).is(Mt)){t.preventDefault();t.stopPropagation()}}else{t.stopPropagation()}}};for(;t<n;t++){r.addEventListener(bt[t],i,true)}},muteMouse:function(e){St.captureMouse=true;if(e.data.bustClick){St.bustClick=true}clearTimeout(St.mouseTrapTimeoutID)},unMuteMouse:function(){clearTimeout(St.mouseTrapTimeoutID);St.mouseTrapTimeoutID=setTimeout(function(){St.captureMouse=false;St.bustClick=false},400)}};var Tt={down:"touchstart mousedown",move:"mousemove touchmove",up:"mouseup touchend touchcancel",cancel:"mouseleave touchcancel"};if(c.touch&&(c.mobileOS.ios||c.mobileOS.android)){Tt={down:"touchstart",move:"touchmove",up:"touchend touchcancel",cancel:"touchcancel"}}else if(c.pointers){Tt={down:"pointerdown",move:"pointermove",up:"pointerup",cancel:"pointercancel pointerleave"}}else if(c.msPointers){Tt={down:"MSPointerDown",move:"MSPointerMove",up:"MSPointerUp",cancel:"MSPointerCancel MSPointerLeave"}}if(c.msPointers&&!("onmspointerenter"in window)){e.each({MSPointerEnter:"MSPointerOver",MSPointerLeave:"MSPointerOut"},function(t,n){e.event.special[t]={delegateType:n,bindType:n,handle:function(t){var r,i=this,o=t.relatedTarget,s=t.handleObj;if(!o||o!==i&&!e.contains(i,o)){t.type=s.origType;r=s.handler.apply(this,arguments);t.type=n}return r}}})}var xt=function(e){return Tt[e]||e},Ot=/([^ ]+)/g;t.applyEventMap=function(e,t){e=e.replace(Ot,xt);if(t){e=e.replace(Ot,"$1."+t)}return e};var Dt=e.fn.on;function kt(e,t){return new kt.fn.init(e,t)}r(true,kt,e);kt.fn=kt.prototype=new e;kt.fn.constructor=kt;kt.fn.init=function(t,n){if(n&&n instanceof e&&!(n instanceof kt)){n=kt(n)}return e.fn.init.call(this,t,n,Ct)};kt.fn.init.prototype=kt.fn;var Ct=kt(document);r(kt.fn,{handler:function(e){this.data("handler",e);return this},autoApplyNS:function(e){this.data("kendoNS",e||t.guid());return this},on:function(){var e=this,n=e.data("kendoNS");if(arguments.length===1){return Dt.call(e,arguments[0])}var r=e,i=O.call(arguments);if(typeof i[i.length-1]===S){i.pop()}var o=i[i.length-1],s=t.applyEventMap(i[0],n);if(c.mouseAndTouchPresent&&s.search(/mouse|click/)>-1&&this[0]!==document.documentElement){St.setupMouseMute();var a=i.length===2?null:i[1],u=s.indexOf("click")>-1&&s.indexOf("touchend")>-1;Dt.call(this,{touchstart:St.muteMouse,touchend:St.unMuteMouse},a,{bustClick:u})}if(typeof o===v){r=e.data("handler");o=r[o];i[i.length-1]=function(e){o.call(r,e)}}i[0]=s;Dt.apply(e,i);return e},kendoDestroy:function(e){e=e||this.data("kendoNS");if(e){this.off("."+e)}return this}});t.jQuery=kt;t.eventMap=Tt;t.timezone=function(){var e={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};var t={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};function n(n,r){var i;var o;var s;var a=r[3];var u=r[4];var f=r[5];var l=r[8];if(!l){r[8]=l={}}if(l[n]){return l[n]}if(!isNaN(u)){i=new Date(Date.UTC(n,e[a],u,f[0],f[1],f[2],0))}else if(u.indexOf("last")===0){i=new Date(Date.UTC(n,e[a]+1,1,f[0]-24,f[1],f[2],0));o=t[u.substr(4,3)];s=i.getUTCDay();i.setUTCDate(i.getUTCDate()+o-s-(o>s?7:0))}else if(u.indexOf(">=")>=0){i=new Date(Date.UTC(n,e[a],u.substr(5),f[0],f[1],f[2],0));o=t[u.substr(0,3)];s=i.getUTCDay();i.setUTCDate(i.getUTCDate()+o-s+(o<s?7:0))}return l[n]=i}function r(e,t,r){t=t[r];if(!t){var i=r.split(":");var o=0;if(i.length>1){o=i[0]*60+Number(i[1])}return[-1e6,"max","-","Jan",1,[0,0,0],o,"-"]}var s=new Date(e).getUTCFullYear();t=jQuery.grep(t,function(e){var t=e[0];var n=e[1];return t<=s&&(n>=s||t==s&&n=="only"||n=="max")});t.push(e);t.sort(function(e,t){if(typeof e!="number"){e=Number(n(s,e))}if(typeof t!="number"){t=Number(n(s,t))}return e-t});return t[jQuery.inArray(e,t)-1]}function i(e,t,n){t=t[n];if(!t){throw new Error('Timezone "'+n+'" is either incorrect, or kendo.timezones.min.js is not included.')}for(var r=t.length-1;r>=0;r--){var i=t[r][3];if(i&&e>i){break}}var o=t[r+1];if(!o){throw new Error('Timezone "'+n+'" not found on '+e+".")}return o}function o(e,t,n,o){if(typeof e!=y){e=Date.UTC(e.getFullYear(),e.getMonth(),e.getDate(),e.getHours(),e.getMinutes(),e.getSeconds(),e.getMilliseconds())}var s=i(e,t,o);return{zone:s,rule:r(e,n,s[1])}}function s(e,t){if(t=="Etc/UTC"||t=="Etc/GMT"){return 0}var n=o(e,this.zones,this.rules,t);var r=n.zone;var i=n.rule;return i?r[0]-i[6]:r[0]}function a(e,t){var n=o(e,this.zones,this.rules,t);var r=n.zone;var i=n.rule;var s=r[2];if(s.indexOf("/")>=0){return s.split("/")[i&&i[6]?1:0]}else if(s.indexOf("%s")>=0){return s.replace("%s",!i||i[7]=="-"?"":i[7])}return s}function u(e,t,n){if(typeof t==v){t=this.offset(e,t)}if(typeof n==v){n=this.offset(e,n)}var r=e.getTimezoneOffset();e=new Date(e.getTime()+(t-n)*6e4);var i=e.getTimezoneOffset();return new Date(e.getTime()+(i-r)*6e4)}function f(e,t){return this.convert(e,e.getTimezoneOffset(),t)}function l(e,t){return this.convert(e,t,e.getTimezoneOffset())}return{zones:{},rules:{},offset:s,convert:u,apply:f,remove:l,abbr:a}}();t.date=function(){var e=6e4,t=864e5;function n(e,t){if(t===0&&e.getHours()===23){e.setHours(e.getHours()+2);return true}return false}function r(e,t,r){var i=e.getHours();r=r||1;t=(t-e.getDay()+7*r)%7;e.setDate(e.getDate()+t);n(e,i)}function i(e,t,n){e=new Date(e);r(e,t,n);return e}function o(e){return new Date(e.getFullYear(),e.getMonth(),1)}function s(e){var t=new Date(e.getFullYear(),e.getMonth()+1,0),n=o(e),r=Math.abs(t.getTimezoneOffset()-n.getTimezoneOffset());if(r){t.setHours(n.getHours()+r/60)}return t}function a(e){e=new Date(e.getFullYear(),e.getMonth(),e.getDate(),0,0,0);n(e,0);return e}function u(e){return Date.UTC(e.getFullYear(),e.getMonth(),e.getDate(),e.getHours(),e.getMinutes(),e.getSeconds(),e.getMilliseconds())}function f(e){return e.getTime()-a(e)}function l(e,n,r){var i=f(n),o=f(r),s;if(!e||i==o){return true}if(n>=r){r+=t}s=f(e);if(i>s){s+=t}if(o<i){o+=t}return s>=i&&s<=o}function c(e,n,r){var i=n.getTime(),o=r.getTime(),s;if(i>=o){o+=t}s=e.getTime();return s>=i&&s<=o}function d(e,r){var i=e.getHours();e=new Date(e);p(e,r*t);n(e,i);return e}function p(t,n,r){var i=t.getTimezoneOffset();var o;t.setTime(t.getTime()+n);if(!r){o=t.getTimezoneOffset()-i;t.setTime(t.getTime()+o*e)}}function m(){return a(new Date)}function h(e){return a(e).getTime()==m().getTime()}function g(e){var t=new Date(1980,1,1,0,0,0);if(e){t.setHours(e.getHours(),e.getMinutes(),e.getSeconds(),e.getMilliseconds())}return t}return{adjustDST:n,dayOfWeek:i,setDayOfWeek:r,getDate:a,isInDateRange:c,isInTimeRange:l,isToday:h,nextDay:function(e){return d(e,1)},previousDay:function(e){return d(e,-1)},toUtcTime:u,MS_PER_DAY:t,MS_PER_MINUTE:e,setTime:p,addDays:d,today:m,toInvariantTime:g,firstDayOfMonth:o,lastDayOfMonth:s,getMilliseconds:f}}();t.stripWhitespace=function(e){var t=document.createNodeIterator(e,NodeFilter.SHOW_TEXT,function(t){return t.parentNode==e?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT},false);while(t.nextNode()){if(t.referenceNode&&!t.referenceNode.textContent.trim()){t.referenceNode.parentNode.removeChild(t.referenceNode)}}};return t});
define('kendoui/kendo.jquery',["kendoui/kendo.core"],function(e){return e.jQuery});
define('kendoui/kendo.data',["kendoui/kendo.jquery","kendoui/kendo.core"],function(e,t){var r=e.extend,i=e.proxy,n=e.isFunction,a=e.isPlainObject,s=e.isEmptyObject,o=e.isArray,f=e.grep,u=e.ajax,l,d=e.each,c=e.noop,h=t.Observable,g=t.Class,p="string",_="function",v="create",m="read",y="update",S="destroy",w="change",b="sync",k="get",x="error",q="requestStart",C="progress",z="requestEnd",O=[v,m,y,S],F=function(e){return e},R=t.getter,T=t.stringify,P=Math,A=[].push,D=[].join,M=[].pop,N=[].splice,j=[].shift,I=[].slice,B=[].unshift,G={}.toString,L=t.support.stableSort,E=/^\/Date\((.*?)\)\/$/,H=/(\r+|\n+)/g,J=/(?=['\\])/g;var U=h.extend({init:function(e,t){var r=this;r.type=t||W;h.fn.init.call(r);r.length=e.length;r.wrapAll(e,r)},toJSON:function(){var e,t=this.length,r,i=new Array(t);for(e=0;e<t;e++){r=this[e];if(r instanceof W){r=r.toJSON()}i[e]=r}return i},parent:c,wrapAll:function(e,t){var r=this,i,n,a=function(){return r};t=t||[];for(i=0,n=e.length;i<n;i++){t[i]=r.wrap(e[i],a)}return t},wrap:function(e,t){var r=this,i;if(e!==null&&G.call(e)==="[object Object]"){i=e instanceof r.type||e instanceof Y;if(!i){e=e instanceof W?e.toJSON():e;e=new r.type(e)}e.parent=t;e.bind(w,function(e){r.trigger(w,{field:e.field,node:e.node,index:e.index,items:e.items||[this],action:e.node?e.action||"itemchange":"itemchange"})})}return e},push:function(){var e=this.length,t=this.wrapAll(arguments),r;r=A.apply(this,t);this.trigger(w,{action:"add",index:e,items:t});return r},slice:I,join:D,pop:function(){var e=this.length,t=M.apply(this);if(e){this.trigger(w,{action:"remove",index:e-1,items:[t]})}return t},splice:function(e,t,r){var i=this.wrapAll(I.call(arguments,2)),n,a,s;n=N.apply(this,[e,t].concat(i));if(n.length){this.trigger(w,{action:"remove",index:e,items:n});for(a=0,s=n.length;a<s;a++){if(n[a].children){n[a].unbind(w)}}}if(r){this.trigger(w,{action:"add",index:e,items:i})}return n},shift:function(){var e=this.length,t=j.apply(this);if(e){this.trigger(w,{action:"remove",index:0,items:[t]})}return t},unshift:function(){var e=this.wrapAll(arguments),t;t=B.apply(this,e);this.trigger(w,{action:"add",index:0,items:e});return t},indexOf:function(e){var t=this,r,i;for(r=0,i=t.length;r<i;r++){if(t[r]===e){return r}}return-1},forEach:function(e){var t=0,r=this.length;for(;t<r;t++){e(this[t],t,this)}},map:function(e){var t=0,r=[],i=this.length;for(;t<i;t++){r[t]=e(this[t],t,this)}return r},filter:function(e){var t=0,r=[],i,n=this.length;for(;t<n;t++){i=this[t];if(e(i,t,this)){r[r.length]=i}}return r},find:function(e){var t=0,r,i=this.length;for(;t<i;t++){r=this[t];if(e(r,t,this)){return r}}},every:function(e){var t=0,r,i=this.length;for(;t<i;t++){r=this[t];if(!e(r,t,this)){return false}}return true},some:function(e){var t=0,r,i=this.length;for(;t<i;t++){r=this[t];if(e(r,t,this)){return true}}return false},remove:function(e){this.splice(this.indexOf(e),1)}});function V(e,t,r,i){return function(n){var a={},s;for(s in n){a[s]=n[s]}if(i){a.field=r+"."+n.field}else{a.field=r}if(t==w&&e._notifyChange){e._notifyChange(a)}e.trigger(t,a)}}var W=h.extend({init:function(e){var r=this,i,n,a=function(){return r};h.fn.init.call(this);for(n in e){i=e[n];if(n.charAt(0)!="_"){i=r.wrap(i,n,a)}r[n]=i}r.uid=t.guid()},shouldSerialize:function(e){return this.hasOwnProperty(e)&&e!=="_events"&&typeof this[e]!==_&&e!=="uid"},forEach:function(e){for(var t in this){if(this.shouldSerialize(t)){e(this[t],t)}}},toJSON:function(){var e={},t,r;for(r in this){if(this.shouldSerialize(r)){t=this[r];if(t instanceof W||t instanceof U){t=t.toJSON()}e[r]=t}}return e},get:function(e){var r=this,i;r.trigger(k,{field:e});if(e==="this"){i=r}else{i=t.getter(e,true)(r)}return i},_set:function(e,r){var i=this;var n=e.indexOf(".")>=0;if(n){var a=e.split("."),s="";while(a.length>1){s+=a.shift();var o=t.getter(s,true)(i);if(o instanceof W){o.set(a.join("."),r);return n}s+="."}}t.setter(e)(i,r);return n},set:function(e,r){var i=this,n=t.getter(e,true)(i);if(n!==r){if(!i.trigger("set",{field:e,value:r})){if(!i._set(e,i.wrap(r,e,function(){return i}))||e.indexOf("(")>=0||e.indexOf("[")>=0){i.trigger(w,{field:e})}}}},parent:c,wrap:function(e,t,r){var i=this,n=G.call(e);if(e!=null&&(n==="[object Object]"||n==="[object Array]")){var a=e instanceof U;var s=e instanceof Mt;if(n==="[object Object]"&&!s&&!a){if(!(e instanceof W)){e=new W(e)}if(e.parent()!=r()){e.bind(k,V(i,k,t,true));e.bind(w,V(i,w,t,true))}}else if(n==="[object Array]"||a||s){if(!a&&!s){e=new U(e)}if(e.parent()!=r()){e.bind(w,V(i,w,t,false))}}e.parent=r}return e}});function Q(t,r){if(t===r){return true}var i=e.type(t),n=e.type(r),a;if(i!==n){return false}if(i==="date"){return t.getTime()===r.getTime()}if(i!=="object"&&i!=="array"){return false}for(a in t){if(!Q(t[a],r[a])){return false}}return true}var $={number:function(e){return t.parseFloat(e)},date:function(e){return t.parseDate(e)},"boolean":function(e){if(typeof e===p){return e.toLowerCase()==="true"}return e!=null?!!e:e},string:function(e){return e!=null?e+"":e},"default":function(e){return e}};var K={string:"",number:0,date:new Date,"boolean":false,"default":""};function X(e,t){var r,i;for(i in e){r=e[i];if(a(r)&&r.field&&r.field===t){return r}else if(r===t){return r}}return null}var Y=W.extend({init:function(t){var r=this;if(!t||e.isEmptyObject(t)){t=e.extend({},r.defaults,t)}W.fn.init.call(r,t);r.dirty=false;if(r.idField){r.id=r.get(r.idField);if(r.id===undefined){r.id=r._defaultId}}},shouldSerialize:function(e){return W.fn.shouldSerialize.call(this,e)&&e!=="uid"&&!(this.idField!=="id"&&e==="id")&&e!=="dirty"&&e!=="_accessors"},_parse:function(e,t){var r=this,i=e,n=r.fields||{},a;e=n[e];if(!e){e=X(n,i)}if(e){a=e.parse;if(!a&&e.type){a=$[e.type.toLowerCase()]}}return a?a(t):t},_notifyChange:function(e){var t=e.action;if(t=="add"||t=="remove"){this.dirty=true}},editable:function(e){e=(this.fields||{})[e];return e?e.editable!==false:true},set:function(e,t,r){var i=this;if(i.editable(e)){t=i._parse(e,t);if(!Q(t,i.get(e))){i.dirty=true;W.fn.set.call(i,e,t,r)}}},accept:function(e){var t=this,r=function(){return t},i;for(i in e){t._set(i,t.wrap(e[i],i,r))}if(t.idField){t.id=t.get(t.idField)}t.dirty=false},isNew:function(){return this.id===this._defaultId}});Y.define=function(e,t){if(t===undefined){t=e;e=Y}var i,n=r({defaults:{}},t),a,s,o,f,u,l,d={},c,h=n.id;if(h){n.idField=h}if(n.id){delete n.id}if(h){n.defaults[h]=n._defaultId=""}if(G.call(n.fields)==="[object Array]"){for(u=0,l=n.fields.length;u<l;u++){s=n.fields[u];if(typeof s===p){d[s]={}}else if(s.field){d[s.field]=s}}n.fields=d}for(a in n.fields){s=n.fields[a];o=s.type||"default";f=null;c=a;a=typeof s.field===p?s.field:a;if(!s.nullable){f=n.defaults[c!==a?c:a]=s.defaultValue!==undefined?s.defaultValue:K[o.toLowerCase()]}if(t.id===a){n._defaultId=f}n.defaults[c!==a?c:a]=f;s.parse=s.parse||$[o]}i=e.extend(n);i.define=function(e){return Y.define(i,e)};if(n.fields){i.fields=n.fields;i.idField=n.idField}return i};var Z={selector:function(e){return n(e)?e:R(e)},compare:function(e){var t=this.selector(e);return function(e,r){e=t(e);r=t(r);if(e==null&&r==null){return 0}if(e==null){return-1}if(r==null){return 1}if(e.localeCompare){return e.localeCompare(r)}return e>r?1:e<r?-1:0}},create:function(e){var t=e.compare||this.compare(e.field);if(e.dir=="desc"){return function(e,r){return t(r,e,true)}}return t},combine:function(e){return function(t,r){var i=e[0](t,r),n,a;for(n=1,a=e.length;n<a;n++){i=i||e[n](t,r)}return i}}};var et=r({},Z,{asc:function(e){var t=this.selector(e);return function(e,r){var i=t(e);var n=t(r);if(i&&i.getTime&&n&&n.getTime){i=i.getTime();n=n.getTime()}if(i===n){return e.__position-r.__position}if(i==null){return-1}if(n==null){return 1}if(i.localeCompare){return i.localeCompare(n)}return i>n?1:-1}},desc:function(e){var t=this.selector(e);return function(e,r){var i=t(e);var n=t(r);if(i&&i.getTime&&n&&n.getTime){i=i.getTime();n=n.getTime()}if(i===n){return e.__position-r.__position}if(i==null){return 1}if(n==null){return-1}if(n.localeCompare){return n.localeCompare(i)}return i<n?1:-1}},create:function(e){return this[e.dir](e.field)}});l=function(e,t){var r,i=e.length,n=new Array(i);for(r=0;r<i;r++){n[r]=t(e[r],r,e)}return n};var tt=function(){function e(e){return e.replace(J,"\\").replace(H,"")}function t(t,r,i,n){var a;if(i!=null){if(typeof i===p){i=e(i);a=E.exec(i);if(a){i=new Date(+a[1])}else if(n){i="'"+i.toLowerCase()+"'";r="("+r+" || '').toLowerCase()"}else{i="'"+i+"'"}}if(i.getTime){r="("+r+"?"+r+".getTime():"+r+")";i=i.getTime()}}return r+" "+t+" "+i}return{eq:function(e,r,i){return t("==",e,r,i)},neq:function(e,r,i){return t("!=",e,r,i)},gt:function(e,r,i){return t(">",e,r,i)},gte:function(e,r,i){return t(">=",e,r,i)},lt:function(e,r,i){return t("<",e,r,i)},lte:function(e,r,i){return t("<=",e,r,i)},startswith:function(t,r,i){if(i){t="("+t+" || '').toLowerCase()";if(r){r=r.toLowerCase()}}if(r){r=e(r)}return t+".lastIndexOf('"+r+"', 0) == 0"},endswith:function(t,r,i){if(i){t="("+t+" || '').toLowerCase()";if(r){r=r.toLowerCase()}}if(r){r=e(r)}return t+".indexOf('"+r+"', "+t+".length - "+(r||"").length+") >= 0"},contains:function(t,r,i){if(i){t="("+t+" || '').toLowerCase()";if(r){r=r.toLowerCase()}}if(r){r=e(r)}return t+".indexOf('"+r+"') >= 0"},doesnotcontain:function(t,r,i){if(i){t="("+t+" || '').toLowerCase()";if(r){r=r.toLowerCase()}}if(r){r=e(r)}return t+".indexOf('"+r+"') == -1"}}}();function rt(e){this.data=e||[]}rt.filterExpr=function(e){var r=[],i={and:" && ",or:" || "},n,a,s,o,f=[],u=[],l,d,c=e.filters;for(n=0,a=c.length;n<a;n++){s=c[n];l=s.field;d=s.operator;if(s.filters){o=rt.filterExpr(s);s=o.expression.replace(/__o\[(\d+)\]/g,function(e,t){t=+t;return"__o["+(u.length+t)+"]"}).replace(/__f\[(\d+)\]/g,function(e,t){t=+t;return"__f["+(f.length+t)+"]"});u.push.apply(u,o.operators);f.push.apply(f,o.fields)}else{if(typeof l===_){o="__f["+f.length+"](d)";f.push(l)}else{o=t.expr(l)}if(typeof d===_){s="__o["+u.length+"]("+o+", "+s.value+")";u.push(d)}else{s=tt[(d||"eq").toLowerCase()](o,s.value,s.ignoreCase!==undefined?s.ignoreCase:true)}}r.push(s)}return{expression:"("+r.join(i[e.logic])+")",fields:f,operators:u}};function it(e,t){if(e){var r=typeof e===p?{field:e,dir:t}:e,i=o(r)?r:r!==undefined?[r]:[];return f(i,function(e){return!!e.dir})}}var nt={"==":"eq",equals:"eq",isequalto:"eq",equalto:"eq",equal:"eq","!=":"neq",ne:"neq",notequals:"neq",isnotequalto:"neq",notequalto:"neq",notequal:"neq","<":"lt",islessthan:"lt",lessthan:"lt",less:"lt","<=":"lte",le:"lte",islessthanorequalto:"lte",lessthanequal:"lte",">":"gt",isgreaterthan:"gt",greaterthan:"gt",greater:"gt",">=":"gte",isgreaterthanorequalto:"gte",greaterthanequal:"gte",ge:"gte",notsubstringof:"doesnotcontain"};function at(e){var t,r,i,n,a=e.filters;if(a){for(t=0,r=a.length;t<r;t++){i=a[t];n=i.operator;if(n&&typeof n===p){i.operator=nt[n.toLowerCase()]||n}at(i)}}}function st(e){if(e&&!s(e)){if(o(e)||!e.filters){e={logic:"and",filters:o(e)?e:[e]}}at(e);return e}}rt.normalizeFilter=st;function ot(e){return o(e)?e:[e]}function ft(e,t){var r=typeof e===p?{field:e,dir:t}:e,i=o(r)?r:r!==undefined?[r]:[];return l(i,function(e){return{field:e.field,dir:e.dir||"asc",aggregates:e.aggregates}})}rt.prototype={toArray:function(){return this.data},range:function(e,t){return new rt(this.data.slice(e,e+t))},skip:function(e){return new rt(this.data.slice(e))},take:function(e){return new rt(this.data.slice(0,e))},select:function(e){return new rt(l(this.data,e))},order:function(e,t){var r={dir:t};if(e){if(e.compare){r.compare=e.compare}else{r.field=e}}return new rt(this.data.slice(0).sort(Z.create(r)))},orderBy:function(e){return this.order(e,"asc")},orderByDescending:function(e){return this.order(e,"desc")},sort:function(e,t,r){var i,n,a=it(e,t),s=[];r=r||Z;if(a.length){for(i=0,n=a.length;i<n;i++){s.push(r.create(a[i]))}return this.orderBy({compare:r.combine(s)})}return this},filter:function(e){var t,r,i,n,a,s=this.data,o,f,u=[],l;e=st(e);if(!e||e.filters.length===0){return this}n=rt.filterExpr(e);o=n.fields;f=n.operators;a=l=new Function("d, __f, __o","return "+n.expression);if(o.length||f.length){l=function(e){return a(e,o,f)}}for(t=0,i=s.length;t<i;t++){r=s[t];if(l(r)){u.push(r)}}return new rt(u)},group:function(e,t){e=ft(e||[]);t=t||this.data;var r=this,i=new rt(r.data),n;if(e.length>0){n=e[0];i=i.groupBy(n).select(function(r){var i=new rt(t).filter([{field:r.field,operator:"eq",value:r.value,ignoreCase:false}]);return{field:r.field,value:r.value,items:e.length>1?new rt(r.items).group(e.slice(1),i.toArray()).toArray():r.items,hasSubgroups:e.length>1,aggregates:i.aggregate(n.aggregates)}})}return i},groupBy:function(e){if(s(e)||!this.data.length){return new rt([])}var r=e.field,i=this._sortForGrouping(r,e.dir||"asc"),n=t.accessor(r),a,o=n.get(i[0],r),f={field:r,value:o,items:[]},u,l,d,c=[f];for(l=0,d=i.length;l<d;l++){a=i[l];u=n.get(a,r);if(!ut(o,u)){o=u;f={field:r,value:o,items:[]};c.push(f)}f.items.push(a)}return new rt(c)},_sortForGrouping:function(e,t){var r,i,n=this.data;if(!L){for(r=0,i=n.length;r<i;r++){n[r].__position=r}n=new rt(n).sort(e,t,et).toArray();for(r=0,i=n.length;r<i;r++){delete n[r].__position}return n}return this.sort(e,t).toArray()},aggregate:function(e){var t,r,i={};if(e&&e.length){for(t=0,r=this.data.length;t<r;t++){lt(i,e,this.data[t],t,r)}}return i}};function ut(e,t){if(e&&e.getTime&&t&&t.getTime){return e.getTime()===t.getTime()}return e===t}function lt(e,r,i,n,a){r=r||[];var s,o,f,u=r.length;for(s=0;s<u;s++){o=r[s];f=o.aggregate;var l=o.field;e[l]=e[l]||{};e[l][f]=dt[f.toLowerCase()](e[l][f],i,t.accessor(l),n,a)}}var dt={sum:function(e,t,r){return(e||0)+r.get(t)},count:function(e){return(e||0)+1},average:function(e,t,r,i,n){e=(e||0)+r.get(t);if(i==n-1){e=e/n}return e},max:function(e,t,r){var i=r.get(t);e=e||0;if(e<i){e=i}return e},min:function(e,t,r){var i=r.get(t);if(!ct(e)){e=i}if(e>i&&ct(i)){e=i}return e}};function ct(e){return typeof e==="number"&&!isNaN(e)}function ht(e){var t,r=e.length,i=new Array(r);for(t=0;t<r;t++){i[t]=e[t].toJSON()}return i}rt.process=function(e,t){t=t||{};var r=new rt(e),i=t.group,n=ft(i||[]).concat(it(t.sort||[])),a,s=t.filter,o=t.skip,f=t.take;if(s){r=r.filter(s);a=r.toArray().length}if(n){r=r.sort(n);if(i){e=r.toArray()}}if(o!==undefined&&f!==undefined){r=r.range(o,f)}if(i){r=r.group(i,e)}return{total:a,data:r.toArray()}};function gt(e,t){t=t||{};var r=new rt(e),i=t.aggregate,n=t.filter;if(n){r=r.filter(n)}return r.aggregate(i)}var pt=g.extend({init:function(e){this.data=e.data},read:function(e){e.success(this.data)},update:function(e){e.success(e.data)},create:function(e){e.success(e.data)},destroy:function(e){e.success(e.data)}});var _t=g.extend({init:function(e){var t=this,i;e=t.options=r({},t.options,e);d(O,function(t,r){if(typeof e[r]===p){e[r]={url:e[r]}}});t.cache=e.cache?vt.create(e.cache):{find:c,add:c};i=e.parameterMap;t.parameterMap=n(i)?i:function(e){var t={};d(e,function(e,r){if(e in i){e=i[e];if(a(e)){r=e.value(r);e=e.key}}t[e]=r});return t}},options:{parameterMap:F},create:function(e){return u(this.setup(e,v))},read:function(t){var r=this,i,n,a,s=r.cache;t=r.setup(t,m);i=t.success||c;n=t.error||c;a=s.find(t.data);if(a!==undefined){i(a)}else{t.success=function(e){s.add(t.data,e);i(e)};e.ajax(t)}},update:function(e){return u(this.setup(e,y))},destroy:function(e){return u(this.setup(e,S))},setup:function(e,t){e=e||{};var i=this,a,s=i.options[t],o=n(s.data)?s.data(e.data):s.data;e=r(true,{},s,e);a=r(true,{},o,e.data);e.data=i.parameterMap(a,t);if(n(e.url)){e.url=e.url(a)}return e}});var vt=g.extend({init:function(){this._store={}},add:function(e,t){if(e!==undefined){this._store[T(e)]=t}},find:function(e){return this._store[T(e)]},clear:function(){this._store={}},remove:function(e){delete this._store[T(e)]}});vt.create=function(e){var t={inmemory:function(){return new vt}};if(a(e)&&n(e.find)){return e}if(e===true){return new vt}return t[e]()};function mt(e,t,r,i,n){var a,s,o,f,u;for(f=0,u=e.length;f<u;f++){a=e[f];for(s in t){o=n[s];if(o&&o!==s){a[o]=t[s](a);delete a[s]}}}}function yt(e,t,r,i,n){var a,s,o,f,u;for(f=0,u=e.length;f<u;f++){a=e[f];for(s in t){a[s]=r._parse(s,t[s](a));o=n[s];if(o&&o!==s){delete a[o]}}}}function St(e,t,r,i,n){var a,s,o,f;for(s=0,f=e.length;s<f;s++){a=e[s];o=i[a.field];if(o&&o!=a.field){a.field=o}a.value=r._parse(a.field,a.value);if(a.hasSubgroups){St(a.items,t,r,i,n)}else{yt(a.items,t,r,i,n)}}}function wt(e,t,r,i,n,a){return function(o){o=e(o);if(o&&!s(i)){if(G.call(o)!=="[object Array]"&&!(o instanceof U)){o=[o]}r(o,i,new t,n,a)}return o||[]}}var bt=g.extend({init:function(e){var t=this,r,n,s,o;e=e||{};for(r in e){n=e[r];t[r]=typeof n===p?R(n):n}o=e.modelBase||Y;if(a(t.model)){t.model=s=o.define(t.model)}if(t.model){var f=i(t.data,t),u=i(t.groups,t),l=i(t.serialize,t),c={},h={},g={},_={},v=false,m;s=t.model;if(s.fields){d(s.fields,function(e,t){var r;m=e;if(a(t)&&t.field){m=t.field}else if(typeof t===p){m=t}if(a(t)&&t.from){r=t.from}v=v||r&&r!==e||m!==e;h[e]=R(r||m);g[e]=R(e);c[r||m]=e;_[e]=r||m});if(!e.serialize&&v){t.serialize=wt(l,s,mt,g,c,_)}}t.data=wt(f,s,yt,h,c,_);t.groups=wt(u,s,St,h,c,_)}},errors:function(e){return e?e.errors:null},parse:F,data:F,total:function(e){return e.length},groups:F,aggregates:function(){return{}},serialize:function(e){return e}});function kt(e,t,r,i){var n,a=0,s;while(t.length&&i){n=t[a];s=n.items;if(e&&e.field===n.field&&e.value===n.value){if(e.hasSubgroups&&e.items.length){kt(e.items[e.items.length-1],n.items,r,i)}else{s=s.slice(r,i);i-=s.length;e.items=e.items.concat(s)}t.splice(a--,1)}else{s=s.slice(r,i);i-=s.length;n.items=s;if(!n.items.length){t.splice(a--,1);i-=r}}r=0;if(++a>=t.length){break}}if(a<t.length){t.splice(a,t.length-a)}}function xt(e){var t,r,i=[];for(t=0,r=e.length;t<r;t++){if(e[t].hasSubgroups){i=i.concat(xt(e[t].items))}else{i=i.concat(e[t].items.slice())}}return i}function qt(e,t){var r,i,n,a;if(t){for(r=0,i=e.length;r<i;r++){n=e[r];a=n.items;if(n.hasSubgroups){qt(a,t)}else if(a.length&&!(a[0]instanceof t)){a.type=t;a.wrapAll(a,a)}}}}function Ct(e,t){var r,i;for(r=0,i=e.length;r<i;r++){if(e[r].hasSubgroups){if(Ct(e[r].items,t)){return true}}else if(t(e[r].items,e[r])){return true}}}function zt(e,t){var r,i;for(r=0,i=e.length;r<i;r++){if(e[r].uid==t.uid){t=e[r];e.splice(r,1);return t}}}function Ot(e,t){var r,i,n,a;for(n=e.length-1,a=0;n>=a;n--){i=e[n];r={value:t.get(i.field),field:i.field,items:r?[r]:[t],hasSubgroups:!!r,aggregates:{}}}return r}function Ft(e,t){if(t){return Tt(e,function(e){return e[t.idField]===t.id})}return-1}function Rt(e,t){if(t){return Tt(e,function(e){return e.uid==t.uid})}return-1}function Tt(e,t){var r,i;for(r=0,i=e.length;r<i;r++){if(t(e[r])){return r}}return-1}function Pt(e,t){if(e&&!s(e)){var r=e[t];var i;if(a(r)){i=r.from||r.field||t}else{i=e[t]||t}if(n(i)){return t}return i}return t}function At(e,t){var r,i,n={};for(var a in e){if(a!=="filters"){n[a]=e[a]}}if(e.filters){n.filters=[];for(r=0,i=e.filters.length;r<i;r++){n.filters[r]=At(e.filters[r],t)}}else{n.field=Pt(t.fields,n.field)}return n}function Dt(e,t){var r,i,n=[],a,s;for(r=0,i=e.length;r<i;r++){a={};s=e[r];for(var f in s){a[f]=s[f]}a.field=Pt(t.fields,a.field);if(a.aggregates&&o(a.aggregates)){a.aggregates=Dt(a.aggregates,t)}n.push(a)}return n}var Mt=h.extend({init:function(e){var i=this,n,a;if(e){a=e.data}e=i.options=r({},i.options,e);i._map={};i._prefetch={};i._data=[];i._pristineData=[];i._ranges=[];i._view=[];i._pristine=[];i._destroyed=[];i._pageSize=e.pageSize;i._page=e.page||(e.pageSize?1:undefined);i._sort=it(e.sort);i._filter=st(e.filter);i._group=ft(e.group);i._aggregate=e.aggregate;i._total=e.total;h.fn.init.call(i);i.transport=Nt.create(e,a);i.reader=new t.data.readers[e.schema.type||"json"](e.schema);n=i.reader.model||{};i._data=i._observe(i._data);i.bind([x,w,q,b,z,C],e)},options:{data:[],schema:{modelBase:Y},serverSorting:false,serverPaging:false,serverFiltering:false,serverGrouping:false,serverAggregates:false,batch:false},_isServerGrouped:function(){var e=this.group()||[];return this.options.serverGrouping&&e.length},_flatData:function(e){if(this._isServerGrouped()){return xt(e)}return e},parent:c,get:function(e){var t,r,i=this._flatData(this._data);for(t=0,r=i.length;t<r;t++){if(i[t].id==e){return i[t]}}},getByUid:function(e){var t,r,i=this._flatData(this._data);if(!i){return}for(t=0,r=i.length;t<r;t++){if(i[t].uid==e){return i[t]}}},indexOf:function(e){return Rt(this._data,e)},at:function(e){return this._data[e]},data:function(e){var t=this;if(e!==undefined){t._data=this._observe(e);t._ranges=[];t._addRange(t._data);t._total=t._data.length;t._process(t._data)}else{return t._data}},view:function(){return this._view},add:function(e){return this.insert(this._data.length,e)},_createNewModel:function(e){if(this.reader.model){return new this.reader.model(e)}return new W(e)},insert:function(e,t){if(!t){t=e;e=0}if(!(t instanceof Y)){t=this._createNewModel(t)}if(this._isServerGrouped()){this._data.splice(e,0,Ot(this.group(),t))}else{this._data.splice(e,0,t)}return t},remove:function(e){var t,r=this,i=r._isServerGrouped();this._eachItem(r._data,function(n){t=zt(n,e);if(t&&i){if(!t.isNew||!t.isNew()){r._destroyed.push(t)}return true}});return e},sync:function(){var t=this,r,i,n=[],a=[],s=t._destroyed,o=t._flatData(t._data);if(!t.reader.model){return}for(r=0,i=o.length;r<i;r++){if(o[r].isNew()){n.push(o[r])}else if(o[r].dirty){a.push(o[r])}}var f=t._send("create",n);f.push.apply(f,t._send("update",a));f.push.apply(f,t._send("destroy",s));e.when.apply(null,f).then(function(){var e,r;for(e=0,r=arguments.length;e<r;e++){t._accept(arguments[e])}t._change({action:"sync"});t.trigger(b)})},cancelChanges:function(e){var r=this;if(e instanceof t.data.Model){r._cancelModel(e)}else{r._destroyed=[];r._data=r._observe(r._pristineData);if(r.options.serverPaging){r._total=r.reader.total(r._pristine)}r._change()}},hasChanges:function(){var e,t,r=this._data;if(this._destroyed.length){return true}for(e=0,t=r.length;e<t;e++){if(r[e].isNew()||r[e].dirty){return true}}return false},_accept:function(t){var r=this,i=t.models,n=t.response,a=0,o=r._isServerGrouped(),f=r._pristineData,u=t.type,l;r.trigger(z,{response:n,type:u});if(n&&!s(n)){n=r.reader.parse(n);if(r._handleCustomErrors(n)){return}n=r.reader.data(n);if(!e.isArray(n)){n=[n]}}else{n=e.map(i,function(e){return e.toJSON()})}if(u==="destroy"){r._destroyed=[]}for(a=0,l=i.length;a<l;a++){if(u!=="destroy"){i[a].accept(n[a]);if(u==="create"){f.push(o?Ot(r.group(),i[a]):n[a])}else if(u==="update"){r._updatePristineForModel(i[a],n[a])}}else{r._removePristineForModel(i[a])}}},_updatePristineForModel:function(e,r){this._executeOnPristineForModel(e,function(e,i){t.deepExtend(i[e],r)})},_executeOnPristineForModel:function(e,t){this._eachPristineItem(function(r){var i=Ft(r,e);if(i>-1){t(i,r);return true}})},_removePristineForModel:function(e){this._executeOnPristineForModel(e,function(e,t){t.splice(e,1)})},_readData:function(e){var t=!this._isServerGrouped()?this.reader.data:this.reader.groups;return t(e)},_eachPristineItem:function(e){this._eachItem(this._pristineData,e)},_eachItem:function(e,t){if(e&&e.length){if(this._isServerGrouped()){Ct(e,t)}else{t(e)}}},_pristineForModel:function(e){var t,r,i=function(i){r=Ft(i,e);if(r>-1){t=i[r];return true}};this._eachPristineItem(i);return t},_cancelModel:function(e){var t=this._pristineForModel(e),r;this._eachItem(this._data,function(i){r=Rt(i,e);if(r!=-1){if(!e.isNew()&&t){i[r].accept(t)}else{i.splice(r,1)}}})},_promise:function(t,i,n){var a=this,s=a.transport;return e.Deferred(function(e){a.trigger(q,{type:n});s[n].call(s,r({success:function(t){e.resolve({response:t,models:i,type:n})},error:function(t,r,i){e.reject(t);a.error(t,r,i)}},t))}).promise()},_send:function(e,t){var r=this,i,n,a=[],s=r.reader.serialize(ht(t));if(r.options.batch){if(t.length){a.push(r._promise({data:{models:s}},t,e))}}else{for(i=0,n=t.length;i<n;i++){a.push(r._promise({data:s[i]},[t[i]],e))}}return a},read:function(e){var t=this,r=t._params(e);t._queueRequest(r,function(){if(!t.trigger(q,{type:"read"})){t.trigger(C);t._ranges=[];t.transport.read({data:r,success:i(t.success,t),error:i(t.error,t)})}else{t._dequeueRequest()}})},success:function(t){var r=this,i=r.options;r.trigger(z,{response:t,type:"read"});t=r.reader.parse(t);if(r._handleCustomErrors(t)){r._dequeueRequest();return}r._pristine=a(t)?e.extend(true,{},t):t.slice?t.slice(0):t;r._total=r.reader.total(t);if(r._aggregate&&i.serverAggregates){r._aggregateResult=r.reader.aggregates(t)}t=r._readData(t);r._pristineData=t.slice(0);r._data=r._observe(t);r._addRange(r._data);r._process(r._data);r._dequeueRequest()},_addRange:function(e){var t=this,r=t._skip||0,i=r+t._flatData(e).length;t._ranges.push({start:r,end:i,data:e});t._ranges.sort(function(e,t){return e.start-t.start})},error:function(e,t,r){this._dequeueRequest();this.trigger(z,{});this.trigger(x,{xhr:e,status:t,errorThrown:r})},_params:function(e){var t=this,i=r({take:t.take(),skip:t.skip(),page:t.page(),pageSize:t.pageSize(),sort:t._sort,filter:t._filter,group:t._group,aggregate:t._aggregate},e);if(!t.options.serverPaging){delete i.take;delete i.skip;delete i.page;delete i.pageSize}if(!t.options.serverGrouping){delete i.group}else if(t.reader.model&&i.group){i.group=Dt(i.group,t.reader.model)}if(!t.options.serverFiltering){delete i.filter}else if(t.reader.model&&i.filter){i.filter=At(i.filter,t.reader.model)}if(!t.options.serverSorting){delete i.sort}else if(t.reader.model&&i.sort){i.sort=Dt(i.sort,t.reader.model)}if(!t.options.serverAggregates){delete i.aggregate}else if(t.reader.model&&i.aggregate){i.aggregate=Dt(i.aggregate,t.reader.model)}return i},_queueRequest:function(e,t){var r=this;if(!r._requestInProgress){r._requestInProgress=true;r._pending=undefined;t()}else{r._pending={callback:i(t,r),options:e}}},_dequeueRequest:function(){var e=this;e._requestInProgress=false;if(e._pending){e._queueRequest(e._pending.options,e._pending.callback)}},_handleCustomErrors:function(e){if(this.reader.errors){var t=this.reader.errors(e);if(t){this.trigger(x,{xhr:null,status:"customerror",errorThrown:"custom error",errors:t});return true}}return false},_observe:function(e){var t=this,r=t.reader.model,n=false;if(r&&e.length){n=!(e[0]instanceof r)}if(e instanceof U){if(n){e.type=t.reader.model;e.wrapAll(e,e)}}else{e=new U(e,t.reader.model);e.parent=function(){return t.parent()}}if(t._isServerGrouped()){qt(e,r)}if(t._changeHandler&&t._data&&t._data instanceof U){t._data.unbind(w,t._changeHandler)}else{t._changeHandler=i(t._change,t)}return e.bind(w,t._changeHandler)},_change:function(e){var t=this,r,i,n=e?e.action:"";if(n==="remove"){for(r=0,i=e.items.length;r<i;r++){if(!e.items[r].isNew||!e.items[r].isNew()){t._destroyed.push(e.items[r])}}}if(t.options.autoSync&&(n==="add"||n==="remove"||n==="itemchange")){t.sync()}else{var a=parseInt(t._total||t.reader.total(t._pristine),10);if(n==="add"){a+=e.items.length}else if(n==="remove"){a-=e.items.length}else if(n!=="itemchange"&&n!=="sync"&&!t.options.serverPaging){a=t.reader.total(t._pristine)}t._total=a;t._process(t._data,e)}},_process:function(e,t){var r=this,i={},n;if(r.options.serverPaging!==true){i.skip=r._skip;i.take=r._take||r._pageSize;if(i.skip===undefined&&r._page!==undefined&&r._pageSize!==undefined){i.skip=(r._page-1)*r._pageSize}}if(r.options.serverSorting!==true){i.sort=r._sort}if(r.options.serverFiltering!==true){i.filter=r._filter}if(r.options.serverGrouping!==true){i.group=r._group}if(r.options.serverAggregates!==true){i.aggregate=r._aggregate;r._aggregateResult=gt(e,i)}n=rt.process(e,i);r._view=n.data;if(n.total!==undefined&&!r.options.serverFiltering){r._total=n.total}t=t||{};t.items=t.items||r._view;r.trigger(w,t)},_mergeState:function(e){var t=this;if(e!==undefined){t._pageSize=e.pageSize;t._page=e.page;t._sort=e.sort;t._filter=e.filter;t._group=e.group;t._aggregate=e.aggregate;t._skip=e.skip;t._take=e.take;if(t._skip===undefined){t._skip=t.skip();e.skip=t.skip()}if(t._take===undefined&&t._pageSize!==undefined){t._take=t._pageSize;e.take=t._take}if(e.sort){t._sort=e.sort=it(e.sort)}if(e.filter){t._filter=e.filter=st(e.filter)}if(e.group){t._group=e.group=ft(e.group)}if(e.aggregate){t._aggregate=e.aggregate=ot(e.aggregate)}}return e},query:function(e){var t=this,r,i=t.options.serverSorting||t.options.serverPaging||t.options.serverFiltering||t.options.serverGrouping||t.options.serverAggregates;if(i||(t._data===undefined||t._data.length===0)&&!t._destroyed.length){t.read(t._mergeState(e))}else{if(!t.trigger(q,{type:"read"})){t.trigger(C);r=rt.process(t._data,t._mergeState(e));if(!t.options.serverFiltering){if(r.total!==undefined){t._total=r.total}else{t._total=t._data.length}}t._view=r.data;t._aggregateResult=gt(t._data,e);t.trigger(z,{});t.trigger(w,{items:r.data})}}},fetch:function(t){var r=this;return e.Deferred(function(e){var i=function(i){r.unbind(x,n);e.resolve();if(t){t.call(r,i)}};var n=function(t){e.reject(t)};r.one(w,i);r.one(x,n);r._query()}).promise()},_query:function(e){var t=this;t.query(r({},{page:t.page(),pageSize:t.pageSize(),sort:t.sort(),filter:t.filter(),group:t.group(),aggregate:t.aggregate()},e))},next:function(e){var t=this,r=t.page(),i=t.total();e=e||{};if(!r||i&&r+1>t.totalPages()){return}t._skip=r*t.take();r+=1;e.page=r;t._query(e);return r},prev:function(e){var t=this,r=t.page();e=e||{};if(!r||r===1){return}t._skip=t._skip-t.take();r-=1;e.page=r;t._query(e);return r},page:function(e){var t=this,r;if(e!==undefined){e=P.max(P.min(P.max(e,1),t.totalPages()),1);t._query({page:e});return}r=t.skip();return r!==undefined?P.round((r||0)/(t.take()||1))+1:undefined},pageSize:function(e){var t=this;if(e!==undefined){t._query({pageSize:e,page:1});return}return t.take()},sort:function(e){var t=this;if(e!==undefined){t._query({sort:e});return}return t._sort},filter:function(e){var t=this;if(e===undefined){return t._filter}t._query({filter:e,page:1})},group:function(e){var t=this;if(e!==undefined){t._query({group:e});return}return t._group},total:function(){return parseInt(this._total||0,10)},aggregate:function(e){var t=this;if(e!==undefined){t._query({aggregate:e});return}return t._aggregate},aggregates:function(){return this._aggregateResult},totalPages:function(){var e=this,t=e.pageSize()||e.total();return P.ceil((e.total()||0)/t)},inRange:function(e,t){var r=this,i=P.min(e+t,r.total());if(!r.options.serverPaging&&r.data.length>0){return true}return r._findRange(e,i).length>0},lastRange:function(){var e=this._ranges;return e[e.length-1]||{start:0,end:0,data:[]}},firstItemUid:function(){var e=this._ranges;return e.length&&e[0].data.length&&e[0].data[0].uid},range:function(e,t){e=P.min(e||0,this.total());var r=this,i=P.max(P.floor(e/t),0)*t,n=P.min(i+t,r.total()),a;a=r._findRange(e,P.min(e+t,r.total()));if(a.length){r._skip=e>r.skip()?P.min(n,(r.totalPages()-1)*r.take()):i;r._take=t;var s=r.options.serverPaging;var o=r.options.serverSorting;var f=r.options.serverFiltering;try{r.options.serverPaging=true;r.options.serverSorting=true;r.options.serverFiltering=true;if(s){r._data=a=r._observe(a)}r._process(a)}finally{r.options.serverPaging=s;r.options.serverSorting=o;r.options.serverFiltering=f}return}if(t!==undefined){if(!r._rangeExists(i,n)){r.prefetch(i,t,function(){if(e>i&&n<r.total()&&!r._rangeExists(n,P.min(n+t,r.total()))){r.prefetch(n,t,function(){r.range(e,t)})}else{r.range(e,t)}})}else if(i<e){r.prefetch(n,t,function(){r.range(e,t)})}}},_findRange:function(e,t){var r=this,i=r._ranges,n,a=[],s,o,f,u,l,d,c,h=r.options,g=h.serverSorting||h.serverPaging||h.serverFiltering||h.serverGrouping||h.serverAggregates,p,_,v;for(s=0,v=i.length;s<v;s++){n=i[s];if(e>=n.start&&e<=n.end){_=0;for(o=s;o<v;o++){n=i[o];p=r._flatData(n.data);if(p.length&&e+_>=n.start){l=n.data;d=n.end;if(!g){var m=ft(r.group()||[]).concat(it(r.sort()||[]));c=rt.process(n.data,{sort:m,filter:r.filter()});p=l=c.data;if(c.total!==undefined){d=c.total}}f=0;if(e+_>n.start){f=e+_-n.start}u=p.length;if(d>t){u=u-(d-t)}_+=u-f;a=r._mergeGroups(a,l,f,u);if(t<=n.end&&_==t-e){return a}}}break}}return[]},_mergeGroups:function(e,t,r,i){if(this._isServerGrouped()){var n=t.toJSON(),a;
if(e.length){a=e[e.length-1]}kt(a,n,r,i);return e.concat(n)}return e.concat(t.slice(r,i))},skip:function(){var e=this;if(e._skip===undefined){return e._page!==undefined?(e._page-1)*(e.take()||1):undefined}return e._skip},take:function(){return this._take||this._pageSize},_prefetchSuccessHandler:function(e,t,r){var i=this;return function(n){var a=false,s={start:e,end:t,data:[]},o,f;i._dequeueRequest();for(o=0,f=i._ranges.length;o<f;o++){if(i._ranges[o].start===e){a=true;s=i._ranges[o];break}}if(!a){i._ranges.push(s)}i.trigger(z,{response:n,type:"read"});n=i.reader.parse(n);s.data=i._observe(i._readData(n));s.end=s.start+i._flatData(s.data).length;i._ranges.sort(function(e,t){return e.start-t.start});i._total=i.reader.total(n);if(r){r()}}},prefetch:function(e,t,r){var i=this,n=P.min(e+t,i.total()),a={take:t,skip:e,page:e/t+1,pageSize:t,sort:i._sort,filter:i._filter,group:i._group,aggregate:i._aggregate};if(!i._rangeExists(e,n)){clearTimeout(i._timeout);i._timeout=setTimeout(function(){i._queueRequest(a,function(){if(!i.trigger(q,{type:"read"})){i.transport.read({data:i._params(a),success:i._prefetchSuccessHandler(e,n,r)})}else{i._dequeueRequest()}})},100)}else if(r){r()}},_rangeExists:function(e,t){var r=this,i=r._ranges,n,a;for(n=0,a=i.length;n<a;n++){if(i[n].start<=e&&i[n].end>=t){return true}}return false}});var Nt={};Nt.create=function(e,i){var s,o=e.transport;if(o){o.read=typeof o.read===p?{url:o.read}:o.read;if(e.type){if(t.data.transports[e.type]&&!a(t.data.transports[e.type])){s=new t.data.transports[e.type](r(o,{data:i}))}else{o=r(true,{},t.data.transports[e.type],o)}e.schema=r(true,{},t.data.schemas[e.type],e.schema)}if(!s){s=n(o.read)?o:new _t(o)}}else{s=new pt({data:e.data})}return s};Mt.create=function(e){e=e&&e.push?{data:e}:e;var i=e||{},n=i.data,a=i.fields,o=i.table,f=i.select,u,l,d={},c;if(!n&&a&&!i.transport){if(o){n=It(o,a)}else if(f){n=jt(f,a)}}if(t.data.Model&&a&&(!i.schema||!i.schema.model)){for(u=0,l=a.length;u<l;u++){c=a[u];if(c.type){d[c.field]=c}}if(!s(d)){i.schema=r(true,i.schema,{model:{fields:d}})}}i.data=n;return i instanceof Mt?i:new Mt(i)};function jt(t,r){var i=e(t)[0].children,n,a,s=[],o,f=r[0],u=r[1],l,d;for(n=0,a=i.length;n<a;n++){o={};d=i[n];if(d.disabled){continue}o[f.field]=d.text;l=d.attributes.value;if(l&&l.specified){l=d.value}else{l=d.text}o[u.field]=l;s.push(o)}return s}function It(t,r){var i=e(t)[0].tBodies[0],n=i?i.rows:[],a,s,o,f=r.length,u=[],l,d,c,h;for(a=0,s=n.length;a<s;a++){d={};h=true;l=n[a].cells;for(o=0;o<f;o++){c=l[o];if(c.nodeName.toLowerCase()!=="th"){h=false;d[r[o].field]=c.innerHTML}}if(!h){u.push(d)}}return u}var Bt=Y.define({init:function(e){var i=this,a=i.hasChildren||e&&e.hasChildren,s="items",o={};t.data.Model.fn.init.call(i,e);if(typeof i.children===p){s=i.children}o={schema:{data:s,model:{hasChildren:a,id:i.idField}}};if(typeof i.children!==p){r(o,i.children)}o.data=e;if(!a){a=o.schema.data}if(typeof a===p){a=t.getter(a)}if(n(a)){i.hasChildren=!!a.call(i,i)}i._childrenOptions=o;if(i.hasChildren){i._initChildren()}i._loaded=!!(e&&(e[s]||e._loaded))},_initChildren:function(){var e=this;var t,r,i;if(!(e.children instanceof Lt)){t=e.children=new Lt(e._childrenOptions);r=t.transport;i=r.parameterMap;r.parameterMap=function(t){t[e.idField||"id"]=e.id;if(i){t=i(t)}return t};t.parent=function(){return e};t.bind(w,function(t){t.node=t.node||e;e.trigger(w,t)});t.bind(x,function(t){var r=e.parent();if(r){t.node=t.node||e;r.trigger(x,t)}});e._updateChildrenField()}},append:function(e){this._initChildren();this.loaded(true);this.children.add(e)},hasChildren:false,level:function(){var e=this.parentNode(),t=0;while(e&&e.parentNode){t++;e=e.parentNode?e.parentNode():null}return t},_updateChildrenField:function(){var e=this._childrenOptions.schema.data;this[e||"items"]=this.children.data()},load:function(){var e=this,t={};if(e.hasChildren){e._initChildren();t[e.idField||"id"]=e.id;if(!e._loaded){e.children._data=undefined}e.children.one(w,function(){e._loaded=true;e._updateChildrenField()})._query(t)}},parentNode:function(){var e=this.parent();return e.parent()},loaded:function(e){if(e!==undefined){this._loaded=e}else{return this._loaded}},shouldSerialize:function(e){return Y.fn.shouldSerialize.call(this,e)&&e!=="children"&&e!=="_loaded"&&e!=="hasChildren"&&e!=="_childrenOptions"}});function Gt(e){return function(){var t=this._data,r=Mt.fn[e].apply(this,I.call(arguments));if(this._data!=t){this._attachBubbleHandlers()}return r}}var Lt=Mt.extend({init:function(e){var t=Bt.define({children:e});Mt.fn.init.call(this,r(true,{},{schema:{modelBase:t,model:t}},e));this._attachBubbleHandlers()},_attachBubbleHandlers:function(){var e=this;e._data.bind(x,function(t){e.trigger(x,t)})},remove:function(e){var t=e.parentNode(),r=this,i;if(t&&t._initChildren){r=t.children}i=Mt.fn.remove.call(r,e);if(t&&!r.data().length){t.hasChildren=false}return i},success:Gt("success"),data:Gt("data"),insert:function(e,t){var r=this.parent();if(r&&r._initChildren){r.hasChildren=true;r._initChildren()}return Mt.fn.insert.call(this,e,t)},_find:function(e,t){var r,i,n,a,s;n=Mt.fn[e].call(this,t);if(n){return n}a=this._flatData(this.data());if(!a){return}for(r=0,i=a.length;r<i;r++){s=a[r].children;if(!(s instanceof Lt)){continue}n=s[e](t);if(n){return n}}},get:function(e){return this._find("get",e)},getByUid:function(e){return this._find("getByUid",e)}});function Et(t,r){var i=e(t).children(),n,a,s=[],o,f=r[0].field,u=r[1]&&r[1].field,l=r[2]&&r[2].field,d=r[3]&&r[3].field,c,h,g,p,_;for(n=0,a=i.length;n<a;n++){o={_loaded:true};c=i.eq(n);g=c[0].firstChild;_=c.children();t=_.filter("ul");_=_.filter(":not(ul)");h=c.attr("data-id");if(h){o.id=h}if(g){o[f]=g.nodeType==3?g.nodeValue:_.text()}if(u){o[u]=_.find("a").attr("href")}if(d){o[d]=_.find("img").attr("src")}if(l){p=_.find(".k-sprite").prop("className");o[l]=p&&e.trim(p.replace("k-sprite",""))}if(t.length){o.items=Et(t.eq(0),r)}if(c.attr("data-hasChildren")=="true"){o.hasChildren=true}s.push(o)}return s}Lt.create=function(e){e=e&&e.push?{data:e}:e;var t=e||{},r=t.data,i=t.fields,n=t.list;if(r&&r._dataSource){return r._dataSource}if(!r&&i&&!t.transport){if(n){r=Et(n,i)}}t.data=r;return t instanceof Lt?t:new Lt(t)};var Ht=t.Observable.extend({init:function(e,r,i){t.Observable.fn.init.call(this);this._prefetching=false;this.dataSource=e;this.prefetch=!i;var n=this;e.bind("change",function(){n._change()});this._syncWithDataSource();this.setViewSize(r)},setViewSize:function(e){this.viewSize=e;this._recalculate()},at:function(e){var t=this.pageSize;if(e>=this.total()){this.trigger("endreached",{index:e});return}if(e<this.dataOffset||e>this.skip+t){var r=Math.floor(e/t)*t;this.range(r)}if(e===this.prefetchThreshold){this._prefetch()}if(e===this.midPageThreshold){this.range(this.nextMidRange)}else if(e===this.nextPageThreshold){this.range(this.nextFullRange)}else if(e===this.pullBackThreshold){if(this.offset===this.skip){this.range(this.previousMidRange)}else{this.range(this.previousFullRange)}}var i=this.dataSource.at(e-this.dataOffset);if(i===undefined){this.trigger("endreached",{index:e})}return i},indexOf:function(e){return this.dataSource.data().indexOf(e)+this.dataOffset},_prefetch:function(){var e=this,t=this.pageSize,r=this.skip+t,i=this.dataSource;if(!i.inRange(r,t)&&!this._prefetching&&this.prefetch){this._prefetching=true;this.trigger("prefetching",{skip:r,take:t});i.prefetch(r,t,function(){e._prefetching=false;e.trigger("prefetched",{skip:r,take:t})})}},total:function(){return parseInt(this.dataSource.total(),10)},next:function(){var e=this,t=e.pageSize,r=e.skip-e.viewSize,i=P.max(P.floor(r/t),0)*t+t;this.offset=r;this.dataSource.prefetch(i,t,function(){e._goToRange(r,true)})},range:function(e){if(this.offset===e){return}var t=this,r=this.pageSize,i=P.max(P.floor(e/r),0)*r+r,n=this.dataSource;this.offset=e;this._recalculate();if(n.inRange(e,r)){this._goToRange(e)}else if(this.prefetch){n.prefetch(i,r,function(){t._goToRange(e,true)})}},syncDataSource:function(){var e=this.offset;this.offset=null;this.range(e)},_goToRange:function(e,t){if(this.offset!==e){return}this.dataOffset=e;this._expanding=t;this.dataSource.range(e,this.pageSize)},_change:function(){var e=this.dataSource,t=e.firstItemUid();this.length=e.lastRange().end;if(this._firstItemUid!==t){this._syncWithDataSource();this._recalculate();this.trigger("reset",{offset:this.offset})}this.trigger("resize");if(this._expanding){this.trigger("expand")}delete this._expanding},_syncWithDataSource:function(){var e=this.dataSource;this._firstItemUid=e.firstItemUid();this.dataOffset=this.offset=e.skip();this.pageSize=e.pageSize()},_recalculate:function(){var e=this.pageSize,t=this.offset,r=this.viewSize,i=Math.ceil(t/e)*e;this.skip=i;this.midPageThreshold=i+e-1;this.nextPageThreshold=i+r-1;this.prefetchThreshold=i+Math.floor(e/3*2);this.pullBackThreshold=this.offset-1;this.nextMidRange=i+e-r;this.nextFullRange=i;this.previousMidRange=t-r;this.previousFullRange=i-e}});var Jt=t.Observable.extend({init:function(e,r){var i=this;t.Observable.fn.init.call(i);this.dataSource=e;this.batchSize=r;this._total=0;this.buffer=new Ht(e,r*3);this.buffer.bind({endreached:function(e){i.trigger("endreached",{index:e.index})},prefetching:function(e){i.trigger("prefetching",{skip:e.skip,take:e.take})},prefetched:function(e){i.trigger("prefetched",{skip:e.skip,take:e.take})},reset:function(){i._total=0;i.trigger("reset")},resize:function(){i._total=this.length/i.batchSize;i.trigger("resize",{total:i.total(),offset:this.offset})}})},syncDataSource:function(){this.buffer.syncDataSource()},at:function(e){var t=this.buffer,r=e*this.batchSize,i=this.batchSize,n=[],a;if(t.offset>r){t.at(t.offset-1)}for(var s=0;s<i;s++){a=t.at(r+s);if(a===undefined){return}n.push(a)}return n},total:function(){return this._total}});r(true,t.data,{readers:{json:bt},Query:rt,DataSource:Mt,HierarchicalDataSource:Lt,Node:Bt,ObservableObject:W,ObservableArray:U,LocalTransport:pt,RemoteTransport:_t,Cache:vt,DataReader:bt,Model:Y,Buffer:Ht,BatchBuffer:Jt})});
define('kendoui/kendo.fx',["kendoui/kendo.jquery","kendoui/kendo.core"],function(e,t){var i=t.effects,r=e.each,n=e.extend,s=e.proxy,o=t.support,a=o.browser,l=o.transforms,f=o.transitions,c={scale:0,scalex:0,scaley:0,scale3d:0},u={translate:0,translatex:0,translatey:0,translate3d:0},d=typeof document.documentElement.style.zoom!=="undefined"&&!l,p=/matrix3?d?\s*\(.*,\s*([\d\.\-]+)\w*?,\s*([\d\.\-]+)\w*?,\s*([\d\.\-]+)\w*?,\s*([\d\.\-]+)\w*?/i,h=/^(-?[\d\.\-]+)?[\w\s]*,?\s*(-?[\d\.\-]+)?[\w\s]*/i,v=/translatex?$/i,m=/(zoom|fade|expand)(\w+)/,y=/(zoom|fade|expand)/,x=/[xy]$/i,g=["perspective","rotate","rotatex","rotatey","rotatez","rotate3d","scale","scalex","scaley","scalez","scale3d","skew","skewx","skewy","translate","translatex","translatey","translatez","translate3d","matrix","matrix3d"],_=["rotate","scale","scalex","scaley","skew","skewx","skewy","translate","translatex","translatey","matrix"],w={rotate:"deg",scale:"",skew:"px",translate:"px"},k=l.css,b=Math.round,T="",C="px",z="none",R="auto",E="width",P="height",N="hidden",H="origin",D="abortId",O="overflow",F="translate",q="completeCallback",I=k+"transition",A=k+"transform",$=k+"backface-visibility",S=k+"perspective",V="1500px",L="perspective("+V+")",M=o.mobileOS&&o.mobileOS.majorVersion==7,W={left:{reverse:"right",property:"left",transition:"translatex",vertical:false,modifier:-1},right:{reverse:"left",property:"left",transition:"translatex",vertical:false,modifier:1},down:{reverse:"up",property:"top",transition:"translatey",vertical:true,modifier:1},up:{reverse:"down",property:"top",transition:"translatey",vertical:true,modifier:-1},top:{reverse:"bottom"},bottom:{reverse:"top"},"in":{reverse:"out",modifier:-1},out:{reverse:"in",modifier:1},vertical:{reverse:"vertical"},horizontal:{reverse:"horizontal"}};t.directions=W;n(e.fn,{kendoStop:function(e,t){if(f){return i.stopQueue(this,e||false,t||false)}else{return this.stop(e,t)}}});if(l&&!f){r(_,function(t,i){e.fn[i]=function(t){if(typeof t=="undefined"){return X(this,i)}else{var r=e(this)[0],n=i+"("+t+w[i.replace(x,"")]+")";if(r.style.cssText.indexOf(A)==-1){e(this).css(A,n)}else{r.style.cssText=r.style.cssText.replace(new RegExp(i+"\\(.*?\\)","i"),n)}}return this};e.fx.step[i]=function(t){e(t.elem)[i](t.now)}});var j=e.fx.prototype.cur;e.fx.prototype.cur=function(){if(_.indexOf(this.prop)!=-1){return parseFloat(e(this.elem)[this.prop]())}return j.apply(this,arguments)}}t.toggleClass=function(e,t,i,s){if(t){t=t.split(" ");if(f){i=n({exclusive:"all",duration:400,ease:"ease-out"},i);e.css(I,i.exclusive+" "+i.duration+"ms "+i.ease);setTimeout(function(){e.css(I,"").css(P)},i.duration)}r(t,function(t,i){e.toggleClass(i,s)})}return e};t.parseEffects=function(e,t){var i={};if(typeof e==="string"){r(e.split(" "),function(e,r){var n=!y.test(r),s=r.replace(m,function(e,t,i){return t+":"+i.toLowerCase()}),o=s.split(":"),a=o[1],l={};if(o.length>1){l.direction=t&&n?W[a].reverse:a}i[o[0]]=l})}else{r(e,function(e){var r=this.direction;if(r&&t&&!y.test(e)){this.direction=W[r].reverse}i[e]=this})}return i};function Q(e){return parseInt(e,10)}function B(e,t){return Q(e.css(t))}function U(e){var i=e.effects;if(i==="zoom"){i="zoom:in fade:in"}if(i==="fade"){i="fade:in"}if(i==="slide"){i="tile:left"}if(/^slide:(.+)$/.test(i)){i="tile:"+RegExp.$1}if(i==="overlay"){i="slideIn:left"}if(/^overlay:(.+)$/.test(i)){i="slideIn:"+RegExp.$1}e.effects=t.parseEffects(i);if(M&&i=="tile:left"){e.previousDivisor=3}return e}function G(e){var t=[];for(var i in e){t.push(i)}return t}function J(e){for(var t in e){if(g.indexOf(t)!=-1&&_.indexOf(t)==-1){delete e[t]}}return e}function K(e,t){var i=[],r={},n,s,a,f;for(s in t){n=s.toLowerCase();f=l&&g.indexOf(n)!=-1;if(!o.hasHW3D&&f&&_.indexOf(n)==-1){delete t[s]}else{a=t[s];if(f){i.push(s+"("+a+")")}else{r[s]=a}}}if(i.length){r[A]=i.join(" ")}return r}if(f){n(i,{transition:function(t,i,r){var s,o=0,a=t.data("keys")||[],l;r=n({duration:200,ease:"ease-out",complete:null,exclusive:"all"},r);var c=false;var u=function(){if(!c){c=true;if(l){clearTimeout(l);l=null}t.removeData(D).dequeue().css(I,"").css(I);r.complete.call(t)}};r.duration=e.fx?e.fx.speeds[r.duration]||r.duration:r.duration;s=K(t,i);e.merge(a,G(s));t.data("keys",e.unique(a)).height();t.css(I,r.exclusive+" "+r.duration+"ms "+r.ease).css(I);t.css(s).css(A);if(f.event){t.one(f.event,u);if(r.duration!==0){o=500}}l=setTimeout(u,r.duration+o);t.data(D,l);t.data(q,u)},stopQueue:function(e,i,r){var n,s=e.data("keys"),o=!r&&s,a=e.data(q);if(o){n=t.getComputedStyles(e[0],s)}if(a){a()}if(o){e.css(n)}return e.removeData("keys").stop(i)}})}function X(e,t){if(l){var i=e.css(A);if(i==z){return t=="scale"?1:0}var r=i.match(new RegExp(t+"\\s*\\(([\\d\\w\\.]+)")),n=0;if(r){n=Q(r[1])}else{r=i.match(p)||[0,0,0,0,0];t=t.toLowerCase();if(v.test(t)){n=parseFloat(r[3]/r[2])}else if(t=="translatey"){n=parseFloat(r[4]/r[2])}else if(t=="scale"){n=parseFloat(r[2])}else if(t=="rotate"){n=parseFloat(Math.atan2(r[2],r[1]))}}return n}else{return parseFloat(e.css(t))}}var Y=t.Class.extend({init:function(e,t){var i=this;i.element=e;i.effects=[];i.options=t;i.restore=[]},run:function(t){var r=this,s,o,a,c=t.length,u=r.element,d=r.options,p=e.Deferred(),h={},v={},m,y,x;r.effects=t;p.then(e.proxy(r,"complete"));u.data("animating",true);for(o=0;o<c;o++){s=t[o];s.setReverse(d.reverse);s.setOptions(d);r.addRestoreProperties(s.restore);s.prepare(h,v);y=s.children();for(a=0,x=y.length;a<x;a++){y[a].duration(d.duration).run()}}for(var g in d.effects){n(v,d.effects[g].properties)}if(!u.is(":visible")){n(h,{display:u.data("olddisplay")||"block"})}if(l&&!d.reset){m=u.data("targetTransform");if(m){h=n(m,h)}}h=K(u,h);if(l&&!f){h=J(h)}u.css(h).css(A);for(o=0;o<c;o++){t[o].setup()}if(d.init){d.init()}u.data("targetTransform",v);i.animate(u,v,n({},d,{complete:p.resolve}));return p.promise()},stop:function(){e(this.element).kendoStop(true,true)},addRestoreProperties:function(e){var t=this.element,i,r=0,n=e.length;for(;r<n;r++){i=e[r];this.restore.push(i);if(!t.data(i)){t.data(i,t.css(i))}}},restoreCallback:function(){var e=this.element;for(var t=0,i=this.restore.length;t<i;t++){var r=this.restore[t];e.css(r,e.data(r))}},complete:function(){var t=this,i=0,r=t.element,n=t.options,s=t.effects,o=s.length;r.removeData("animating").dequeue();if(n.hide){r.data("olddisplay",r.css("display")).hide()}this.restoreCallback();if(d&&!l){setTimeout(e.proxy(this,"restoreCallback"),0)}for(;i<o;i++){s[i].teardown()}if(n.completeCallback){n.completeCallback(r)}}});i.promise=function(e,r){var n=[],s,o=new Y(e,r),a=t.parseEffects(r.effects),l;r.effects=a;for(var f in a){s=i[et(f)];if(s){l=new s(e,a[f].direction);n.push(l)}}if(n[0]){o.run(n)}else{if(!e.is(":visible")){e.css({display:e.data("olddisplay")||"block"}).css("display")}if(r.init){r.init()}e.dequeue();o.complete()}};i.transitionPromise=function(e,t,r){i.animateTo(e,t,r);return e};n(i,{animate:function(t,s,o){var d=o.transition!==false;delete o.transition;if(f&&"transition"in i&&d){i.transition(t,s,o)}else{if(l){t.animate(J(s),{queue:false,show:false,hide:false,duration:o.duration,complete:o.complete})}else{t.each(function(){var t=e(this),i={};r(g,function(e,r){var o,a=s?s[r]+" ":null;if(a){var f=s;if(r in c&&s[r]!==undefined){o=a.match(h);if(l){n(f,{scale:+o[0]})}}else{if(r in u&&s[r]!==undefined){var d=t.css("position"),p=d=="absolute"||d=="fixed";if(!t.data(F)){if(p){t.data(F,{top:B(t,"top")||0,left:B(t,"left")||0,bottom:B(t,"bottom"),right:B(t,"right")})}else{t.data(F,{top:B(t,"marginTop")||0,left:B(t,"marginLeft")||0})}}var v=t.data(F);o=a.match(h);if(o){var m=r==F+"y"?+null:+o[1],y=r==F+"y"?+o[1]:+o[2];if(p){if(!isNaN(v.right)){if(!isNaN(m)){n(f,{right:v.right-m})}}else{if(!isNaN(m)){n(f,{left:v.left+m})}}if(!isNaN(v.bottom)){if(!isNaN(y)){n(f,{bottom:v.bottom-y})}}else{if(!isNaN(y)){n(f,{top:v.top+y})}}}else{if(!isNaN(m)){n(f,{marginLeft:v.left+m})}if(!isNaN(y)){n(f,{marginTop:v.top+y})}}}}}if(!l&&r!="scale"&&r in f){delete f[r]}if(f){n(i,f)}}});if(a.msie){delete i.scale}t.animate(i,{queue:false,show:false,hide:false,duration:o.duration,complete:o.complete})})}}},animateTo:function(t,i,r){var s,l=t.parents().filter(i.parents()).first(),f;r=U(r);if(!o.mobileOS.android){f=l.css(O);l.css(O,"hidden")}e.each(r.effects,function(e,t){s=s||t.direction});function c(e){i[0].style.cssText="";t.each(function(){this.style.cssText=""});if(!o.mobileOS.android){l.css(O,f)}if(r.completeCallback){r.completeCallback.call(t,e)}}r.complete=a.msie?function(){setTimeout(c,0)}:c;r.previous=r.reverse?i:t;r.reset=true;(r.reverse?t:i).each(function(){e(this).kendoAnimate(n(true,{},r));r.complete=null;r.previous=null})}});var Z=t.Class.extend({init:function(e,t){var i=this;i.element=e;i._direction=t;i.options={};i._additionalEffects=[];if(!i.restore){i.restore=[]}},reverse:function(){this._reverse=true;return this.run()},play:function(){this._reverse=false;return this.run()},add:function(e){this._additionalEffects.push(e);return this},direction:function(e){this._direction=e;return this},duration:function(e){this._duration=e;return this},compositeRun:function(){var e=this,t=new Y(e.element,{reverse:e._reverse,duration:e._duration}),i=e._additionalEffects.concat([e]);return t.run(i)},run:function(){if(this._additionalEffects&&this._additionalEffects[0]){return this.compositeRun()}var t=this,r=t.element,s=0,o=t.restore,a=o.length,c,u=e.Deferred(),d={},p={},h,v=t.children(),m=v.length;u.then(e.proxy(t,"_complete"));r.data("animating",true);for(s=0;s<a;s++){c=o[s];if(!r.data(c)){r.data(c,r.css(c))}}for(s=0;s<m;s++){v[s].duration(t._duration).run()}t.prepare(d,p);if(!r.is(":visible")){n(d,{display:r.data("olddisplay")||"block"})}if(l){h=r.data("targetTransform");if(h){d=n(h,d)}}d=K(r,d);if(l&&!f){d=J(d)}r.css(d).css(A);t.setup();r.data("targetTransform",p);i.animate(r,p,{duration:t._duration,complete:u.resolve});return u.promise()},stop:function(){var t=0,i=this.children(),r=i.length;for(t=0;t<r;t++){i[t].stop()}e(this.element).kendoStop(true,true);return this},restoreCallback:function(){var e=this.element;for(var t=0,i=this.restore.length;t<i;t++){var r=this.restore[t];e.css(r,e.data(r))}},_complete:function(){var t=this,i=t.element;i.removeData("animating").dequeue();t.restoreCallback();if(t.shouldHide()){i.data("olddisplay",i.css("display")).hide()}if(d&&!l){setTimeout(e.proxy(t,"restoreCallback"),0)}t.teardown()},setOptions:function(e){n(true,this.options,e)},children:function(){return[]},shouldHide:e.noop,setup:e.noop,prepare:e.noop,teardown:e.noop,directions:[],setReverse:function(e){this._reverse=e;return this}});function et(e){return e.charAt(0).toUpperCase()+e.substring(1)}function tt(e,t){var n=Z.extend(t),s=n.prototype.directions;i[et(e)]=n;i.Element.prototype[e]=function(e,t,i,r){return new n(this.element,e,t,i,r)};r(s,function(t,r){i.Element.prototype[e+et(r)]=function(e,t,i){return new n(this.element,r,e,t,i)}})}var it=["left","right","up","down"],rt=["in","out"];tt("slideIn",{directions:it,divisor:function(e){this.options.divisor=e;return this},prepare:function(e,t){var i=this,r,n=i.element,s=W[i._direction],o=-s.modifier*(s.vertical?n.outerHeight():n.outerWidth()),a=o/(i.options&&i.options.divisor||1)+C,f="0px";if(i._reverse){r=e;e=t;t=r}if(l){e[s.transition]=a;t[s.transition]=f}else{e[s.property]=a;t[s.property]=f}}});tt("tile",{directions:it,init:function(e,t,i){Z.prototype.init.call(this,e,t);this.options={previous:i}},previousDivisor:function(e){this.options.previousDivisor=e;return this},children:function(){var e=this,i=e._reverse,r=e.options.previous,n=e.options.previousDivisor||1,s=e._direction;var o=[t.fx(e.element).slideIn(s).setReverse(i)];if(r){o.push(t.fx(r).slideIn(W[s].reverse).divisor(n).setReverse(!i))}return o}});function nt(e,t,i,r){tt(e,{directions:rt,startValue:function(e){this._startValue=e;return this},endValue:function(e){this._endValue=e;return this},shouldHide:function(){return this._shouldHide},prepare:function(e,n){var s=this,o,a,l=this._direction==="out",f=s.element.data(t),c=!(isNaN(f)||f==i);if(c){o=f}else if(typeof this._startValue!=="undefined"){o=this._startValue}else{o=l?i:r}if(typeof this._endValue!=="undefined"){a=this._endValue}else{a=l?r:i}if(this._reverse){e[t]=a;n[t]=o}else{e[t]=o;n[t]=a}s._shouldHide=n[t]===r}})}nt("fade","opacity",1,0);nt("zoom","scale",1,.01);tt("slideMargin",{prepare:function(e,t){var i=this,r=i.element,n=i.options,s=r.data(H),o=n.offset,a,l=i._reverse;if(!l&&s===null){r.data(H,parseFloat(r.css("margin-"+n.axis)))}a=r.data(H)||0;t["margin-"+n.axis]=!l?a+o:a}});tt("slideTo",{prepare:function(e,t){var i=this,r=i.element,n=i.options,s=n.offset.split(","),o=i._reverse;if(l){t.translatex=!o?s[0]:0;t.translatey=!o?s[1]:0}else{t.left=!o?s[0]:0;t.top=!o?s[1]:0}r.css("left")}});tt("expand",{directions:["horizontal","vertical"],restore:[O],prepare:function(e,t){var i=this,r=i.element,n=i.options,s=i._reverse,o=i._direction==="vertical"?P:E,a=r[0].style[o],l=r.data(o),f=parseFloat(l||a),c=b(r.css(o,R)[o]());e.overflow=N;f=n&&n.reset?c||f:f||c;t[o]=(s?0:f)+C;e[o]=(s?f:0)+C;if(l===undefined){r.data(o,a)}},shouldHide:function(){return this._reverse},teardown:function(){var e=this,t=e.element,i=e._direction==="vertical"?P:E,r=t.data(i);if(r==R||r===T){setTimeout(function(){t.css(i,R).css(i)},0)}}});var st={position:"absolute",marginLeft:0,marginTop:0,scale:1};tt("transfer",{init:function(e,t){this.element=e;this.options={target:t};this.restore=[]},setup:function(){this.element.appendTo(document.body)},prepare:function(e,t){var i=this,r=i.element,s=i.options,o=i._reverse,a=s.target,l,f=X(r,"scale"),c=a.offset(),u=a.outerHeight()/r.outerHeight();n(e,st);t.scale=1;r.css(A,"scale(1)").css(A);l=r.offset();r.css(A,"scale("+f+")");var d=0,p=0,h=c.left-l.left,v=c.top-l.top,m=d+r.outerWidth(),y=p,x=h+a.outerWidth(),g=v,_=(v-p)/(h-d),w=(g-y)/(x-m),k=(p-y-_*d+w*m)/(w-_),b=p+_*(k-d);e.top=l.top;e.left=l.left;e.transformOrigin=k+C+" "+b+C;if(o){e.scale=u}else{t.scale=u}}});var ot={top:"rect(auto auto $size auto)",bottom:"rect($size auto auto auto)",left:"rect(auto $size auto auto)",right:"rect(auto auto auto $size)"};var at={top:{start:"rotatex(0deg)",end:"rotatex(180deg)"},bottom:{start:"rotatex(-180deg)",end:"rotatex(0deg)"},left:{start:"rotatey(0deg)",end:"rotatey(-180deg)"},right:{start:"rotatey(180deg)",end:"rotatey(0deg)"}};function lt(e,i){var r=t.directions[i].vertical,n=e[r?P:E]()/2+"px";return ot[i].replace("$size",n)}tt("turningPage",{directions:it,init:function(e,t,i){Z.prototype.init.call(this,e,t);this._container=i},prepare:function(e,i){var r=this,n=r._reverse,s=n?W[r._direction].reverse:r._direction,o=at[s];e.zIndex=1;if(r._clipInHalf){e.clip=lt(r._container,t.directions[s].reverse)}e[$]=N;i[A]=L+(n?o.start:o.end);e[A]=L+(n?o.end:o.start)},setup:function(){this._container.append(this.element)},face:function(e){this._face=e;return this},shouldHide:function(){var e=this,t=e._reverse,i=e._face;return t&&!i||!t&&i},clipInHalf:function(e){this._clipInHalf=e;return this},temporary:function(){this.element.addClass("temp-page");return this}});tt("staticPage",{directions:it,init:function(e,t,i){Z.prototype.init.call(this,e,t);this._container=i},restore:["clip"],prepare:function(e,t){var i=this,r=i._reverse?W[i._direction].reverse:i._direction;e.clip=lt(i._container,r);e.opacity=.999;t.opacity=1},shouldHide:function(){var e=this,t=e._reverse,i=e._face;return t&&!i||!t&&i},face:function(e){this._face=e;return this}});tt("pageturn",{directions:["horizontal","vertical"],init:function(e,t,i,r){Z.prototype.init.call(this,e,t);this.options={};this.options.face=i;this.options.back=r},children:function(){var e=this,i=e.options,r=e._direction==="horizontal"?"left":"top",n=t.directions[r].reverse,s=e._reverse,o,a=i.face.clone(true).removeAttr("id"),l=i.back.clone(true).removeAttr("id"),f=e.element;if(s){o=r;r=n;n=o}return[t.fx(i.face).staticPage(r,f).face(true).setReverse(s),t.fx(i.back).staticPage(n,f).setReverse(s),t.fx(a).turningPage(r,f).face(true).clipInHalf(true).temporary().setReverse(s),t.fx(l).turningPage(n,f).clipInHalf(true).temporary().setReverse(s)]},prepare:function(e,t){e[S]=V;e.transformStyle="preserve-3d";e.opacity=.999;t.opacity=1},teardown:function(){this.element.find(".temp-page").remove()}});tt("flip",{directions:["horizontal","vertical"],init:function(e,t,i,r){Z.prototype.init.call(this,e,t);this.options={};this.options.face=i;this.options.back=r},children:function(){var e=this,i=e.options,r=e._direction==="horizontal"?"left":"top",n=t.directions[r].reverse,s=e._reverse,o,a=e.element;if(s){o=r;r=n;n=o}return[t.fx(i.face).turningPage(r,a).face(true).setReverse(s),t.fx(i.back).turningPage(n,a).setReverse(s)]},prepare:function(e){e[S]=V;e.transformStyle="preserve-3d"}});var ft=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(e){setTimeout(e,1e3/60)};var ct=t.Class.extend({init:function(){var e=this;e._tickProxy=s(e._tick,e);e._started=false},tick:e.noop,done:e.noop,onEnd:e.noop,onCancel:e.noop,start:function(){if(!this.done()){this._started=true;ft(this._tickProxy)}},cancel:function(){this._started=false;this.onCancel()},_tick:function(){var e=this;if(!e._started){return}e.tick();if(!e.done()){ft(e._tickProxy)}else{e._started=false;e.onEnd()}}});var ut=ct.extend({init:function(e){var t=this;n(t,e);ct.fn.init.call(t)},done:function(){return this.timePassed()>=this.duration},timePassed:function(){return Math.min(this.duration,Date.now()-this.startDate)},moveTo:function(e){var t=this,i=t.movable;t.initial=i[t.axis];t.delta=e.location-t.initial;t.duration=typeof e.duration=="number"?e.duration:300;t.tick=t._easeProxy(e.ease);t.startDate=Date.now();t.start()},_easeProxy:function(e){var t=this;return function(){t.movable.moveAxis(t.axis,e(t.timePassed(),t.initial,t.delta,t.duration))}}});n(ut,{easeOutExpo:function(e,t,i,r){return e==r?t+i:i*(-Math.pow(2,-10*e/r)+1)+t},easeOutBack:function(e,t,i,r,n){n=1.70158;return i*((e=e/r-1)*e*((n+1)*e+n)+1)+t}});i.animationFrame=function(e){ft.call(window,e)};i.Animation=ct;i.Transition=ut;i.createEffect=tt});
define('kendoui/kendo.popup',["kendoui/kendo.jquery","kendoui/kendo.core"],function(e,t){var o=t.ui,i=o.Widget,n=t.support,s=t.getOffset,r=t._activeElement,a="open",l="close",f="deactivate",p="activate",d="center",c="left",u="right",m="top",g="bottom",h="absolute",v="hidden",w="body",_="location",k="position",y="visible",b="effects",x="k-state-active",z="k-state-border",T=/k-state-border-(\w+)/,P=".k-picker-wrap, .k-dropdown-wrap, .k-link",C="down",S=e(window),E=e(document.documentElement),I="resize scroll",W=n.transitions.css,H=W+"transform",O=e.extend,N=".kendoPopup",A=["font-family","font-size","font-stretch","font-style","font-weight","line-height"];function L(t,o){return t===o||e.contains(t,o)}var F=i.extend({init:function(o,n){var s=this,r;n=n||{};if(n.isRtl){n.origin=n.origin||g+" "+u;n.position=n.position||m+" "+u}i.fn.init.call(s,o,n);o=s.element;n=s.options;s.collisions=n.collision?n.collision.split(" "):[];if(s.collisions.length===1){s.collisions.push(s.collisions[0])}r=e(s.options.anchor).closest(".k-popup,.k-group").filter(":not([class^=km-])");n.appendTo=e(e(n.appendTo)[0]||r[0]||w);s.element.hide().addClass("k-popup k-group k-reset").toggleClass("k-rtl",!!n.isRtl).css({position:h}).appendTo(n.appendTo).on("mouseenter"+N,function(){s._hovered=true}).on("mouseleave"+N,function(){s._hovered=false});s.wrapper=e();if(n.animation===false){n.animation={open:{effects:{}},close:{hide:true,effects:{}}}}O(n.animation.open,{complete:function(){s.wrapper.css({overflow:y});s.trigger(p)}});O(n.animation.close,{complete:function(){s.wrapper.hide();var i=s.wrapper.data(_),r=e(n.anchor),a,l;if(i){s.wrapper.css(i)}if(n.anchor!=w){a=(r[0].className.match(T)||["","down"])[1];l=z+"-"+a;r.removeClass(l).children(P).removeClass(x).removeClass(l);o.removeClass(z+"-"+t.directions[a].reverse)}s._closing=false;s.trigger(f)}});s._mousedownProxy=function(e){s._mousedown(e)};s._resizeProxy=function(e){s._resize(e)};if(n.toggleTarget){e(n.toggleTarget).on(n.toggleEvent+N,e.proxy(s.toggle,s))}},events:[a,p,l,f],options:{name:"Popup",toggleEvent:"click",origin:g+" "+c,position:m+" "+c,anchor:w,collision:"flip fit",viewport:window,copyAnchorStyles:true,modal:false,animation:{open:{effects:"slideIn:down",transition:true,duration:200},close:{duration:100,hide:true}}},destroy:function(){var o=this,n=o.options,s=o.element.off(N),r;i.fn.destroy.call(o);if(n.toggleTarget){e(n.toggleTarget).off(N)}if(!n.modal){E.unbind(C,o._mousedownProxy);S.unbind(I,o._resizeProxy)}if(n.appendTo[0]===document.body){r=s.parent(".k-animation-container");if(r[0]){r.remove()}else{s.remove()}}t.destroy(o.element.children())},open:function(o,i){var s=this,r={isFixed:!isNaN(parseInt(i,10)),x:o,y:i},l=s.element,f=s.options,p="down",d,c,u=e(f.anchor);if(!s.visible()){if(f.copyAnchorStyles){l.css(t.getComputedStyles(u[0],A))}if(l.data("animating")||s.trigger(a)){return}if(!f.modal){E.unbind(C,s._mousedownProxy).bind(C,s._mousedownProxy);if(!(n.mobileOS.ios||n.mobileOS.android)){S.unbind(I,s._resizeProxy).bind(I,s._resizeProxy)}}s.wrapper=c=t.wrap(l).css({overflow:v,display:"block",position:h});if(n.mobileOS.android){c.add(u).css(H,"translatez(0)")}c.css(k);if(e(f.appendTo)[0]==document.body){c.css(m,"-10000px")}d=O(true,{},f.animation.open);s.flipped=s._position(r);d.effects=t.parseEffects(d.effects,s.flipped);p=d.effects.slideIn?d.effects.slideIn.direction:p;if(f.anchor!=w){var g=z+"-"+p;l.addClass(z+"-"+t.directions[p].reverse);u.addClass(g).children(P).addClass(x).addClass(g)}l.data(b,d.effects).kendoStop(true).kendoAnimate(d)}},toggle:function(){var e=this;e[e.visible()?l:a]()},visible:function(){return this.element.is(":"+y)},close:function(){var o=this,i=o.options,n,s,r,a;if(o.visible()){n=o.wrapper[0]?o.wrapper:t.wrap(o.element).hide();if(o._closing||o.trigger(l)){return}o.element.find(".k-popup").each(function(){var t=e(this),o=t.data("kendoPopup");if(o){o.close()}});E.unbind(C,o._mousedownProxy);S.unbind(I,o._resizeProxy);s=O(true,{},i.animation.close);r=o.element.data(b);a=s.effects;if(!a&&!t.size(a)&&r&&t.size(r)){s.effects=r;s.reverse=true}o._closing=true;o.element.kendoStop(true);n.css({overflow:v});o.element.kendoAnimate(s)}},_resize:function(e){var t=this;if(e.type==="resize"){clearTimeout(t._resizeTimeout);t._resizeTimeout=setTimeout(function(){t._position();t._resizeTimeout=null},50)}else{if(!t._hovered&&!L(t.element[0],r())){t.close()}}},_mousedown:function(o){var i=this,n=i.element[0],s=i.options,r=e(s.anchor)[0],a=s.toggleTarget,l=t.eventTarget(o),f=e(l).closest(".k-popup"),p=f.parent().parent(".km-shim").length;f=f[0];if(!p&&f&&f!==i.element[0]){return}if(e(o.target).closest("a").data("rel")==="popover"){return}if(!L(n,l)&&!L(r,l)&&!(a&&L(e(a)[0],l))){i.close()}},_fit:function(e,t,o){var i=0;if(e+t>o){i=o-(e+t)}if(e<0){i=-e}return i},_flip:function(e,t,o,i,n,s,r){var a=0;r=r||t;if(s!==n&&s!==d&&n!==d){if(e+r>i){a+=-(o+t)}if(e+a<0){a+=o+t}}return a},_position:function(t){var o=this,i=o.element.css(k,""),r=o.wrapper,a=o.options,l=e(a.viewport),f=e(l).offset(),p=e(a.anchor),d=a.origin.toLowerCase().split(" "),c=a.position.toLowerCase().split(" "),u=o.collisions,m=n.zoomLevel(),g,v,w,y=10002,b=0,x;g=p.parents().filter(r.siblings());if(g[0]){w=Number(e(g).css("zIndex"));if(w){y=w+1}else{v=p.parentsUntil(g);for(x=v.length;b<x;b++){w=Number(e(v[b]).css("zIndex"));if(w&&y<w){y=w+1}}}}r.css("zIndex",y);if(t&&t.isFixed){r.css({left:t.x,top:t.y})}else{r.css(o._align(d,c))}var z=s(r,k,p[0]===r.offsetParent()[0]),T=s(r),P=p.offsetParent().parent(".k-animation-container,.k-popup,.k-group");if(P.length){z=s(r,k,true);T=s(r)}if(l[0]===window){T.top-=window.pageYOffset||document.documentElement.scrollTop||0;T.left-=window.pageXOffset||document.documentElement.scrollLeft||0}else{T.top-=f.top;T.left-=f.left}if(!o.wrapper.data(_)){r.data(_,O({},z))}var C=O({},T),S=O({},z);if(u[0]==="fit"){S.top+=o._fit(C.top,r.outerHeight(),l.height()/m)}if(u[1]==="fit"){S.left+=o._fit(C.left,r.outerWidth(),l.width()/m)}var E=O({},S);if(u[0]==="flip"){S.top+=o._flip(C.top,i.outerHeight(),p.outerHeight(),l.height()/m,d[0],c[0],r.outerHeight())}if(u[1]==="flip"){S.left+=o._flip(C.left,i.outerWidth(),p.outerWidth(),l.width()/m,d[1],c[1],r.outerWidth())}i.css(k,h);r.css(S);return S.left!=E.left||S.top!=E.top},_align:function(t,o){var i=this,n=i.wrapper,r=e(i.options.anchor),a=t[0],l=t[1],f=o[0],p=o[1],c=s(r),m=e(i.options.appendTo),h,v=n.outerWidth(),w=n.outerHeight(),_=r.outerWidth(),k=r.outerHeight(),y=c.top,b=c.left,x=Math.round;if(m[0]!=document.body){h=s(m);y-=h.top;b-=h.left}if(a===g){y+=k}if(a===d){y+=x(k/2)}if(f===g){y-=w}if(f===d){y-=x(w/2)}if(l===u){b+=_}if(l===d){b+=x(_/2)}if(p===u){b-=v}if(p===d){b-=x(v/2)}return{top:y,left:b}}});o.plugin(F)});
define('kendoui/kendo.list',["kendoui/kendo.jquery","kendoui/kendo.core"],function(e,t){var i=t.ui,n=i.Widget,a=t.keys,r=t.support,l=t.htmlEncode,o=t._activeElement,s="id",u="li",d="change",f="character",c="k-state-focused",_="k-state-hover",p="k-loading",h="open",v="close",g="select",m="selected",b="progress",x="requestEnd",S="width",y=e.extend,w=e.proxy,C=r.browser,k=C.msie&&C.version<9,F=/"/g,I={ComboBox:"DropDownList",DropDownList:"ComboBox"};var T=n.extend({init:function(t,i){var a=this,l=a.ns,o;n.fn.init.call(a,t,i);t=a.element;a._isSelect=t.is(g);a._template();a.ul=e('<ul unselectable="on" class="k-list k-reset"/>').css({overflow:r.kineticScrollNeeded?"":"auto"}).on("mouseenter"+l,u,function(){e(this).addClass(_)}).on("mouseleave"+l,u,function(){e(this).removeClass(_)}).on("click"+l,u,w(a._click,a)).attr({tabIndex:-1,role:"listbox","aria-hidden":true});a.list=e("<div class='k-list-container'/>").append(a.ul).on("mousedown"+l,function(e){e.preventDefault()});o=t.attr(s);if(o){a.list.attr(s,o+"-list");a.ul.attr(s,o+"_listbox");a._optionID=o+"_option_selected"}a._accessors();a._initValue()},options:{valuePrimitive:false},setOptions:function(e){n.fn.setOptions.call(this,e);if(e&&e.enable!==undefined){e.enabled=e.enable}},focus:function(){this._focused.focus()},readonly:function(e){this._editable({readonly:e===undefined?true:e,disable:false})},enable:function(e){this._editable({readonly:false,disable:!(e=e===undefined?true:e)})},_filterSource:function(e){var t=this,i=t.options,n=t.dataSource,a=n.filter()||{};D(a,i.dataTextField);if(e){a=a.filters||[];a.push(e)}n.filter(a)},_initValue:function(){var e=this,t=e.options.value;if(t){e.element.val(t)}else{t=e.element.val()}e._old=t},_ignoreCase:function(){var e=this,t=e.dataSource.reader.model,i;if(t&&t.fields){i=t.fields[e.options.dataTextField];if(i&&i.type&&i.type!=="string"){e.options.ignoreCase=false}}},items:function(){return this.ul[0].children},current:function(e){var t=this,i=t._optionID;if(e!==undefined){if(t._current){t._current.removeClass(c).removeAttr("aria-selected").removeAttr(s);t._focused.removeAttr("aria-activedescendant")}if(e){e.addClass(c);t._scroll(e);if(i){e.attr("id",i);t._focused.attr("aria-activedescendant",i)}}t._current=e}else{return t._current}},destroy:function(){var e=this,t=e.ns;n.fn.destroy.call(e);e._unbindDataSource();e.ul.off(t);e.list.off(t);e.popup.destroy();if(e._form){e._form.off("reset",e._resetHandler)}},dataItem:function(e){var t=this;if(e===undefined){e=t.selectedIndex}return t._data()[e]},_accessors:function(){var e=this,i=e.element,n=e.options,a=t.getter,r=i.attr(t.attr("text-field")),l=i.attr(t.attr("value-field"));if(r){n.dataTextField=r}if(l){n.dataValueField=l}e._text=a(n.dataTextField);e._value=a(n.dataValueField)},_aria:function(e){var t=this,i=t.options,n=t._focused;if(i.suggest!==undefined){n.attr("aria-autocomplete",i.suggest?"both":"list")}e=e?e+" "+t.ul[0].id:t.ul[0].id;n.attr("aria-owns",e);t.ul.attr("aria-live",!i.filter||i.filter==="none"?"off":"polite")},_blur:function(){var e=this;e._change();e.close()},_change:function(){var e=this,t=e.selectedIndex,i=e.options.value,n=e.value(),a;if(e._isSelect&&!e._bound&&i){n=i}if(n!==e._old){a=true}else if(t!==undefined&&t!==e._oldIndex){a=true}if(a){e._old=n;e._oldIndex=t;e.trigger(d);e.element.trigger(d)}},_click:function(t){if(!t.isDefaultPrevented()){this._accept(e(t.currentTarget))}},_data:function(){return this.dataSource.view()},_enable:function(){var e=this,t=e.options,i=e.element.is("[disabled]");if(t.enable!==undefined){t.enabled=t.enable}if(!t.enabled||i){e.enable(false)}else{e.readonly(e.element.is("[readonly]"))}},_focus:function(e){var t=this;if(t.popup.visible()&&e&&t.trigger(g,{item:e})){t.close();return}t._select(e);t._triggerCascade();t._blur()},_index:function(e){var t=this,i,n,a=t._data();for(i=0,n=a.length;i<n;i++){if(t._dataValue(a[i])==e){return i}}return-1},_dataValue:function(e){var t=this._value(e);if(t===undefined){t=this._text(e)}return t},_height:function(e){if(e){var t=this,i=t.list,n=t.popup.visible(),a=t.options.height;i=i.add(i.parent(".k-animation-container")).show().height(t.ul[0].scrollHeight>a?a:"auto");if(!n){i.hide()}}},_adjustListWidth:function(){var e=this.list,t=e[0].style.width,i=this.wrapper,n,a;if(!e.data(S)&&t){return}n=window.getComputedStyle?window.getComputedStyle(i[0],null):0;a=n?parseFloat(n.width):i.outerWidth();if(n&&(C.mozilla||C.msie)){a+=parseFloat(n.paddingLeft)+parseFloat(n.paddingRight)+parseFloat(n.borderLeftWidth)+parseFloat(n.borderRightWidth)}t=a-(e.outerWidth()-e.width());e.css({fontFamily:i.css("font-family"),width:t}).data(S,t);return true},_popup:function(){var e=this,n=e.list,a=e._focused,l=e.options,o=e.wrapper;e.popup=new i.Popup(n,y({},l.popup,{anchor:o,open:function(t){e._adjustListWidth();if(e.trigger(h)){t.preventDefault()}else{a.attr("aria-expanded",true);e.ul.attr("aria-hidden",false)}},close:function(t){if(e.trigger(v)){t.preventDefault()}else{a.attr("aria-expanded",false);e.ul.attr("aria-hidden",true)}},animation:l.animation,isRtl:r.isRtl(o)}));e.popup.one(h,function(){e._height(e._data().length)});e._touchScroller=t.touchScroller(e.popup.element)},_makeUnselectable:function(){if(k){this.list.find("*").attr("unselectable","on")}},_toggleHover:function(t){e(t.currentTarget).toggleClass(_,t.type==="mouseenter")},_toggle:function(e){var t=this;e=e!==undefined?e:!t.popup.visible();if(!r.touch&&t._focused[0]!==o()){t._focused.focus()}t[e?h:v]()},_scroll:function(e){if(!e){return}if(e[0]){e=e[0]}var t=this.ul[0],i=e.offsetTop,n=e.offsetHeight,a=t.scrollTop,r=t.clientHeight,l=i+n;t.scrollTop=a>i?i:l>a+r?l-r:a},_template:function(){var e=this,i=e.options,n=i.template,a=i.dataSource;if(e._isSelect&&e.element[0].length){if(!a){i.dataTextField=i.dataTextField||"text";i.dataValueField=i.dataValueField||"value"}}if(!n){e.template=t.template('<li tabindex="-1" role="option" unselectable="on" class="k-item">${'+t.expr(i.dataTextField,"data")+"}</li>",{useWithBlock:false})}else{n=t.template(n);e.template=function(e){return'<li tabindex="-1" role="option" unselectable="on" class="k-item">'+n(e)+"</li>"}}},_triggerCascade:function(){var e=this,t=e.value();if(!e._bound&&t||e._old!==t){e.trigger("cascade")}},_unbindDataSource:function(){var e=this;e.dataSource.unbind(d,e._refreshHandler).unbind(b,e._progressHandler).unbind(x,e._requestEndHandler).unbind("error",e._errorHandler)}});y(T,{caret:function(e){var t,i=e.ownerDocument.selection;if(i){t=Math.abs(i.createRange().moveStart(f,-e.value.length))}else{t=e.selectionStart}return t},selectText:function(e,t,i){try{if(e.createTextRange){e.focus();var n=e.createTextRange();n.collapse(true);n.moveStart(f,t);n.moveEnd(f,i-t);n.select()}else{e.setSelectionRange(t,i)}}catch(a){}},inArray:function(e,t){var i,n,a=t.children;if(!e||e.parentNode!==t){return-1}for(i=0,n=a.length;i<n;i++){if(e===a[i]){return i}}return-1}});t.ui.List=T;i.Select=T.extend({init:function(e,t){T.fn.init.call(this,e,t);this._initial=this.element.val()},setDataSource:function(e){this.options.dataSource=e;this._dataSource();if(this.options.autoBind){this.dataSource.fetch()}},close:function(){this.popup.close()},select:function(e){var t=this;if(e===undefined){return t.selectedIndex}else{t._select(e);t._triggerCascade();t._old=t._accessor();t._oldIndex=t.selectedIndex}},_accessor:function(e,t){var i=this.element[0],n=this._isSelect,a=i.selectedIndex,r;if(e===undefined){if(n){if(a>-1){r=i.options[a];if(r){e=r.value}}}else{e=i.value}return e}else{if(n){if(a>-1){i.options[a].removeAttribute(m)}i.selectedIndex=t;r=i.options[t];if(r){r.setAttribute(m,m)}}else{i.value=e}}},_hideBusy:function(){var e=this;clearTimeout(e._busy);e._arrow.removeClass(p);e._focused.attr("aria-busy",false);e._busy=null},_showBusy:function(){var e=this;e._request=true;if(e._busy){return}e._busy=setTimeout(function(){e._focused.attr("aria-busy",true);e._arrow.addClass(p)},100)},_requestEnd:function(){this._request=false},_dataSource:function(){var i=this,n=i.element,a=i.options,r=a.dataSource||{},l;r=e.isArray(r)?{data:r}:r;if(i._isSelect){l=n[0].selectedIndex;if(l>-1){a.index=l}r.select=n;r.fields=[{field:a.dataTextField},{field:a.dataValueField}]}if(i.dataSource&&i._refreshHandler){i._unbindDataSource()}else{i._refreshHandler=w(i.refresh,i);i._progressHandler=w(i._showBusy,i);i._requestEndHandler=w(i._requestEnd,i);i._errorHandler=w(i._hideBusy,i)}i.dataSource=t.data.DataSource.create(r).bind(d,i._refreshHandler).bind(b,i._progressHandler).bind(x,i._requestEndHandler).bind("error",i._errorHandler)},_get:function(t){var i=this,n=i._data(),a,r;if(typeof t==="function"){for(a=0,r=n.length;a<r;a++){if(t(n[a])){t=a;break}}}if(typeof t==="number"){if(t<0){return e()}t=e(i.ul[0].children[t])}if(t&&t.nodeType){t=e(t)}return t},_move:function(e){var t=this,i=e.keyCode,n=t.ul[0],r=t.popup.visible()?"_select":"_accept",l=t._current,o=i===a.DOWN,s,u;if(i===a.UP||o){if(e.altKey){t.toggle(o)}else{s=n.firstChild;if(!s&&!t._accessor()&&t._state!=="filter"){t.dataSource.one(d,function(){t._move(e)});t._filterSource();e.preventDefault();return true}if(o){if(!l||t.selectedIndex===-1&&!t.value()&&l[0]===s){l=s}else{l=l[0].nextSibling;if(!l&&s===n.lastChild){l=s}}t[r](l)}else{l=l?l[0].previousSibling:n.lastChild;if(!l&&s===n.lastChild){l=s}t[r](l)}}e.preventDefault();u=true}else if(i===a.ENTER||i===a.TAB){if(t.popup.visible()){e.preventDefault()}t._accept(l);u=true}else if(i===a.ESC){if(t.popup.visible()){e.preventDefault()}t.close();u=true}return u},_selectItem:function(e){var t=this,i=t.options,n=t.selectedIndex;e=t._selectedValue||i.value||t._accessor();if(e){t.value(e)}else if(!t._bound||n>-1){if(!t._bound){n=i.index}t.select(n)}},_fetchItems:function(e){var t=this,i=t.ul[0].firstChild;if(t._request){return true}if(!t._fetch&&!i){if(t.options.cascadeFrom){return!i}t.dataSource.one(d,function(){t.value(e);t._fetch=false});t._fetch=true;t.dataSource.fetch();return true}},_options:function(t,i){var n=this,a=n.element,r=a[0].selectedIndex,o=t.length,s="",u,d,f,c,_=0;if(i){_=1;s=i;if(i.indexOf(e(a[0].firstChild).text())===-1){r+=1}}for(;_<o;_++){u="<option";d=t[_];f=n._text(d);c=n._value(d);if(c!==undefined){c+="";if(c.indexOf('"')!==-1){c=c.replace(F,"&quot;")}u+=' value="'+c+'"'}u+=">";if(f!==undefined){u+=l(f)}u+="</option>";s+=u}a.html(s);a[0].selectedIndex=r===-1?0:r},_reset:function(){var t=this,i=t.element,n=i.attr("form"),a=n?e("#"+n):i.closest("form");if(a[0]){t._resetHandler=function(){setTimeout(function(){t.value(t._initial)})};t._form=a.on("reset",t._resetHandler)}},_cascade:function(){var t=this,i=t.options,n=i.cascadeFrom,a,r,l,o,s;if(n){t._selectedValue=i.value||t._accessor();r=e("#"+n);a=r.data("kendo"+i.name);if(!a){a=r.data("kendo"+I[i.name])}if(!a){return}i.autoBind=false;o=a.options.dataValueField;s=function(){var e=t._selectedValue||t.value();if(e){t.value(e);if(!t.dataSource.view()[0]||t.selectedIndex===-1){t._clearSelection(a,true)}}else{t.select(i.index)}t.enable();t._triggerCascade()};l=function(){var e=a.dataItem(),i=e?a._value(e):null,n,r;if(i||i===0){n=t.dataSource.filter()||{};D(n,o);r=n.filters||[];r.push({field:o,operator:"eq",value:i});t.dataSource.one(d,s).filter(r)}else{t.enable(false);t._clearSelection(a);t._triggerCascade()}};a.bind("cascade",function(){l()});if(a._bound){l()}else if(!a.value()){t.enable(false)}}}});function D(t,i){if(t.filters){t.filters=e.grep(t.filters,function(e){D(e,i);if(e.filters){return e.filters.length}else{return e.field!=i}})}}});
define('kendoui/kendo.dropdownlist',["kendoui/kendo.jquery","kendoui/kendo.core","kendoui/kendo.data","kendoui/kendo.fx","kendoui/kendo.popup","kendoui/kendo.list"],function(e,t){var n=t.ui,i=n.Select,a=t.support.mobileOS,o=".kendoDropDownList",s="disabled",r="readonly",l="change",d="k-state-focused",u="k-state-default",f="k-state-disabled",p="aria-disabled",c="aria-readonly",_="k-state-selected",h="mouseenter"+o+" mouseleave"+o,v="tabindex",g=e.proxy;var x=i.extend({init:function(n,a){var s=this,r=a&&a.index,l,d,u;s.ns=o;a=e.isArray(a)?{dataSource:a}:a;i.fn.init.call(s,n,a);s._focusHandler=function(){s.wrapper.focus()};a=s.options;n=s.element.on("focus"+o,s._focusHandler);s._reset();s._word="";s._wrapper();s._tabindex();s.wrapper.data(v,s.wrapper.attr(v));s._aria();s._span();s._popup();s._mobile();s._dataSource();s._ignoreCase();s._enable();s._oldIndex=s.selectedIndex=-1;s._cascade();if(r!==undefined){a.index=r}if(a.autoBind){s.dataSource.fetch()}else if(s.selectedIndex===-1){u=a.text||"";if(!u){l=s._optionLabelText(a.optionLabel),d=l&&a.index===0;if(s._isSelect){if(d){u=l}else{u=n.children(":selected").text()}}else if(!n[0].value&&d){u=l}}s.text(u)}t.notify(s)},options:{name:"DropDownList",enabled:true,autoBind:true,index:0,text:null,value:null,template:"",delay:500,height:200,dataTextField:"",dataValueField:"",optionLabel:"",cascadeFrom:"",ignoreCase:true,animation:{}},events:["open","close",l,"select","dataBinding","dataBound","cascade"],setOptions:function(e){i.fn.setOptions.call(this,e);this._template();this._accessors();this._aria()},destroy:function(){var e=this;e.wrapper.off(o);e.element.off(o);e._inputWrapper.off(o);i.fn.destroy.call(e)},open:function(){var e=this;if(!e.ul[0].firstChild){e._open=true;if(!e._request){e.dataSource.fetch()}}else{e.popup.open();e._scroll(e._current)}},toggle:function(e){this._toggle(e)},refresh:function(){var e=this,n=e._data(),i=n.length,a=e.options.optionLabel;e.trigger("dataBinding");if(e._current){e.current(null)}e.ul[0].innerHTML=t.render(e.template,n);e._height(i);if(e.popup.visible()){e.popup._position()}if(e._isSelect){if(a&&i){a=e._optionLabelText(a);a='<option value="">'+a+"</option>"}e._options(n,a)}if(e._open){e._open=false;e.toggle(!!i)}e._hideBusy();e._makeUnselectable();if(!e._fetch&&i){e._selectItem()}e._bound=true;e.trigger("dataBound")},search:function(e){if(e){var t=this,n=t.options.ignoreCase;if(n){e=e.toLowerCase()}t._select(function(i){var a=t._text(i);if(a!==undefined){a=a+"";if(n){a=a.toLowerCase()}return a.indexOf(e)===0}})}},text:function(e){var t=this.span;if(e!==undefined){t.text(e)}else{return t.text()}},value:function(e){var t=this,n,i;if(e!==undefined){if(e!==null){e=e.toString()}t._selectedValue=e;i=e||t.options.optionLabel&&!t.element[0].disabled&&e==="";if(i&&t._fetchItems(e)){return}n=t._index(e);t.select(n>-1?n:0)}else{return t._accessor()}},_editable:function(e){var n=this,i=n.element,a=e.disable,l=e.readonly,_=n.wrapper.off(o),x=n._inputWrapper.off(h),b=function(){x.addClass(d);n._blured=false},k=function(){if(!n._blured){n._triggerCascade();var e=window.self!==window.top;if(t.support.mobileOS.ios&&e){n._change()}else{n._blur()}x.removeClass(d);n._blured=true;i.blur()}};if(!l&&!a){i.removeAttr(s).removeAttr(r);x.addClass(u).removeClass(f).on(h,n._toggleHover);_.attr(v,_.data(v)).attr(p,false).attr(c,false).on("click"+o,function(e){n._blured=false;e.preventDefault();n.toggle()}).on("keydown"+o,g(n._keydown,n)).on("keypress"+o,g(n._keypress,n)).on("focusin"+o,b).on("focusout"+o,k)}else{if(a){_.removeAttr(v);x.addClass(f).removeClass(u)}else{x.addClass(u).removeClass(f);_.on("focusin"+o,b).on("focusout"+o,k)}i.attr(s,a).attr(r,l);_.attr(p,a).attr(c,l)}},_accept:function(e){this._focus(e)},_optionLabelText:function(){var e=this.options,t=e.dataTextField,n=e.optionLabel;if(n&&t&&typeof n==="object"){return this._text(n)}return n},_data:function(){var e=this,n=e.options,i=n.optionLabel,a=n.dataTextField,o=n.dataValueField,s=e.dataSource.view(),r=s.length,l=i,d=0;if(i&&r){if(typeof i==="object"){l=i}else if(a){l={};a=a.split(".");o=o.split(".");b(l,o,"");b(l,a,i)}l=new t.data.ObservableArray([l]);for(;d<r;d++){l.push(s[d])}s=l}return s},_keydown:function(e){var n=this,i=e.keyCode,a=t.keys,o=n.ul[0];if(i===a.LEFT){i=a.UP}else if(i===a.RIGHT){i=a.DOWN}e.keyCode=i;n._move(e);if(i===a.HOME){e.preventDefault();n._select(o.firstChild)}else if(i===a.END){e.preventDefault();n._select(o.lastChild)}},_selectNext:function(e,t){var n=this,i,a=t,o=n._data(),s=o.length,r=n.options.ignoreCase,l=function(t,i){t=t+"";if(r){t=t.toLowerCase()}if(t.indexOf(e)===0){n._select(i);n._triggerEvents();return true}};for(;t<s;t++){i=n._text(o[t]);if(i&&l(i,t)){return true}}if(a>0){t=0;for(;t<=a;t++){i=n._text(o[t]);if(i&&l(i,t)){return true}}}return false},_keypress:function(e){var t=this,n=String.fromCharCode(e.charCode||e.keyCode),i=t.selectedIndex,a=t._word;if(t.options.ignoreCase){n=n.toLowerCase()}if(n===" "){e.preventDefault()}if(t._last===n&&a.length<=1&&i>-1){if(!a){a=n}if(t._selectNext(a,i+1)){return}}t._word=a+n;t._last=n;t._search()},_popup:function(){i.fn._popup.call(this);this.popup.one("open",function(){this.wrapper=t.wrap(this.element).addClass("km-popup")})},_search:function(){var e=this,t=e.dataSource,n=e.selectedIndex,i=e._word;clearTimeout(e._typing);e._typing=setTimeout(function(){e._word=""},e.options.delay);if(!e.ul[0].firstChild){t.one(l,function(){if(t.data()[0]){e._selectNext(i,n)}}).fetch();return}e._selectNext(i,n);e._triggerEvents()},_select:function(e){var t=this,i=t._current,a=t._data(),o,s,r;e=t._get(e);if(e&&e[0]&&!e.hasClass(_)){if(i){i.removeClass(_)}r=n.List.inArray(e[0],t.ul[0]);if(r>-1){a=a[r];s=t._text(a);o=t._value(a);t.selectedIndex=r;t.text(s);t._accessor(o!==undefined?o:s,r);t._selectedValue=t._accessor();t.current(e.addClass(_));if(t._optionID){t._current.attr("aria-selected",true)}}}},_triggerEvents:function(){if(!this.popup.visible()){this._triggerCascade();this._change()}},_mobile:function(){var e=this,t=e.popup,n=t.element.parents(".km-root").eq(0);if(n.length&&a){t.options.animation.open.effects=a.android||a.meego?"fadeIn":a.ios||a.wp?"slideIn:up":t.options.animation.open.effects}},_span:function(){var t=this,n=t.wrapper,i="span.k-input",a;a=n.find(i);if(!a[0]){n.append('<span unselectable="on" class="k-dropdown-wrap k-state-default"><span unselectable="on" class="k-input">&nbsp;</span><span unselectable="on" class="k-select"><span unselectable="on" class="k-icon k-i-arrow-s">select</span></span></span>').append(t.element);a=n.find(i)}t.span=a;t._inputWrapper=e(n[0].firstChild);t._arrow=n.find(".k-icon").mousedown(function(e){e.preventDefault()})},_wrapper:function(){var e=this,t=e.element,n=t[0],i;i=t.parent();if(!i.is("span.k-widget")){i=t.wrap("<span />").parent();i[0].style.cssText=n.style.cssText}t.hide();e._focused=e.wrapper=i.addClass("k-widget k-dropdown k-header").addClass(n.className).css("display","").attr({unselectable:"on",role:"listbox","aria-haspopup":true,"aria-expanded":false})},_clearSelection:function(){var e=this,t=e.options.optionLabel;if(e.dataSource.view()[0]&&t){e.select(0);return}e.text(t);e.element.val("");e.selectedIndex=-1}});function b(e,t,n){var i=0,a=t.length-1,o;for(;i<a;++i){o=t[i];if(!(o in e)){e[o]={}}e=e[o]}e[t[a]]=n}n.plugin(x)});
define('lib/dom',["require", "exports", "jql"], function(require, exports, __$__) {
    ///<reference path="../vendor/jquery/jquery.d.ts"/>
    var $ = __$__;

    function blurAll() {
        // this will strangely push the window to the back in IE
        // a fix for this same problem found via https://github.com/jquery/jquery-mobile/issues/2821
        try  {
            if(document.activeElement) {
                if(document.activeElement.nodeName.toLowerCase() !== 'body') {
                    var $active = $(document.activeElement);
                    if($active.closest('.trucode').length) {
                        $active.blur();
                        try  {
                            document.selection.empty();
                        } catch (e) {
                        }
                        try  {
                            document.getSelection().removeAllRanges();
                        } catch (e) {
                        }
                    }
                }
            }
        } catch (e) {
        }
        $('input:focus, select:focus').blur();
    }
    exports.blurAll = blurAll;
    function parentToChild($el, parentSelector, childSelector) {
        return $el.closest(parentSelector).find(childSelector);
    }
    exports.parentToChild = parentToChild;
    function focusWithoutWindowScroll($el) {
        var $win, x, y;
        if($el.length) {
            $win = $(window);
            x = $win.scrollLeft();
            y = $win.scrollTop();
            $el.focus();
            $win.scrollLeft(x);
            $win.scrollTop(y);
        }
        return $el;
    }
    exports.focusWithoutWindowScroll = focusWithoutWindowScroll;
    function focusWithoutPaneScroll($el) {
        var $win, x, y, $scrollParent, x1, y1;
        if($el.length) {
            $win = $(window);
            x = $win.scrollLeft();
            y = $win.scrollTop();
            $scrollParent = $el.closest('.pane-scrollable > .pane-content');
            x1 = $scrollParent.scrollLeft();
            y1 = $scrollParent.scrollTop();
            $el.focus();
            $win.scrollLeft(x);
            $win.scrollTop(y);
            $scrollParent.scrollLeft(x1);
            $scrollParent.scrollTop(y1);
        }
        return $el;
    }
    exports.focusWithoutPaneScroll = focusWithoutPaneScroll;
})
;
define('lib/templates',["require", "exports", "underscore", "lib/api"], function(require, exports, _____, __api__) {
    ///<reference path="../vendor/underscore/underscore.d.ts"/>
    var _ = _____;

    var api = __api__;
    /**
    * Find out the string key required for {@link TC#templates TC.templates} to override a template. For example, *codebooksWrapper* is the string key required to override the *controls/codebooks/templates/encoder.html* template.
    *
    * **Static templates** are not transformed and therefore cannot contain variables nor template code. They are pure HTML.
    *
    * **Compiled templates** are currently rendered by <a href="http://underscorejs.org/#template" target="_blank">Underscore.js's template</a> function. They are rendered each time they are called.
    *
    * @class Templates
    * @singleton
    */
    /** @ignore */
    
    function compile(name, defaultTemplate, isStatic) {
        var userTemplate = api.TC.current().settings.templates[name];
        isStatic = isStatic || false;
        // loading remote templates likely isn't feasible
        // currently stuck with the user smashing a template into a string variable
        // other options...
        // 1. using a synchronous request is a /terrible/ solution
        // 2. loading all of a users custom templates prior to initialization is more work than its worth
        // 3. users grab the templates themselves (server side script embed/etc)
        //if (userTemplate.indexOf('http:') === 0)
        if(userTemplate) {
            return (!isStatic) ? _.template(userTemplate) : userTemplate;
        }
        return (!isStatic) ? _.template(defaultTemplate) : defaultTemplate;
    }
    exports.compile = compile;
    /** @ignore */
    function get(name, defaultTemplate) {
        return compile(name, defaultTemplate, true);
    }
    exports.get = get;
    /**
    * Codebooks wrapper template.
    * @compiledTemplate
    */
    exports.codebooksWrapper = 'controls/codebooks/templates/encoder.html';
    exports.tk_codebooksWrapper = 'codebooksWrapper';
    /**
    * Codebooks template for the index portion when no search results were found.
    * @staticTemplate
    */
    exports.indexNoResults = 'controls/codebooks/templates/index/index-no-results.html';
    exports.tk_indexNoResults = 'indexNoResults';
    /**
    * Codebooks template for the index portion when first initialized or the search yielded only tabular results.
    * @staticTemplate
    */
    exports.indexEmpty = 'controls/codebooks/templates/index/index-empty.html';
    exports.tk_indexEmpty = 'indexEmpty';
    /**
    * Codebooks template for the index portion when building an ICD-10 procedure code.
    * @compiledTemplate
    */
    exports.indexPCS = 'controls/codebooks/templates/index/index-pcs.html';
    exports.tk_indexPCS = 'indexPCS';
    /**
    * Codebooks template for the index portion title when first initialized.
    * @compiledTemplate
    */
    exports.indexHeadingEmpty = 'controls/codebooks/templates/index/index-heading-empty.html';
    exports.tk_indexHeadingEmpty = 'indexHeadingEmpty';
    /**
    * Codebooks template for when the search bar has trouble retrieving the available books.
    * @staticTemplate
    */
    exports.searchbarError = 'controls/codebooks/templates/searchbar/codebooks-error.html';
    exports.tk_searchbarError = 'searchbarError';
    /**
    * Codebooks template for the dynamic table header when a drug table is in context.
    * @staticTemplate
    */
    exports.drugHeading = 'controls/codebooks/templates/tableHeadings/drug-ICD9.html';
    exports.tk_drugHeading = 'drugHeading';
    /**
    * Codebooks template for the dynamic table header when an ICD-10 drug table is in context.
    * @staticTemplate
    */
    exports.drugHeadingICD10 = 'controls/codebooks/templates/tableHeadings/drug-ICD10.html';
    exports.tk_drugHeadingICD10 = 'drugHeadingICD10';
    /**
    * Codebooks template for the dynamic table header when a hypertension table is in context.
    * @staticTemplate
    */
    exports.hypertensionHeading = 'controls/codebooks/templates/tableHeadings/hypertension.html';
    exports.tk_hypertensionHeading = 'hypertensionHeading';
    /**
    * Codebooks template for the dynamic table header when a neoplasm table is in context.
    * @staticTemplate
    */
    exports.neoplasmHeading = 'controls/codebooks/templates/tableHeadings/neoplasm.html';
    exports.tk_neoplasmHeading = 'neoplasmHeading';
    /**
    * References template for the notes title bar.
    * @staticTemplate
    */
    exports.referencesDetailNotesTitle = 'controls/references/templates/detail/notes-title.html';
    exports.tk_referencesDetailNotesTitle = 'referencesDetailNotesTitle';
    /**
    * Large loading indicator used various times throughout the app during ajax requests.
    * @staticTemplate
    */
    exports.loadingLarge = 'controls/common/templates/loading-large.html';
    exports.tk_loadingLarge = 'loadingLarge';
    /**
    * References template for when the search bar has trouble retrieving the available books.
    * @staticTemplate
    */
    exports.referencesBooksError = 'controls/references/templates/searchbar/books-error.html';
    exports.tk_referencesBooksError = 'referencesBooksError';
    /**
    * Small loading indicator used various times throughout the app during ajax requests.
    * @staticTemplate
    */
    exports.loadingSmall = 'controls/common/templates/loading-small.html';
    exports.tk_loadingSmall = 'loadingSmall';
    /**
    * Small loading indicator used various times throughout the app during ajax requests. It fills up all available width.
    * @staticTemplate
    */
    exports.loadingSmallWide = 'controls/common/templates/loading-small-wide.html';
    exports.tk_loadingSmallWide = 'loadingSmallWide';
    /**
    * Modal template wrapper.
    * @staticTemplate
    */
    exports.modal = 'controls/common/templates/modal.html';
    exports.tk_modal = 'modal';
    /**
    * Modal template helper for confirmation dialog. Used for dual-code posting scenarios.
    * @staticTemplate
    */
    exports.modalConfirm = 'controls/common/templates/modal-confirm-buttons.html';
    exports.tk_modalConfirm = 'modalConfirm';
    /**
    * Codebooks template for the index portion title bar.
    * @compiledTemplate
    */
    exports.indexHeading = 'controls/codebooks/templates/index/index-heading.html';
    exports.tk_indexHeading = 'indexHeading';
    /**
    * Codebooks template for the index portion results.
    * @compiledTemplate
    */
    exports.indexResults = 'controls/codebooks/templates/index/index.html';
    exports.tk_indexResults = 'indexResults';
    /**
    * Codebooks template for the search bar.
    * @compiledTemplate
    */
    exports.searchbar = 'controls/codebooks/templates/searchbar/searchbar.html';
    exports.tk_searchbar = 'searchbar';
    /**
    * Codebooks template for the tabular portion wrapper.
    * @compiledTemplate
    */
    exports.tabularWrapper = 'controls/codebooks/templates/tabular/wrapper.html';
    exports.tk_tabularWrapper = 'tabularWrapper';
    /**
    * Codebooks template for the tabular portion when the results are from an ICD-9 index book.
    * @compiledTemplate
    */
    exports.tabularIndex = 'controls/codebooks/templates/tabular/index.html';
    exports.tk_tabularIndex = 'tabularIndex';
    /**
    * Codebooks template for the tabular portion when the results are from an ICD-9 tabular book.
    * @compiledTemplate
    */
    exports.tabularTabular = 'controls/codebooks/templates/tabular/tabular.html';
    exports.tk_tabularTabular = 'tabularTabular';
    /**
    * Codebooks template for the tabular portion when the results are from the ICD-10-PCS tabular book. This is the wrapper.
    * @compiledTemplate
    */
    exports.tabularPCSWrapper = 'controls/codebooks/templates/tabular/pcs-wrapper.html';
    exports.tk_tabularPCSWrapper = 'tabularPCSWrapper';
    /**
    * Codebooks template for the tabular portion when the results are from the ICD-10-PCS tabular book. This is for column headings.
    * @compiledTemplate
    */
    exports.tabularPCSColumnHead = 'controls/codebooks/templates/tabular/pcs-column-head.html';
    exports.tk_tabularPCSColumnHead = 'tabularPCSColumnHead';
    /**
    * Codebooks template for the tabular portion when the results are from the ICD-10-PCS tabular book. This is for the column choices.
    * @compiledTemplate
    */
    exports.tabularPCSColumnChoices = 'controls/codebooks/templates/tabular/pcs-column-choices.html';
    exports.tk_tabularPCSColumnChoices = 'tabularPCSColumnChoices';
    /**
    * Codebooks template for the tabular portion when all crosswalk results are displayed.
    * @compiledTemplate
    */
    exports.tabularTabularCrosswalk = 'controls/codebooks/templates/tabular/crosswalk.html';
    exports.tk_tabularTabularCrosswalk = 'tabularTabularCrosswalk';
    /**
    * Codebooks template for the tabular portion when the results are from the CPT4 book.
    * @compiledTemplate
    */
    exports.tabularTabularCPT = 'controls/codebooks/templates/tabular/cpt.html';
    exports.tk_tabularTabularCPT = 'tabularTabularCPT';
    /**
    * Codebooks template for the tabular portion when the results are from the HCPCS book.
    * @compiledTemplate
    */
    exports.tabularTabularHCPCS = 'controls/codebooks/templates/tabular/hcpcs.html';
    exports.tk_tabularTabularHCPCS = 'tabularTabularHCPCS';
    /**
    * Codebooks template for the instructional note results wrapper.
    * @compiledTemplate
    */
    exports.instructionalNote = 'controls/codebooks/templates/instructional-note.html';
    exports.tk_instructionalNote = 'instructionalNote';
    /**
    * Codebooks template for the modifiers pop-up.
    * @compiledTemplate
    */
    exports.modifiers = 'controls/codebooks/templates/modifiers.html';
    exports.tk_modifiers = 'modifiers';
    /**
    * Codebooks template for the modal window activated by viewing a CPT image.
    * @compiledTemplate
    */
    exports.cptImageModal = 'controls/codebooks/templates/tabular/cpt-image-modal.html';
    exports.tk_cptImageModal = 'cptImageModal';
    /**
    * References template for the details portion title bar.
    * @compiledTemplate
    */
    exports.referencesDetailContentTitle = 'controls/references/templates/detail/details-title.html';
    exports.tk_referencesDetailContentTitle = 'referencesDetailContentTitle';
    /**
    * References template for the highlight bar.
    * @compiledTemplate
    */
    exports.referencesDetailHighlight = 'controls/references/templates/detail/details-highlight.html';
    exports.tk_referencesDetailHighlight = 'referencesDetailHighlight';
    /**
    * References template for the details portion.
    * @compiledTemplate
    */
    exports.referencesDetailContent = 'controls/references/templates/detail/details.html';
    exports.tk_referencesDetailContent = 'referencesDetailContent';
    /**
    * References template for the notes portion.
    * @compiledTemplate
    */
    exports.referencesDetailNotes = 'controls/references/templates/detail/notes.html';
    exports.tk_referencesDetailNotes = 'referencesDetailNotes';
    /**
    * References template for the navigation portion's search results.
    * @compiledTemplate
    */
    exports.referencesListSearchResults = 'controls/references/templates/list/search.html';
    exports.tk_referencesListSearchResults = 'referencesListSearchResults';
    /**
    * References template for the navigation portion's title bar.
    * @compiledTemplate
    */
    exports.referencesListTitle = 'controls/references/templates/list/title.html';
    exports.tk_referencesListTitle = 'referencesListTitle';
    /**
    * References template for the navigation portion's browse book results.
    * @compiledTemplate
    */
    exports.referencesListTree = 'controls/references/templates/list/tree.html';
    exports.tk_referencesListTree = 'referencesListTree';
    /**
    * References template for the navigation portion's browse drop-down menu.
    * @compiledTemplate
    */
    exports.referencesBrowse = 'controls/references/templates/list/browse.html';
    exports.tk_referencesBrowse = 'referencesBrowse';
    /**
    * References template structure wrapper.
    * @compiledTemplate
    */
    exports.referencesWrapper = 'controls/references/templates/references.html';
    exports.tk_referencesWrapper = 'referencesWrapper';
    /**
    * References template for the search bar.
    * @compiledTemplate
    */
    exports.referencesSearchbar = 'controls/references/templates/searchbar/searchbar.html';
    exports.tk_referencesSearchbar = 'referencesSearchbar';
    /**
    * Research control template for the **DRG Analysis** pane results.
    * @compiledTemplate
    */
    exports.drgAnalysisTab = 'controls/research/templates/drg-analyze-pane/result.html';
    exports.tk_drgAnalysisTab = 'drgAnalysisTab';
    /**
    * Research control template for the **DRG Analysis** pane when there are no results or when first initialized.
    * @compiledTemplate
    */
    exports.drgAnalysisTabNone = 'controls/research/templates/drg-analyze-pane/empty.html';
    exports.tk_drgAnalysisTabNone = 'drgAnalysisTabNone';
    /**
    * Research control template for the **Edits** pane results.
    * @compiledTemplate
    */
    exports.editsTab = 'controls/research/templates/edits-pane/result.html';
    exports.tk_editsTab = 'editsTab';
    /**
    * Research control template for the **Edits** pane when there are no results or when first initialized.
    * @compiledTemplate
    */
    exports.editsTabEmpty = 'controls/research/templates/edits-pane/empty.html';
    exports.tk_editsTabEmpty = 'editsTabEmpty';
    /**
    * Research control template for the **ICD-10** pane results.
    * @compiledTemplate
    */
    exports.icd10mapTab = 'controls/research/templates/icd10map-pane/result.html';
    exports.tk_icd10mapTab = 'icd10mapTab';
    /**
    * Research control template for the **ICD-10** pane when first initialized.
    * @compiledTemplate
    */
    exports.icd10mapTabEmpty = 'controls/research/templates/icd10map-pane/empty.html';
    exports.tk_icd10mapTabEmpty = 'icd10mapTabEmpty';
    /**
    * Research control template for the **Research** pane results.
    * @compiledTemplate
    */
    exports.researchTab = 'controls/research/templates/research-pane/result.html';
    exports.tk_researchTab = 'researchTab';
    /**
    * Research control template for the **Research** pane when there are no results or when first initialized.
    * @compiledTemplate
    */
    exports.researchTabEmpty = 'controls/research/templates/research-pane/empty.html';
    exports.tk_researchTabEmpty = 'researchTabEmpty';
    /**
    * Research control template structure wrapper.
    * @compiledTemplate
    */
    exports.research = 'controls/research/templates/research.html';
    exports.tk_research = 'research';
})
;
define('lib/auth',["require", "exports", "jql", "underscore"], function(require, exports, __$__, _____) {
    ///<reference path="../vendor/jquery/jquery.d.ts" />
    var $ = __$__;

    var _ = _____;

    
    
    var Auth = (function () {
        function Auth(apiRef) {
            this.maxExpiredAuthorizationRetries = 1;
            this.api = apiRef;
            _.bindAll(this);
        }
        Auth.prototype.getAuthorizationHeader = function () {
            if(this.api.settings._dirtyAuth) {
                this.setAuthorizationHeader(this.api.settings.authorizationKey);
            }
            var authHeader = this.api.settings.authorizationTokenType + ' ' + this.api.settings.authorizationKey;
            return authHeader.indexOf('null') !== -1 ? null : authHeader;
        };
        Auth.prototype.setAuthorizationHeader = function (val) {
            if(!this.api.settings.forceProxy && !val) {
                this.api.settings.fatalErrorCallback('No authorization key provided', '', null);
            }
            var vals = val.split(' ');
            switch(vals.length) {
                case 1:
                    this.api.settings.authorizationKey = vals[0];
                    break;
                case 2:
                    this.api.settings.authorizationTokenType = vals[0];
                    this.api.settings.authorizationKey = vals[1];
                    break;
                default:
                    this.api.fatalErrorCallback('Malformed authorization key provided', '', null);
                    break;
            }
            this.api.settings._dirtyAuth = false;
            // shortcut to return newly set key
            return this.getAuthorizationHeader();
        };
        Auth.prototype.handleUnauthorized = function () {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[common] Unauthorized. Attempting to refresh credentials...');
            }
            // promise or ajax parameters?
                        var optionsOrPromise = this.api.settings.authorizationExpired, promiseResult, dfd;
            if($.isPlainObject(optionsOrPromise)) {
                if(!optionsOrPromise.timeout && this.api.settings.ajaxTimeout) {
                    optionsOrPromise.timeout = this.api.settings.ajaxTimeout;
                }
                return $.ajax(optionsOrPromise).then(this.parseExpiredCallbackKey);
            }
            if($.isFunction(optionsOrPromise)) {
                promiseResult = optionsOrPromise($);
                if(promiseResult && $.isFunction(promiseResult.promise)) {
                    return promiseResult.then(this.parseExpiredCallbackKey);
                } else {
                    // plain function result
                    this.parseExpiredCallbackKey(promiseResult);
                    dfd = new $.Deferred();
                    dfd.resolve();
                    return dfd.promise();
                }
            }
            this.api.fatalErrorCallback('Invalid authorizationExpired', null, null);
        };
        Auth.prototype.parseExpiredCallbackKey = function (data) {
            try  {
                if(this.api.settings.authorizationExpiredParser !== null) {
                    data = this.api.settings.authorizationExpiredParser(data);
                }
                this.setAuthorizationHeader(data);
            } catch (e) {
                this.api.fatalErrorCallback('Problem parsing authorization expired response', 'parseAuthExpiredFailed', null);
            }
        };
        return Auth;
    })();
    exports.Auth = Auth;    
})
;
define('lib/errors',["require", "exports"], function(require, exports) {
    /**
    * A common errors enumeration for consistent messages
    * @enum {string} Errors
    * @private
    */
    // 1xx ajax errors
    /** */
    exports.NET_BADPARAMETERS = "Invalid set of parameters sent";
    /** */
    exports.NET_UNAUTHORIZED = "Check your credentials";
    /** */
    exports.NET_UNEXPECTED = "There was an unexpected problem on the server";
    /** */
    exports.NET_NOTACCEPTED = "The service called does not support JSON at this time.";
    /** */
    exports.NET_UNKNOWN = "An unexpected response was received from the server.";
    /** */
    exports.NET_NOTSENT = "There was a problem setting up the ajax transport. Try checking the cross domain settings.";
    // 2xx template errors
    /** */
    exports.VIEW_NODATA = "There was a problem displaying this content.";
    /** */
    exports.VIEW_UNKNOWN = "An unexpected problem occurred while displaying this content.";
})
;
define('lib/url',["require", "exports"], function(require, exports) {
    
    var webServiceBaseUrl = {
        local: 'http://wslocal.trucode.com/v3/',
        dev: //http://localhost:62322/
        'https://wsdev.trucode.com/v3/',
        dev_ci: 'https://wsdev.trucode.com/ci/',
        qa: '',
        stage: 'https://wsstage.trucode.com/v3/',
        prod: 'https://ws.trucode.com/v3/'
    };
    /**
    * @class Url
    * Service endpoints that are dynamic by environment setting.
    * @singleton
    * @private
    */
    var Url = (function () {
        function Url(apiRef) {
            this.api = apiRef;
        }
        Url.prototype.apc_asc_calculate = /** */
        function () {
        };
        Url.prototype.code_getDescription = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'code/GetDescription';
        };
        Url.prototype.codebooks_getDetail = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'codebooks/GetDetail';
        };
        Url.prototype.codebooks_getInstructionalNotes = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'codebooks/GetInstructionalNotes';
        };
        Url.prototype.codebooks_listBooks = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'codebooks/ListBooks';
        };
        Url.prototype.codebooks_search = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'codebooks/Search';
        };
        Url.prototype.codebooks_listPCSSections = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'codebooks/ListPCSSections';
        };
        Url.prototype.codebooks_getPCSTable = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'codebooks/GetPCSTable';
        };
        Url.prototype.codebooks_listModifiers = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'codebooks/ListModifiers';
        };
        Url.prototype.drg_analyze = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'drg/Analyze';
        };
        Url.prototype.drg_calculate = /** */
        function () {
        };
        Url.prototype.references_getArticle = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'references/GetArticle';
        };
        Url.prototype.references_getResource = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'references/GetResource';
        };
        Url.prototype.references_listArticles = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'references/ListArticles';
        };
        Url.prototype.references_listBooks = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'references/ListBooks';
        };
        Url.prototype.references_listIssues = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'references/ListIssues';
        };
        Url.prototype.references_listYears = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'references/ListYears';
        };
        Url.prototype.references_search = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'references/Search';
        };
        Url.prototype.research_getICD10Mapping = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'research/GetIcd10Mapping';
        };
        Url.prototype.research_getResearch = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'research/GetResearch';
        };
        Url.prototype.info_getVersions = /** */
        function () {
            return webServiceBaseUrl[this.api.env] + 'info/GetVersions';
        };
        return Url;
    })();
    exports.Url = Url;    
})
;
define('lib/config',["require", "exports"], function(require, exports) {
    exports.global = window;
    exports.DEBUG = exports.global.DEBUG;
    exports.ajaxCaching = true;
    // To change exposed variable namespace just change `global.TC` to something else
    // eg, `global.CCE` (or other re-sellers)
    exports.ns = 'TC';
    /** Active widget CSS class */
    exports.activeWidgetClass = 'active-widget';
    /** Active widget pane CSS class. Be careful when changing this as it affects the CSS styles */
    exports.activePaneClass = 'active-area';
    /** */
    function imageCdnPath() {
        return (window.location.protocol !== 'https:') ? 'http://c266323.r23.cf1.rackcdn.com/Cpt/' : 'https://c266323.ssl.cf1.rackcdn.com/Cpt/';
    }
    exports.imageCdnPath = imageCdnPath;
})
;
define('lib/date',["require", "exports"], function(require, exports) {
    function getCurrentDateInvariant() {
        var d = new Date();
        var MM = '' + (d.getMonth() + 1);
        var dd = '' + d.getDate();
        if(MM.length === 1) {
            MM = '0' + MM;
        }
        if(dd.length === 1) {
            dd = '0' + dd;
        }
        return d.getFullYear() + '-' + MM + '-' + dd;
    }
    exports.getCurrentDateInvariant = getCurrentDateInvariant;
})
;
define('lib/net',["require", "exports", "jql", "underscore", "lib/auth", "lib/errors", "lib/url", "lib/config", "lib/date"], function(require, exports, __$__, _____, __auth__, __Errors__, __url__, __cfg__, __DT__) {
    ///<reference path="../vendor/jquery/jquery.d.ts" />
    var $ = __$__;

    var _ = _____;

    var auth = __auth__;

    var Errors = __Errors__;

    var url = __url__;

    var cfg = __cfg__;

    var DT = __DT__;
    /**
    * @class Net
    * Core provides high level access to the underlying web service endpoints.
    * Wraps and extends ajax for OAuth. Makes use of errors.
    * @private
    * @singleton
    */
    
    var Net = (function () {
        function Net(apiRef) {
            this.serviceVersions = {
                code_getdescription: '',
                codebooks_getdetail: '',
                codebooks_getinstructionalnotes: '',
                codebooks_listbooks: '',
                codebooks_search: '',
                codebooks_listpcssections: '',
                codebooks_getpcstable: '',
                codebooks_listmodifiers: '',
                references_getarticle: '',
                references_getresource: '',
                references_listarticles: '',
                references_listbooks: '',
                references_listissues: '',
                references_listyears: '',
                references_search: '',
                research_geticd10mapping: '',
                research_getresearch: ''
            };
            this.proxyUrl = {
                local: '../proxy.aspx',
                dev: '',
                qa: '',
                test: '',
                prod: ''
            };
            //#endregion
            //#region Info
            this.infoGetVersions = function getVersions(callback, errorback) {
                errorback = this.addErrorbacks(errorback);
                var endpointKey = 'info_getversions';
                return this.tcAjax({
                    url: this.url.info_getVersions(),
                    error: errorback,
                    success: callback
                }, endpointKey);
            };
            this.api = apiRef;
            this.auth = new auth.Auth(this.api);
            this.url = new url.Url(this.api);
            _.bindAll(this);
            this.init();
        }
        Net.prototype.init = function () {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('** NET INIT **');
            }
            var that = this;
            // setup a deferred object that will allow us to
            // pause other ajax requests from starting until
            // we've either resolved or rejected
            this.versionDeferred = $.Deferred();
            this.versionDeferred.always(function () {
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('Service versions...');
                }
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log(that.serviceVersions);
                }
            });
            this.infoGetVersions(this.getVersionsComplete, this.getVersionsFail);
        };
        Net.prototype.getVersionsComplete = function (data) {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('Setting service versions');
            }
            var svKey;
            // apply results
            for(var key in data) {
                svKey = key.toLowerCase().replace('/', '_');
                if(_.has(this.serviceVersions, svKey)) {
                    this.serviceVersions[svKey] = encodeURIComponent(data[key]);
                }
            }
            // fill in any blanks
            for(var key in this.serviceVersions) {
                if(this.serviceVersions[key].length === 0) {
                    this.serviceVersions[key] = $.now();
                }
            }
            this.versionDeferred.resolve();
        };
        Net.prototype.getVersionsFail = function () {
            for(var key in this.serviceVersions) {
                this.serviceVersions[key] = $.now();
            }
            this.versionDeferred.reject();
        };
        Net.prototype.tcAjax = //#region ajax helpers
        function (options, endpointKey) {
            var that = this, prefilterOnce = $.Callbacks('once'), $def = $.Deferred(), defaults = {
                dataType: 'json',
                cache: cfg.ajaxCaching,
                contentType: 'application/json',
                headers: {
                    'From': 'encoder.essentials.3.1.0.363@trucode.com'
                }
            };
            if(this.api.settings.ajaxTimeout) {
                defaults.timeout = this.api.settings.ajaxTimeout;
            }
            $.extend(defaults, options);
            prefilterOnce.add(this.tcPrefilter);
            // getversions requests should return ajax promise
            // in order for $.versionDeferred to be resolved
            if(options._getVersions || options.url.toLowerCase().indexOf('info/getversions') != -1) {
                $.ajaxPrefilter(prefilterOnce.fire);
                return $.ajax(defaults);
            }
            // other requests should hold off until getversions
            // either resolves or rejects
            this.versionDeferred.always(function () {
                defaults.data = defaults.data || {
                };
                $.extend(defaults.data, {
                    '_': that.serviceVersions[endpointKey]
                });
                $.ajaxPrefilter(prefilterOnce.fire);
                var ajaxPromise = $.ajax(defaults);
                $def.fail(function () {
                    Net.tryAbort(ajaxPromise);
                });
            });
            return $def;
        };
        Net.prototype.tcPrefilter = function (options, originalOptions, jqXHR) {
            var that = this;
            // options  = current request options (settings provided extended with defaults)
            // original = options provided to ajax without defaults
            // Don't infinitely recurse
            originalOptions._retry = isNaN(originalOptions._retry) ? this.auth.maxExpiredAuthorizationRetries : originalOptions._retry - 1;
            // Check if this a getVersions request
            originalOptions._getVersions = originalOptions.url.toLowerCase().indexOf('info/getversions') != -1;
            var authHeader = this.auth.getAuthorizationHeader();
            if(!this.api.settings.forceProxy && authHeader === null) {
                this.api.fatalErrorCallback('No authorization key provided', '', null);
            }
            jqXHR.setRequestHeader("Authorization", authHeader);
            // change current request proxy settings
            if(this.api.settings.forceProxy || !$.support.cors) {
                // will not be using IE8/9's XDR because of limitations
                // http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
                if(options.type === 'GET') {
                    options.data = (options.data && options.data.length > 0) ? options.data + "&proxyUrl=" + encodeURIComponent(options.url) : "proxyUrl=" + encodeURIComponent(options.url);
                }
                options.url = (options.type === 'POST') ? this.getProxyUrl() + '?proxyUrl=' + encodeURIComponent(options.url) : this.getProxyUrl();
                options.crossDomain = false;
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[core] url changed to: ' + options.url);
                }
            }
            // save the original error callback for later
            if(originalOptions.error) {
                originalOptions._error = originalOptions.error;
            }
            // overwrite *current request* error callback
            // if the request fails, do something else yet still resolve
            options.error = $.noop();
            // setup our own deferred object to also support promises that are only invoked
            // once all of the retry attempts have been exhausted
            var dfd = $.Deferred();
            jqXHR.done(dfd.resolve);
            jqXHR.fail(function () {
                var args = Array.prototype.slice.call(arguments);
                if(jqXHR.status === 401 && originalOptions._retry > 0) {
                    // retry with our modified options and new auth key
                    var retry = function () {
                        that.tcAjax(originalOptions).then(dfd.resolve, dfd.reject);
                    };
                    // refresh the oauth credentials for the next attempt(s)
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[core] retries left: ' + originalOptions._retry.toString());
                    }
                    // get new ajax/promise
                    that.auth.handleUnauthorized().then(retry, retry);
                } else {
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[core] no retries left');
                    }
                    if(originalOptions._error) {
                        dfd.fail(originalOptions._error);
                    }
                    dfd.rejectWith(jqXHR, args);
                }
            });
            // NOW override the jqXHR's promise functions with our deferred
            return dfd.promise(jqXHR);
        };
        Net.prototype.ajaxErrorHandler = function (jqxhr, textStatus, error) {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log({
                    '...Error': arguments
                });
            }
            switch(jqxhr.status) {
                case 400:
                    this.api.fatalErrorCallback(Errors.NET_BADPARAMETERS, textStatus, error);
                    break;
                case 401:
                    this.api.fatalErrorCallback(Errors.NET_UNAUTHORIZED, textStatus, error);
                    break;
                case 406:
                    this.api.fatalErrorCallback(Errors.NET_NOTACCEPTED, textStatus, error);
                    break;
                case 500:
                    this.api.fatalErrorCallback(Errors.NET_UNEXPECTED, textStatus, error);
                    break;
                case 0:
                    if(textStatus !== 'abort') {
                        this.api.fatalErrorCallback(Errors.NET_NOTSENT, textStatus, error);
                    }
                    break;
                default:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('Ajax Error: Could be that the certificate doesn\'t match and needs to be accepted first');
                    }
                    this.api.fatalErrorCallback(Errors.NET_UNKNOWN, textStatus, error);
                    break;
            }
        };
        Net.prototype.addErrorbacks = function (errorbacks) {
            var errorbackCollection = [
                this.ajaxErrorHandler
            ], length = 0, i;
            if(typeof errorbacks === 'undefined') {
                // do nothing
                            } else if(typeof errorbacks === 'function') {
                errorbackCollection[0] = errorbacks;
                length = 1;
            } else if($.isArray(errorbacks)) {
                length = errorbacks.length;
                for(i = 0; i <= length; i++) {
                    errorbackCollection[i] = errorbacks[i];
                }
            }
            // call ajax error handler last because by default it throws an exception
            // that would prevent the user defined errobacks from executing
            errorbackCollection[length] = this.ajaxErrorHandler;
            return function (jqxhr, textStatus, error) {
                $.each(errorbackCollection, function (i, errorback) {
                    errorback.call(null, jqxhr, textStatus, error);
                });
            };
        };
        Net.prototype.getProxyUrl = function () {
            return this.api.settings.proxyUrl === null ? this.proxyUrl[this.api.settings.env] : this.api.settings.proxyUrl;
        };
        Net.tryAbort = //#endregion
        //#region static utils
        function tryAbort(xhrOrPromise) {
            if(xhrOrPromise) {
                if(xhrOrPromise.abort) {
                    xhrOrPromise.abort();
                }
                if(xhrOrPromise.reject) {
                    xhrOrPromise.reject();
                }
            }
        };
        Net.mapToGetResearch = /**
        * utility function to map event data to compatible getResearch arguments
        */
        function mapToGetResearch(options) {
            var getResearchData = {
            };
            $.map(options, function (v, i) {
                switch(i) {
                    case 'book':
                    case 'code_type':
                        // HACK provide the more generic book names for getResearch
                        v = v.replace('_INDEX', '');
                        v = v.replace('_TABULAR', '');
                        getResearchData.code_type = v;
                        break;
                    case 'term':
                    case 'code':
                        getResearchData.code = v;
                        break;
                    case 'getAll':
                    case 'all':
                        getResearchData.all = v;
                        break;
                    default:
                        // this causes browser-crashing recursion. leaving it to ensure it
                        // will be avoided in the future
                        //newObj[i] = v;
                        break;
                }
            });
            return getResearchData;
        };
        Net.prototype.codebooksGetDetail = //#endregion
        //#region CodeBooks
        /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'codebooks_getdetail', data = {
                records: 75,
                count_seven_character_codes: false
            };
            $.extend(data, options);
            return this.tcAjax({
                url: this.url.codebooks_getDetail(),
                data: data,
                success: callback,
                error: errorback
            }, endpointKey);
        };
        Net.prototype.codebooksGetInstructionalNotes = /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'codebooks_getinstructionalnotes';
            return this.tcAjax({
                url: this.url.codebooks_getInstructionalNotes(),
                data: options,
                success: callback,
                error: errorback
            }, endpointKey);
        };
        Net.prototype.codebooksListBooks = /** */
        function (callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'codebooks_listbooks';
            return this.tcAjax({
                url: this.url.codebooks_listBooks(),
                success: callback,
                error: errorback
            }, endpointKey);
        };
        Net.prototype.codebooksSearch = /**
        * use string options instead of number for readibility
        *
        * None = 0,
        * FindAll = 1,
        * UseAnesthesiaCodes = 2
        * Ref = 4
        * Table = 8
        * 12 = 12 (ref + table)
        */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'codebooks_search', validSearchOptions = {
                '0': 'None',
                '1': 'FindAll',
                '2': 'UseAnesthesiaCodes',
                '4': 'Ref',
                '8': 'Table',
                '12': '12',
                'None': 'None',
                'FindAll': 'FindAll',
                'UseAnesthesiaCodes': 'UseAnesthesiaCodes',
                'Ref': 'Ref',
                'Table': 'Table'
            }, data = {
                options: 'None',
                date: DT.getCurrentDateInvariant()
            };
            $.extend(data, options);
            data.options = validSearchOptions[data.options] || 'None';
            return this.tcAjax({
                url: this.url.codebooks_search(),
                data: data,
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.codebooksGetPCSTable = /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'codebooks_getpcstable';
            return this.tcAjax({
                url: this.url.codebooks_getPCSTable(),
                data: options,
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.codebooksListPCSSections = /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'codebooks_listpcssections';
            return this.tcAjax({
                url: this.url.codebooks_listPCSSections(),
                data: options,
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.codebooksListModifiers = /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'codebooks_listmodifiers';
            return this.tcAjax({
                url: this.url.codebooks_listModifiers(),
                data: options,
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.referencesGetResourceURL = //#endregion
        //#region References
        /** */
        function (options) {
            var endpointKey = 'references_getarticle', version = this.serviceVersions[endpointKey], url = this.url.references_getResource(), fullUrl;
            // check if proxy needed
            if(this.api.settings.forceProxy || !$.support.cors) {
                $.extend(options, {
                    proxyUrl: url
                });
                url = this.getProxyUrl();
            }
            options['_'] = version;
            options['access_token'] = this.api.settings.authorizationKey;
            // add params
            fullUrl = url + '?' + $.param(options) + '#page=1';
            return fullUrl;
        };
        Net.prototype.referencesGetArticle = /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            $.extend(options, {
                partial: 'true'
            });
            var endpointKey = 'references_getarticle';
            return this.tcAjax({
                url: this.url.references_getArticle(),
                data: options,
                dataType: 'html',
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.referencesListArticles = /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'references_listarticles';
            return this.tcAjax({
                url: this.url.references_listArticles(),
                data: options,
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.referencesListBooks = /** */
        function (callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'references_listbooks';
            return this.tcAjax({
                url: this.url.references_listBooks(),
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.referencesListIssues = /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'references_listissues';
            return this.tcAjax({
                url: this.url.references_listIssues(),
                data: options,
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.referencesListYears = /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'references_listyears';
            return this.tcAjax({
                url: this.url.references_listYears(),
                data: options,
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.referencesSearch = /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'references_search';
            return this.tcAjax({
                url: this.url.references_search(),
                data: options,
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.researchGetICD10Mapping = //#endregion
        //#region Research
        /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'research_geticd10mapping';
            return this.tcAjax({
                url: this.url.research_getICD10Mapping(),
                data: options,
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.researchGetResearch = function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'research_getresearch';
            return this.tcAjax({
                url: this.url.research_getResearch(),
                data: options,
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.drgAnalyze = //#endregion
        //#region DRG
        /** */
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'research_drganalyze';
            return this.tcAjax({
                type: 'POST',
                url: //processData: false,
                this.url.drg_analyze(),
                data: JSON.stringify(options),
                error: errorback,
                success: callback
            }, endpointKey);
        };
        Net.prototype.drg_calculate = /** */
        function () {
        };
        Net.prototype.medicalNecessityEdits_calculate = //#endregion
        //#region Medical Necessity Edits
        /** */
        function () {
        };
        Net.prototype.medicalNecessityEdits_getArticle = /** */
        function () {
        };
        Net.prototype.principalDx_analyze = //#endregion
        //#region Principal DX
        /** */
        function () {
        };
        Net.prototype.apc_asc_calculate = //#endregion
        //#region APC_ASC
        /** */
        function () {
        };
        Net.prototype.codeGetDescription = //#endregion
        //#region Code
        function (options, callback, errorback) {
            errorback = this.addErrorbacks(errorback);
            var endpointKey = 'code_getdescription';
            return this.tcAjax({
                url: this.url.code_getDescription(),
                data: options,
                error: errorback,
                success: callback
            }, endpointKey);
        };
        return Net;
    })();
    exports.Net = Net;    
    //#endregion
    //#endregion
    })
;
define('lib/events',["require", "exports", "Backbone", "jql", 'lib/config'], function(require, exports, __Backbone__, __$__, __cfg__) {
    ///<reference path="../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    ///<reference path="../vendor/jquery/jquery.d.ts"/>
    var $ = __$__;

    var cfg = __cfg__;

    
    
    function Get() {
        var eventInstance = $.extend({
        }, Backbone.Events);
        if(typeof DEBUG !== 'undefined' && DEBUG) {
            eventInstance.on('all', function (eventName) {
                log('[event triggered] ' + eventName);
                log(arguments);
            });
        }
        return eventInstance;
    }
    exports.Get = Get;
    // Shortcut for 'private' *global* events object
    function GetGlobal() {
        var eventInstance = cfg.global[cfg.ns]._tcEvents;
        if(typeof DEBUG !== 'undefined' && DEBUG) {
            eventInstance.on('all', logAllEvents);
        }
        return eventInstance;
    }
    exports.GetGlobal = GetGlobal;
    function logAllEvents(eventName) {
        log('[event triggered] ' + eventName);
        log(arguments);
    }
    //#region Universal Events
    exports.ClearWidgetActive = "ui:clearActiveWidget";
    exports.ClearWidgetAreaFocus = "ui:clearAreaFocus";
    exports.SetWidgetFocus = "ui:setFocus";
    exports.CodingLevelChange = "settings:codingLevel";
    exports.Destroy = "tc:destroy";
    //#endregion
    //#region Research
    /**
    * @class Controls.Research
    */
    /**
    * @event
    * @since 3.0 Beta 1
    * **research:codeSelected** - This event is triggered when a code is clicked.
    *
    * @param {String} code Code that was clicked.
    * @param {String} codeType Type of code.
    * @param {String} pane The pane that the code appeared in.
    */
    exports.ResearchCodeSelected = "research:codeSelected";
    /**
    * @event
    * @since 3.0 Beta 1
    * **research:clear** - This event clears the **Research** control.
    *
    * @param {String} [pane=""] The name of the pane to be cleared. When omitted, all panes are cleared.
    * @param {String} [book="ICD9CM_DX"] Book determines which sections of the research pane are visible.
    */
    exports.ResearchClear = "research:clear";
    /**
    * @event
    * @since 3.0 Beta 1
    * **research:toggleTab** - This event toggles the visibility of a **Research** tab.
    *
    * @param {String} name The name of the tab to be hidden or shown.
    * @param {String} [action=""] The action to occur. Valid actions are **hide** or **show**. When omitted, it will toggle to the opposite state.
    */
    exports.ResearchTabToggle = "research:toggleTab";
    /**
    * @event
    * @since 3.0 Beta 1
    * **research:selectTab** - This event activates a **Research** tab.
    *
    * @param {String} name The name of the tab to be activated.
    */
    exports.ResearchTabSelect = "research:selectTab";
    //#endregion
    //#region Research
    /**
    * @event
    * @since 3.0 Beta 1
    * **research:codeInContext** - This event indicates that a code is in context. The **Research** and **ICD10** tabs will refresh.
    *
    * @param {String} code The code to search
    * @param {String} book The book to search
    * @param {Boolean} [getAll=false] Get all available research.
    */
    exports.ResearchCodeInContext = "research:codeInContext";
    /**
    * @event
    * @since 3.0 Beta 1
    * **research:referenceClick** - This event is triggered when a reference link has been clicked.
    *
    * @param {String} code The code that was active when the article link was clicked.
    * @param {String} codeType The type associated with the code.
    * @param {String} book The book that contains the article.
    * @param {String} articleId The ID of the article that was clicked.
    * @param {String} articleTitle The title of the article that was clicked.
    */
    exports.ResearchReferenceClick = "research:referenceClick";
    /**
    * @event
    * **research:resourceClick** - This event is triggered when a reference link pointing to a resource (PDF, external link, etc) has been clicked.
    *
    * @param {String} code The code that was active when the article link was clicked.
    * @param {String} codeType The type associated with the code.
    * @param {String} resourceId The ID of the resource that was clicked.
    * @param {String} resourceTitle The title of the resource that was clicked.
    * @param {String} resourceType The type of resource that was clicked. Possible values include: `pdf`, `external`, `default`.
    * @param {Boolean} protectedResource Whether the resource requires authorization to view. If the resource requires authorization, it must be accessed via {@link WebServices.References#GetResource References/GetResource}.
    */
    exports.ResearchResourceClick = "research:resourceClick";
    /**
    * @event
    * @since 3.0 Beta 3
    * **research:changeEncounterType** - This event is used to change the encounter type.
    *
    * @param {String} encounterType The new encounter type. See the {@link #encounterType encounterType} config option for possible values.
    */
    exports.ResearchChangeEncounterType = "research:changeEncounterType";
    /**
    * @event
    * @since 3.0 RC1
    * **research:codeResearchComplete** - This event is triggered when the **Research** pane has been updated.
    */
    exports.ResearchCodeResearchComplete = "research:codeResearchComplete";
    //#endregion
    //#region ICD10
    //#endregion
    //#region Edits
    /**
    * @event
    * @since 3.0 Beta 1
    * **research:editsSet** - This event sets edits for the **Edits** pane of the Research control. The edits from the MedicalNecessityEdits / Calculate, DRG / Calculate and APC_ASC / Calculate web services can be set by triggering the **ResearchEditsSet** event with the raw response from these services.
    *
    *     rp.tcTrigger('research:editsSet', { category: 'group1', edits:[{"id":"02","type":"MCE","level":"Warning", ...
    *     rp.tcTrigger('research:editsSet', {
    *      category: 'group2',
    *      edits: [
    *        { type: 'TruCode', description: 'Testing' },
    *        { type: 'MCE', description: 'Testing' },
    *        { type: 'MNE', description: 'Testing' },
    *        { type: 'OCE', description: 'Testing' },
    *        { type: 'RAC', description: 'Testing' },
    *        { type: 'Validation', description: 'Testing' },
    *        { type: 'Arbitrary', description: 'Testing' }]
    *     });
    *
    *
    * @param {String} category The category of edits is an arbitrary name for the group of edits that are being set (for example, grouping). Use the same category whenever setting edits of the same type, and all edits with the same category (and only edits of that category) will be cleared prior to setting the new edits. Existing edits with a different category will remain unchanged.
    * @param {Object[]} edits An array of edit objects to display on the **Edits** pane. Use the properties below to craft your own arbitrary edits for display on the **Edits** pane; or, as noted above, pass in raw responses from a select number of our services to display the associated edits.
    * @param {String} edits.type The type can be used to control the styling of edits via CSS.
    * @param {String} edits.description The primary content to be shown with this edit.
    * @param {String} [edits.details=""] The secondary content that will only be shown after the "details..." link is clicked.
    */
    exports.ResearchEditsSet = "research:editsSet";
    /**
    * @event
    * @since 3.0 Beta 1
    * **research:editsPolicyClicked** - This event is triggered when a policy link is clicked from the **Edits** pane.
    *
    * @param {String} articleId The ID of the policy article that was clicked.
    */
    exports.ResearchEditsPolicyClick = "research:editsPolicyClicked";
    //#endregion
    //#region DRG Analyze
    /**
    * @event
    * @since 3.0 Beta 1
    * **research:analyzeDRG** - This event sets the **DRG Analysis** pane content. The parameter passed to this event should be the raw json object sent to DRG/Analyze. It will not be transformed in any way before DRG/Analyze is called.
    *
    *     rp.tcTrigger('research:analyzeDRG', { "drg_analysis_input": { "drg": "134",...
    *
    * @param {Object} drg_analysis_input DRG data to be analyzed. *Eg: { "drg_analysis_input": { "drg": "134" ...*
    */
    exports.ResearchAnalyzeDRG = "research:analyzeDRG";
    //#endregion
    //#region CodeBooks
    /**
    * @class Controls.CodeBooks
    */
    /**
    * @event
    * **codeBooks:searchComplete** - This event is triggered when a code book search is complete.
    *
    * @param {Object} records A collection of records returned from the code book search.
    * @param {String} type The type of search.
    * @param {String} term The term or code that was searched.
    * @param {String} book The name of the book that was searched.
    * @param {String} partialCode If the search term was a valid partial or complete PCS code this property will be the valid partial code.
    * @param {String} [searchOption=""] Options that were used for the search.
    * @param {String} [isSilent=false] Controls whether the search results portion of the control is updated or not.
    */
    exports.CodeBooksSearchComplete = "codeBooks:searchComplete";
    /**
    * @event
    * **codeBooks:searchNoResults** - This event is triggered when a code book search is complete and there were no results.
    */
    exports.CodeBooksSearchNoResults = "codeBooks:searchNoResults";
    exports.CodeBooksFocusTabular = "codeBooks:focusTabular";
    exports.CodeBooksFocusIndex = "codeBooks:focusIndex";
    exports.CodeBooksFocusSearch = "codeBooks:focusSearch";
    exports.CodeBooksSearchResultProxy = "codeBooks:searchResultProxy";
    /**
    * @event
    * **codeBooks:search** - This event performs a code book search.
    *
    * @param {String} term The term or code to search.
    * @param {String} book The name of the book to search.
    * @param {String} [option=""] Options for the search.
    * @param {Boolean} [mockUser=false] When **true**, the search bar will update the term and book options.
    */
    exports.CodeBooksSearch = "codeBooks:search";
    /**
    * @event
    * **codeBooks:clear** - This event clears the CodeBooks control.
    */
    exports.CodeBooksClear = "codeBooks:clear";
    /**
    * @event
    * **codeBooks:codePosted** - This event is trigged when a code or many codes are being posted.
    *
    * @param {Object[]} codes An array of `code` objects.
    * @param {Object} codes.code The `code` object.
    * @param {String} codes.code.code The code.
    * @param {String} codes.code.codeType The type of code.
    */
    exports.CodeBooksCodePosted = "codeBooks:codePosted";
    /**
    * @event
    * **codeBooks:changeBookdate** - This event is used to change the bookdate.
    *
    * @param {String} bookdate The new bookdate. See the CodeBooks control's {@link Controls.CodeBooks#bookdate bookdate config option} for required format and description.
    */
    exports.CodeBooksChangeBookdate = "codeBooks:changeBookdate";
    exports.CodeBooksResizeBottom = "codeBooks:resizeBottom";
    /**
    * @event
    * **codeBooks:pcsCodeChanged** - This event is triggered each time the current PCS code is changed.
    *
    * @param {String} code The partial or complete PCS code.
    * @param {String[]} headings The column headings for the individual partial code characters.
    * @param {String[]} labels The labels for the individual partial code characters.
    */
    exports.CodeBooksPCSCodeChanged = "codeBooks:pcsCodeChanged";
    /**
    * @event
    * **codeBooks:getTabularPCS** - This event performs a search against ICD10 PCS tabular services.
    *
    * @param {String} code The partial or complete PCS code.
    * @param {String} [date="current"] The date to be used for PCS code lookup.
    */
    exports.CodeBooksGetICD10PCSTableData = "codeBooks:getTabularICD10PCS";
    /**
    * @event
    * **codeBooks:detailRenderingComplete** - This event is triggered when the tabular results have finished rendering.
    *
    */
    exports.CodeBooksDetailRenderingComplete = "codeBooks:detailRenderingComplete";
    /**
    * @event
    * **codeBooks:selectBook** - This event is used to change the selected book.
    *
    * @param {String} bookId The ID of the book to select.
    */
    exports.CodeBooksSelectBook = "codeBooks:selectBook";
    /**
    * @event
    * **codeBooks:resize** - This event is used to resize the CodeBooks control after a parent element has changed height. The height of `el` must have changed in order for this to have an effect.
    *
    *     var cb = TC.createControl({
    *       type: 'codeBooks',
    *       el: '#b'
    *     });
    *     $(window).resize(function () { cb.tcTrigger('codeBooks:resize'); });
    *
    */
    exports.CodeBooksResize = "codeBooks:resize";
    //#region Private events
    exports.CodeBooksGetTabular = "codeBooks:getTabular";
    exports.CodeBooksGetCrosswalk = "codeBooks:getCrosswalk";
    exports.CodeBooksSetCodePair = "codeBooks:setCodePair";
    exports.CodeBooksListModifiers = "codeBooks:listModifiers";
    //#endregion
    //#endregion
    //#region References
    /**
    * @class Controls.References
    */
    exports.ReferencesFocusList = "references:focusList";
    exports.ReferencesFocusDetail = "references:focusDetail";
    exports.ReferencesFocusSearch = "references:focusSearch";
    /**
    * @event
    * **references:search** - Trigger a references search.
    *
    * @param {String} term The term or code to search.
    * @param {String} bookId The ID of the book to search.
    * @param {String} [bookName=""] The name of the book to search. Used only for UI display purposes.
    * @param {Boolean} [mockUser=false] When **true**, the search bar updates the term and book options.
    * @param {String} [articleId=""] Article to load. When provided, the References control loads this article in the article pane once the search completes. If this value is not provided, or is not contained in the search results, the first article will be loaded.
    */
    exports.ReferencesSearch = "references:search";
    /**
    * @event
    * **references:searchNoResults** - This event is triggered when a references search is complete and there were no results.
    */
    exports.ReferencesSearchNoResults = "references:searchNoResults";
    /**
    * @event
    * **references:searchComplete** - This event is triggered when a references search is complete and there were results.
    */
    exports.ReferencesSearchComplete = "references:searchComplete";
    /**
    * @event
    * **references:listBooksComplete** - This event is triggered when the references list books call completes.
    *
    * @param {Object} books A collection of books.
    */
    exports.ReferencesListBooksComplete = "references:listBooksComplete";
    /**
    * @event
    * **references:listBooksFailure** - This event is triggered when the references list books call fails.
    *
    * @param {Object} books A collection of books
    */
    exports.ReferencesListBooksFailure = "references:listBooksFailure";
    /**
    * @event
    * **references:getArticle** - This event triggers an article to load and display.
    *
    * @param {String} id The ID of the article to load.
    * @param {Boolean} [mockUser=false] When **true**, the navigation area will select this item.
    * @param {String} [issueYear=""] The year of this article. Required to be able to display "Browse Issue" from an article view.
    * @param {String} [issueTitle=""] The issue title to which this article belongs. Required to be able to display "Browse Issue" from an article view.
    * @param {String} [book=""] The book to which this article belongs. Required to be able to display "Browse Issue" from an article view.
    */
    exports.ReferencesGetArticle = "references:getArticle";
    /**
    * @event
    * **references:getArticleComplete** - This event is triggered after an article is displayed.
    */
    exports.ReferencesGetArticleComplete = "references:getArticleComplete";
    /**
    * @event
    * **references:browseBook** - This event triggers the book browsing mode of the navigation area.
    *
    * @param {String} bookId The ID of the book to browse.
    * @param {String} [issueYear=""] The year to expand in the browse tree.
    * @param {String} [issueTitle=""] The issue title to expand in the browse tree.
    * @param {String} [articleId=""] The article to focus in the browse tree.
    */
    exports.ReferencesBrowseBook = "references:browseBook";
    /**
    * @event
    * **references:browseYearsComplete** - This event is triggered after the years are displayed in the browse book tree.
    */
    exports.ReferencesBrowseYearsComplete = "references:browseYearsComplete";
    /**
    * @event
    * **references:browseIssuesComplete** - This event is triggered after the issues for a given year are displayed in the browse book tree.
    */
    exports.ReferencesBrowseIssuesComplete = "references:browseIssuesComplete";
    /**
    * @event
    * **references:browseArticlesComplete** - This event is triggered after the articles for a given issue are displayed in the browse book tree.
    */
    exports.ReferencesBrowseArticlesComplete = "references:browseArticlesComplete";
    /**
    * @event
    * **references:printRequested** - This event is triggered when the print button has been clicked.
    */
    exports.ReferencesPrintRequested = "references:printRequested";
    /**
    * @event
    * **references:clear** - This event clears the References control.
    */
    exports.ReferencesClear = "references:clear";
    /**
    * @event
    * **references:selectBook** - This event is used to change the selected book.
    *
    * @param {String} bookId The ID of the book to select.
    */
    exports.ReferencesSelectBook = "references:selectBook";
    /**
    * @event
    * **references:codeClick** - This event is triggered when a code embedded in the content is clicked.
    *
    * @param {String} code The code that was clicked.
    * @param {String} codeType The type of code that was clicked.
    * @param {String} articleId The ID of the article that contained the code.
    */
    exports.ReferencesCodeClick = "references:codeClick";
    //#endregion
    })
;
define('lib/shortcuts',["require", "exports", 'lib/config', "keymaster"], function(require, exports, __cfg__, __keymaster__) {
    var cfg = __cfg__;

    ///<reference path="../vendor/keymaster/keymaster.d.ts"/>
    var keymaster = __keymaster__;
    /**
    * @class Shortcuts
    * @private
    *
    */
    /**
    * Shortcut for 'private' shortcuts instance
    */
    
    function Get() {
        return cfg.global[cfg.ns]._shortcuts;
    }
    exports.Get = Get;
    function setScope(scope) {
        keymaster.setScope(scope);
    }
    exports.setScope = setScope;
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/searchViewRecord',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var SearchViewRecord = (function (_super) {
        __extends(SearchViewRecord, _super);
        function SearchViewRecord(options) {
                _super.call(this, options);
        }
        return SearchViewRecord;
    })(Backbone.Model);
    exports.SearchViewRecord = SearchViewRecord;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/searchViewRecordCollection',["require", "exports", "Backbone", "controls/codebooks/models/searchViewRecord"], function(require, exports, __Backbone__, __SVR__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var SVR = __SVR__;

    var SearchViewRecordCollection = (function (_super) {
        __extends(SearchViewRecordCollection, _super);
        function SearchViewRecordCollection() {
            _super.apply(this, arguments);

            this.model = SVR.SearchViewRecord;
        }
        return SearchViewRecordCollection;
    })(Backbone.Collection);
    exports.SearchViewRecordCollection = SearchViewRecordCollection;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/views/searchbar',["require", "exports", "Backbone", "underscore", "jql", "text!controls/codebooks/templates/searchbar/searchbar.html", "text!controls/codebooks/templates/searchbar/codebooks-error.html", "controls/codebooks/models/searchbarViewModel", "controls/codebooks/models/codebookCollection", "kendoui/kendo.dropdownlist", "lib/api", "lib/dom", "lib/templates", "lib/net", "lib/events", "lib/shortcuts", "controls/codebooks/models/searchViewRecordCollection"], function(require, exports, __Backbone__, _____, __$__, __searchbarTemplate__, __codebooksErrorTemplate__, __SBVM__, __CBC__, __KDDL__, __api__, __dom__, __Templates__, __net__, __Events__, __Shortcuts__, __SVRC__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var searchbarTemplate = __searchbarTemplate__;

    var codebooksErrorTemplate = __codebooksErrorTemplate__;

    var SBVM = __SBVM__;

    var CBC = __CBC__;
    ///<reference path="../../../vendor/kendoui/kendoui.d.ts"/>
    
    var KDDL = __KDDL__;

    var api = __api__;

    
    var dom = __dom__;

    var Templates = __Templates__;

    var net = __net__;

    var Events = __Events__;

    var Shortcuts = __Shortcuts__;

    var SVRC = __SVRC__;

    var SearchbarView = (function (_super) {
        __extends(SearchbarView, _super);
        function SearchbarView(options) {
            // Force include
            if(KDDL || !KDDL) {
            }
            this.hub = options.hub;
            this.template = Templates.compile(Templates.tk_searchbar, searchbarTemplate);
            this.templateCodebooksError = Templates.get(Templates.tk_searchbarError, codebooksErrorTemplate);
            this.bookSelector = 'select.book-list';
            this.searchOptionSelector = '.search-options input:visible';
            this.termSelector = '.search-box';
            this.codeBooks = new CBC.CodeBookCollection();
            this.model = new SBVM.SearchbarViewModel({
                codeBooks: this.codeBooks
            });
            this.searchRecords = new SVRC.SearchViewRecordCollection();
            this.targetDate = options.targetDate || '';
            this.initialBook = options.book || null;
            this.initialSearch = options.searchQuery || null;
            this.initialSearchOption = options.searchOption || 'None';
            this.bookFilters = options.bookFilters || null;
            this.events = {
                'keydown': 'keypressHandler',
                'click': 'tcSetFocus',
                'click .search-btn': 'searchOnEvent',
                'click .codebooks-retry': 'getCodebooks',
                'click .search-box': 'selectAllSearchbox',
                'focusout .search-box': 'searchBlur',
                'click .show-modifiers': 'showModifiers'
            };
            this.scopeName = 'codebooks:searchbar';
            this.shortcuts = {
            };
                _super.call(this, options);
        }
        SearchbarView.prototype.initialize = function (options) {
            this.tcInit();
            this.$el.addClass('form-inline');
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.codeBooks, 'reset', this.render);
            this.listenTo(this.model, 'change:bookValue', this.bookChanged);
            this.listenTo(this.hub, Events.CodeBooksFocusSearch, this.selectAllSearchbox);
            this.listenTo(this.hub, Events.CodeBooksSearchNoResults, this.selectAllSearchbox);
            this.listenTo(this.hub, Events.CodeBooksSearch, this.clear);
            this.listenTo(this.hub, Events.CodeBooksSearch, this.search);
            this.listenTo(this.hub, Events.CodeBooksSearchResultProxy, this.processSearchResults);
            this.listenTo(this.hub, Events.CodeBooksClear, this.clearAll);
            this.listenTo(this.hub, Events.CodeBooksChangeBookdate, this.onUpdateTargetDate);
            this.listenTo(this.hub, Events.CodeBooksSelectBook, this.onSelectBook);
            this.getCodebooks();
        };
        SearchbarView.prototype.onKeyboardFocus = function () {
            this.selectAllSearchbox();
        };
        SearchbarView.prototype.selectAllSearchbox = function (e) {
            var $sbox = this.$(this.termSelector);
            if(!$sbox.hasClass('focused')) {
                this.$(this.termSelector).select();
            }
            $sbox.addClass('focused');
        };
        SearchbarView.prototype.searchBlur = function (e) {
            this.$(this.termSelector).removeClass('focused');
        };
        SearchbarView.prototype.onUpdateTargetDate = function (event) {
            this.targetDate = event.bookdate;
        };
        SearchbarView.prototype.bookChanging = function (e) {
            this.model.set('bookValue', e.sender.value().toUpperCase());
        };
        SearchbarView.prototype.showModifiers = /** */
        function (event) {
            var showModifierOptions;
            showModifierOptions = {
                book: this.model.get('bookValue')
            };
            this.hub.trigger(Events.CodeBooksListModifiers, showModifierOptions);
        };
        SearchbarView.prototype.getCodebooks = /** */
        function () {
            this.removeCodebooksFailure();
            this.setLoading(true);
            api.TC.current()._net.codebooksListBooks(this.setCodeBooks, this.showCodebooksFailure);
        };
        SearchbarView.prototype.showCodebooksFailure = /** */
        function (jqxhr, textStatus, error) {
            this.setLoading(false);
            this.$('.search-btn').attr('disabled', 'disabled');
            this.$el.find('.pane-content').append(this.templateCodebooksError);
        };
        SearchbarView.prototype.removeCodebooksFailure = /** */
        function () {
            this.$('.codebooks-error').remove();
        };
        SearchbarView.prototype.setLoading = /** */
        function (notDone) {
            if(typeof notDone === 'undefined' || !notDone) {
                this.$('.tc-loading').remove();
                this.$('.search-btn').removeAttr('disabled');
            } else {
                this.$el.find('.pane-content').append('<span class="k-loading k-icon tc-loading">Loading</span>');
            }
        };
        SearchbarView.prototype.setCodeBooks = function (data) {
            var searchOptions;
            this.codeBooks.reset(data);
            this.setLoading(false);
            if(this.initialBook) {
                this.model.set('bookValue', this.initialBook);
            }
            if(this.initialSearch) {
                searchOptions = {
                    book: this.model.get('bookValue'),
                    term: this.initialSearch,
                    mockUser: true,
                    option: this.initialSearchOption
                };
                this.hub.trigger(Events.CodeBooksSearch, searchOptions);
            }
        };
        SearchbarView.prototype.clear = /**
        * @listens Events.EncoderSearch
        */
        function (event) {
            this.searchRecords.reset();
        };
        SearchbarView.prototype.clearAll = /**
        * @listens Events.EncoderClear
        */
        function (event) {
            this.$(this.termSelector).val('');
            this.clear();
        };
        SearchbarView.prototype.render = function () {
            var animationConfig = {
                close: {
                    duration: 0
                }
            }, ddl;
            if(!api.TC.current().settings.effects) {
                animationConfig = false;
            }
            this.$el.html(this.template(this.codeBooks.toJSON()));
            ddl = this.$('select.book-list').kendoDropDownList({
                animation: animationConfig,
                change: this.bookChanging,
                dataBound: this.booksSetComplete,
                height: 500
            }).data('kendoDropDownList');
            if(ddl && ddl.dataItem()) {
                this.model.set('bookValue', ddl.dataItem().value);
            }
            return this;
        };
        SearchbarView.prototype.booksSetComplete = function (e) {
            var ddl = this.$('select.book-list').data('kendoDropDownList');
            if(this.bookFilters) {
                if(e.sender.dataSource.data().length) {
                    ddl.unbind('dataBound');
                    e.sender.dataSource.filter(this.bookFilters);
                }
            } else {
                ddl.unbind('dataBound');
            }
        };
        SearchbarView.prototype.bookChanged = /** */
        function (model, name) {
            var bookVal = this.model.get('bookValue');
            this.selectBook(bookVal);
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('book changed from ' + this.model.previous('bookValue') + ' to ' + bookVal);
            }
            switch(bookVal) {
                case 'ICD9CM_DX':
                case 'ICD9CM_E':
                case 'ICD9CM_PR':
                case 'ICD10CM_DX':
                case 'ICD10CM_E':
                case 'ICD10PCS_PR':
                    this.$('.use-anesthesia').hide();
                    this.$('.find-all').show();
                    this.$('.show-modifiers').hide();
                    break;
                case 'CPT4_TABULAR':
                case 'CPT4':
                    this.$('.use-anesthesia').show();
                    this.$('.find-all').hide();
                    this.$('.show-modifiers').show();
                    break;
                case 'HCPCS_TABULAR':
                case 'HCPCS':
                    this.$('.use-anesthesia').hide();
                    this.$('.find-all').hide();
                    this.$('.show-modifiers').show();
                    break;
                default:
                    this.$('.use-anesthesia').hide();
                    this.$('.find-all').hide();
                    this.$('.show-modifiers').hide();
                    break;
            }
            this.$('.book-list').val(bookVal);
        };
        SearchbarView.prototype.keypressHandler = /** */
        function (e) {
            if(e.which === 13) {
                e.preventDefault();
                this.searchOnEvent(e);
                return;
            }
        };
        SearchbarView.prototype.searchOnEvent = /**
        * @triggers Events.EncoderSearch
        */
        function (e) {
            var searchEventData, $searchOption = this.$(this.searchOptionSelector);
            this.model.set('searchOption', $searchOption.is(':checked') ? $searchOption.val() : 'None');
            searchEventData = {
                term: this.$(this.termSelector).val(),
                book: this.model.get('bookValue'),
                option: this.model.get('searchOption')
            };
            this.hub.trigger(Events.CodeBooksSearch, searchEventData);
        };
        SearchbarView.prototype.blurAndSetTabularFocus = /** */
        function () {
            dom.blurAll();
            this.hub.trigger(Events.CodeBooksFocusTabular);
        };
        SearchbarView.prototype.search = function (e) {
            var ddl, cbSearchOptions;
            this.blurAndSetTabularFocus();
            // cache the data
            this.cachedTerm = e.term;
            this.cachedBook = e.book.toUpperCase();
            if(e.mockUser === true) {
                this.$(this.termSelector).val(e.term);
                this.selectBook(this.cachedBook);
                if(e.option && e.option !== 'None') {
                    this.$('.search-options input[value="' + e.option + '"]').prop('checked', true);
                } else {
                    this.$('.search-options input').prop('checked', false);
                }
            }
            cbSearchOptions = {
                book: this.cachedBook,
                term: e.term,
                options: e.option
            };
            if(this.targetDate.length) {
                cbSearchOptions.date = this.targetDate;
            }
            net.Net.tryAbort(this.currentReq);
            this.currentReq = api.TC.current()._net.codebooksSearch(cbSearchOptions, this.beforeProcessSearchResults, this.handleError);
        };
        SearchbarView.prototype.handleError = function (e) {
            // handle..
                    };
        SearchbarView.prototype.beforeProcessSearchResults = /**
        * Processes search result data with searchbarview data. Triggers events and processes only
        * intended for when this view is the originator of the codebooks search.
        * @triggers Events.ResearchCodeInContext
        * @triggers Events.ResearchClear
        */
        function (data) {
            var searchType = data.search_type, bookExistsInSelect = false, bookTemp = data.data_book.replace('_INDEX', '').replace('_TABULAR', ''), ddl, codeInContextData;
            // book may have switched automatically by service - this functionality has been removed
            this.cachedBook = data.data_book;
            // update dropdown if possible
            this.selectBook(bookTemp);
            if(searchType === 'Term') {
                this.hub.trigger(Events.ResearchClear, {
                    book: this.cachedBook
                });
            }
            this.processSearchResults(data);
        };
        SearchbarView.prototype.processSearchResults = /**
        * Processes search result data and uses searchbarview data if not provided by userData
        * parameter. Designed to be shared when other modules need to proxy search result processing
        * through here, reducing redundancy.
        * @listens Events.EncoderSearchSilently,
        * @triggers Events.CodebooksSearchComplete
        */
        function (data, userData) {
            var searchType = data.search_type, searchEventData, hasUserData = typeof userData !== 'undefined', silent = hasUserData && typeof userData.isSilent !== 'undefined' && userData.isSilent, term = (hasUserData) ? userData.term : this.cachedTerm, book = (hasUserData && typeof userData.book !== 'undefined') ? userData.book : data.data_book, searchOption = (hasUserData && typeof userData.searchOption !== 'undefined') ? userData.searchOption : this.model.get('searchOption'), isCpt = book.toUpperCase().indexOf('CPT') !== -1, isHcpcs = book.toUpperCase().indexOf('HCPCS') !== -1, validPartialCode = (data.valid_partial_code && data.valid_partial_code.length) ? data.valid_partial_code.toUpperCase() : '';
            // reset collection
            if(searchType === 'Code' && !isCpt) {
                this.searchRecords.reset(data.search_view_tabular_records);
            }
            if(searchType === 'Term' || isCpt || isHcpcs) {
                this.searchRecords.reset(data.search_view_records);
            }
            searchEventData = {
                records: this.searchRecords,
                type: searchType,
                term: term,
                book: book,
                partialCode: validPartialCode,
                searchOption: searchOption,
                isSilent: silent
            };
            this.hub.trigger(Events.CodeBooksSearchComplete, searchEventData);
        };
        SearchbarView.prototype.onSelectBook = /** */
        function (event) {
            if(event.bookId && event.bookId.length) {
                this.model.set('bookValue', event.bookId.toUpperCase());
            }
        };
        SearchbarView.prototype.selectBook = function (bookId) {
            if(bookId && bookId.length) {
                bookId = bookId.toUpperCase();
            }
            var ddl = this.$('select.book-list').data('kendoDropDownList');
            if(ddl) {
                ddl.select(function (item) {
                    return item.value === bookId;
                });
            }
        };
        return SearchbarView;
    })(Backbone.View);
    exports.SearchbarView = SearchbarView;    
})
;
/*!
 * jQuery.ScrollTo
 * Copyright (c) 2007-2012 Ariel Flesler - aflesler(at)gmail(dot)com | http://flesler.blogspot.com
 * Dual licensed under MIT and GPL.
 * Date: 4/09/2012
 *
 * @projectDescription Easy element scrolling using jQuery.
 * http://flesler.blogspot.com/2007/10/jqueryscrollto.html
 * @author Ariel Flesler
 * @version 1.4.4
 *
 * @id jQuery.scrollTo
 * @id jQuery.fn.scrollTo
 * @param {String, Number, DOMElement, jQuery, Object} target Where to scroll the matched elements.
 *	  The different options for target are:
 *		- A number position (will be applied to all axes).
 *		- A string position ('44', '100px', '+=90', etc ) will be applied to all axes
 *		- A jQuery/DOM element ( logically, child of the element to scroll )
 *		- A string selector, that will be relative to the element to scroll ( 'li:eq(2)', etc )
 *		- A hash { top:x, left:y }, x and y can be any kind of number/string like above.
 *		- A percentage of the container's dimension/s, for example: 50% to go to the middle.
 *		- The string 'max' for go-to-end. 
 * @param {Number, Function} duration The OVERALL length of the animation, this argument can be the settings object instead.
 * @param {Object,Function} settings Optional set of settings or the onAfter callback.
 *	 @option {String} axis Which axis must be scrolled, use 'x', 'y', 'xy' or 'yx'.
 *	 @option {Number, Function} duration The OVERALL length of the animation.
 *	 @option {String} easing The easing method for the animation.
 *	 @option {Boolean} margin If true, the margin of the target element will be deducted from the final position.
 *	 @option {Object, Number} offset Add/deduct from the end position. One number for both axes or { top:x, left:y }.
 *	 @option {Object, Number} over Add/deduct the height/width multiplied by 'over', can be { top:x, left:y } when using both axes.
 *	 @option {Boolean} queue If true, and both axis are given, the 2nd axis will only be animated after the first one ends.
 *	 @option {Function} onAfter Function to be called after the scrolling ends. 
 *	 @option {Function} onAfterFirst If queuing is activated, this function will be called after the first scrolling ends.
 * @return {jQuery} Returns the same jQuery object, for chaining.
 *
 * @desc Scroll to a fixed position
 * @example $('div').scrollTo( 340 );
 *
 * @desc Scroll relatively to the actual position
 * @example $('div').scrollTo( '+=340px', { axis:'y' } );
 *
 * @desc Scroll using a selector (relative to the scrolled element)
 * @example $('div').scrollTo( 'p.paragraph:eq(2)', 500, { easing:'swing', queue:true, axis:'xy' } );
 *
 * @desc Scroll to a DOM element (same for jQuery object)
 * @example var second_child = document.getElementById('container').firstChild.nextSibling;
 *			$('#container').scrollTo( second_child, { duration:500, axis:'x', onAfter:function(){
 *				alert('scrolled!!');																   
 *			}});
 *
 * @desc Scroll on both axes, to different values
 * @example $('div').scrollTo( { top: 300, left:'+=200' }, { axis:'xy', offset:-20 } );
 */

//;(function( $ ){
define('vendor/jquery/plugins/jquery.scrollTo',["jql"], function ($) {
	
	var $scrollTo = $.scrollTo = function( target, duration, settings ){
		$(window).scrollTo( target, duration, settings );
	};

	$scrollTo.defaults = {
		axis:'xy',
		duration: parseFloat($.fn.jquery) >= 1.3 ? 0 : 1,
		limit:true
	};

	// Returns the element that needs to be animated to scroll the window.
	// Kept for backwards compatibility (specially for localScroll & serialScroll)
	$scrollTo.window = function( scope ){
		return $(window)._scrollable();
	};

	// Hack, hack, hack :)
	// Returns the real elements to scroll (supports window/iframes, documents and regular nodes)
	$.fn._scrollable = function(){
		return this.map(function(){
			var elem = this,
				isWin = !elem.nodeName || $.inArray( elem.nodeName.toLowerCase(), ['iframe','#document','html','body'] ) != -1;

				if( !isWin )
					return elem;

			var doc = (elem.contentWindow || elem).document || elem.ownerDocument || elem;
			
			return /webkit/i.test(navigator.userAgent) || doc.compatMode == 'BackCompat' ?
				doc.body : 
				doc.documentElement;
		});
	};

	$.fn.scrollTo = function( target, duration, settings ){
		if( typeof duration == 'object' ){
			settings = duration;
			duration = 0;
		}
		if( typeof settings == 'function' )
			settings = { onAfter:settings };
			
		if( target == 'max' )
			target = 9e9;
			
		settings = $.extend( {}, $scrollTo.defaults, settings );
		// Speed is still recognized for backwards compatibility
		duration = duration || settings.duration;
		// Make sure the settings are given right
		settings.queue = settings.queue && settings.axis.length > 1;
		
		if( settings.queue )
			// Let's keep the overall duration
			duration /= 2;
		settings.offset = both( settings.offset );
		settings.over = both( settings.over );

		return this._scrollable().each(function(){
			// Null target yields nothing, just like jQuery does
			if (target == null) return;

			var elem = this,
				$elem = $(elem),
				targ = target, toff, attr = {},
				win = $elem.is('html,body');

			switch( typeof targ ){
				// A number will pass the regex
				case 'number':
				case 'string':
					if( /^([+-]=)?\d+(\.\d+)?(px|%)?$/.test(targ) ){
						targ = both( targ );
						// We are done
						break;
					}
					// Relative selector, no break!
					targ = $(targ,this);
					if (!targ.length) return;
				case 'object':
					// DOMElement / jQuery
					if( targ.is || targ.style )
						// Get the real position of the target 
						toff = (targ = $(targ)).offset();
			}
			$.each( settings.axis.split(''), function( i, axis ){
				var Pos	= axis == 'x' ? 'Left' : 'Top',
					pos = Pos.toLowerCase(),
					key = 'scroll' + Pos,
					old = elem[key],
					max = $scrollTo.max(elem, axis);

				if( toff ){// jQuery / DOMElement
					attr[key] = toff[pos] + ( win ? 0 : old - $elem.offset()[pos] );

					// If it's a dom element, reduce the margin
					if( settings.margin ){
						attr[key] -= parseInt(targ.css('margin'+Pos)) || 0;
						attr[key] -= parseInt(targ.css('border'+Pos+'Width')) || 0;
					}
					
					attr[key] += settings.offset[pos] || 0;
					
					if( settings.over[pos] )
						// Scroll to a fraction of its width/height
						attr[key] += targ[axis=='x'?'width':'height']() * settings.over[pos];
				}else{ 
					var val = targ[pos];
					// Handle percentage values
					attr[key] = val.slice && val.slice(-1) == '%' ? 
						parseFloat(val) / 100 * max
						: val;
				}

				// Number or 'number'
				if( settings.limit && /^\d+$/.test(attr[key]) )
					// Check the limits
					attr[key] = attr[key] <= 0 ? 0 : Math.min( attr[key], max );

				// Queueing axes
				if( !i && settings.queue ){
					// Don't waste time animating, if there's no need.
					if( old != attr[key] )
						// Intermediate animation
						animate( settings.onAfterFirst );
					// Don't animate this axis again in the next iteration.
					delete attr[key];
				}
			});

			animate( settings.onAfter );			

			function animate( callback ){
				$elem.animate( attr, duration, settings.easing, callback && function(){
					callback.call(this, target, settings);
				});
			};

		}).end();
	};
	
	// Max scrolling position, works on quirks mode
	// It only fails (not too badly) on IE, quirks mode.
	$scrollTo.max = function( elem, axis ){
		var Dim = axis == 'x' ? 'Width' : 'Height',
			scroll = 'scroll'+Dim;
		
		if( !$(elem).is('html,body') )
			return elem[scroll] - $(elem)[Dim.toLowerCase()]();
		
		var size = 'client' + Dim,
			html = elem.ownerDocument.documentElement,
			body = elem.ownerDocument.body;

		return Math.max( html[scroll], body[scroll] ) 
			 - Math.min( html[size]  , body[size]   );
	};

	function both( val ){
		return typeof val == 'object' ? val : { top:val, left:val };
	};

});
//})( jQuery );
define('text!controls/codebooks/templates/index/index.html',[],function () { return '<% if (data.showPartial && data.sections.columns) { %>\r\n<div class="index-result partial-code-result" data-book="<%= data.book %>">\r\n    <span><span class="code"><%= data.partial %></span> <strong>&#58;</strong> <em>view in <%= TextBook.MAP_ICD10PCS_PR %> table, &quot;<%= _.findWhere(data.sections.columns[0].choices, { char: data.partial.charAt(0) }).label %>&quot;</em></span>\r\n</div>\r\n<% } %>\r\n<%_.forEach(data.records, function(record, i) { %>\r\n    <% if (i === 3 && !data.wasFindAllSearch) { %>\r\n    <a class="index-overflow-link" href="javascript:void(0)">Show all <%= data.records.length %> search results</a>\r\n    <div class="index-overflow">\r\n    <% } %>\r\n        <div class="index-result" id="index-<%= record.data_sequence %>" data-book="<%= record.data_book %>" data-sequence="<%= record.data_sequence %>" data-date="<%= record.data_date %>">\r\n            <span class="text"><%= record.text %></span>\r\n            <span class="codes">\r\n            <% if (typeof record.type ===\'undefined\' || record.type !== \'tablerow\') { %>\r\n                <%_.forEach(record.codes, function(rowCode, i) { %>\r\n                    <% if (i === 0) { %>\r\n                <span class="code"><%= rowCode %></span>\r\n                    <% } else { %>\r\n                [<span class="code bracketed"><%= rowCode %></span>]\r\n                    <% } %>\r\n                <% }); %>\r\n            <% } %>\r\n            </span>\r\n        </div>\r\n    <% if (i >= 3 && i + 1 === data.records.length && !data.wasFindAllSearch) { %>\r\n    </div>\r\n    <% } %>\r\n<% }); %>';});

define('text!controls/codebooks/templates/index/index-heading.html',[],function () { return '<div class="pane-content pane-slim-s<% if (!hideResearch) { print(\' pane-slim-e\'); } %>">\r\n    <div class="heading-slim">\r\n        <span>Search Results for `<%= data.term %>` in <%= book %>\r\n    </div>\r\n    <input type="hidden" id="searched-book" value="<%= data.book %>" />\r\n</div>';});

define('text!controls/codebooks/templates/index/index-heading-empty.html',[],function () { return '<div class="pane-content pane-slim-s<% if (!hideResearch) { print(\' pane-slim-e\'); } %>">\r\n    <div class="heading-slim">\r\n        <span>Search Results</span>\r\n    </div>\r\n</div>';});

define('text!controls/codebooks/templates/index/index-no-results.html',[],function () { return '<em>No results found.</em>';});

define('text!controls/codebooks/templates/index/index-empty.html',[],function () { return '';});

define('text!controls/codebooks/templates/index/index-pcs.html',[],function () { return '<div class="pcs-part first">\r\n    <span class="pcs-heading"><%= headings[0] %></span>\r\n    <strong class="pcs-char"><%= pcsCodeParts[0] || \'&mdash;\' %></strong>\r\n    <span class="pcs-label"><%= labels[0] %></span>\r\n</div>\r\n<div class="pcs-part">\r\n    <span class="pcs-heading"><%= headings[1] %></span>\r\n    <strong class="pcs-char"><%= pcsCodeParts[1] || \'&mdash;\' %></strong>\r\n    <span class="pcs-label"><%= labels[1] %></span>\r\n</div>\r\n<div class="pcs-part">\r\n    <span class="pcs-heading"><%= headings[2] %></span>\r\n    <strong class="pcs-char"><%= pcsCodeParts[2] || \'&mdash;\' %></strong>\r\n    <span class="pcs-label"><%= labels[2] %></span>\r\n</div>\r\n<div class="pcs-overview">\r\n    <div class="pcs-overview-left">\r\n        Selected Code:\r\n        <strong class="pcs-code"><%= pcsCodeFormatted %></strong>\r\n        <span class="pcs-code-description"></span>\r\n    </div>\r\n    <button type="submit" class="k-button btn-add-code<% if (pcsCode.length === 7) { print(\' enabled\'); } else { print(\' k-state-disabled\'); } %>"<% if (pcsCode.length !== 7) { print(\' disabled="disabled"\'); } %>>Add Code</button>\r\n</div>';});

/**
 * @license RequireJS i18n 2.0.1 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/i18n for details
 */
/*jslint regexp: true */
/*global require: false, navigator: false, define: false */

/**
 * This plugin handles i18n! prefixed modules. It does the following:
 *
 * 1) A regular module can have a dependency on an i18n bundle, but the regular
 * module does not want to specify what locale to load. So it just specifies
 * the top-level bundle, like "i18n!nls/colors".
 *
 * This plugin will load the i18n bundle at nls/colors, see that it is a root/master
 * bundle since it does not have a locale in its name. It will then try to find
 * the best match locale available in that master bundle, then request all the
 * locale pieces for that best match locale. For instance, if the locale is "en-us",
 * then the plugin will ask for the "en-us", "en" and "root" bundles to be loaded
 * (but only if they are specified on the master bundle).
 *
 * Once all the bundles for the locale pieces load, then it mixes in all those
 * locale pieces into each other, then finally sets the context.defined value
 * for the nls/colors bundle to be that mixed in locale.
 *
 * 2) A regular module specifies a specific locale to load. For instance,
 * i18n!nls/fr-fr/colors. In this case, the plugin needs to load the master bundle
 * first, at nls/colors, then figure out what the best match locale is for fr-fr,
 * since maybe only fr or just root is defined for that locale. Once that best
 * fit is found, all of its locale pieces need to have their bundles loaded.
 *
 * Once all the bundles for the locale pieces load, then it mixes in all those
 * locale pieces into each other, then finally sets the context.defined value
 * for the nls/fr-fr/colors bundle to be that mixed in locale.
 */
(function () {
    

    //regexp for reconstructing the master bundle name from parts of the regexp match
    //nlsRegExp.exec("foo/bar/baz/nls/en-ca/foo") gives:
    //["foo/bar/baz/nls/en-ca/foo", "foo/bar/baz/nls/", "/", "/", "en-ca", "foo"]
    //nlsRegExp.exec("foo/bar/baz/nls/foo") gives:
    //["foo/bar/baz/nls/foo", "foo/bar/baz/nls/", "/", "/", "foo", ""]
    //so, if match[5] is blank, it means this is the top bundle definition.
    var nlsRegExp = /(^.*(^|\/)nls(\/|$))([^\/]*)\/?([^\/]*)/;

    //Helper function to avoid repeating code. Lots of arguments in the
    //desire to stay functional and support RequireJS contexts without having
    //to know about the RequireJS contexts.
    function addPart(locale, master, needed, toLoad, prefix, suffix) {
        if (master[locale]) {
            needed.push(locale);
            if (master[locale] === true || master[locale] === 1) {
                toLoad.push(prefix + locale + '/' + suffix);
            }
        }
    }

    function addIfExists(req, locale, toLoad, prefix, suffix) {
        var fullName = prefix + locale + '/' + suffix;
        if (require._fileExists(req.toUrl(fullName))) {
            toLoad.push(fullName);
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     * This is not robust in IE for transferring methods that match
     * Object.prototype names, but the uses of mixin here seem unlikely to
     * trigger a problem related to that.
     */
    function mixin(target, source, force) {
        var prop;
        for (prop in source) {
            if (source.hasOwnProperty(prop) && (!target.hasOwnProperty(prop) || force)) {
                target[prop] = source[prop];
            } else if (typeof source[prop] === 'object') {
                mixin(target[prop], source[prop], force);
            }
        }
    }

    define('i18n',['module'], function (module) {
        var masterConfig = module.config();

        return {
            version: '2.0.1',
            /**
             * Called when a dependency needs to be loaded.
             */
            load: function (name, req, onLoad, config) {
                config = config || {};

                if (config.locale) {
                    masterConfig.locale = config.locale;
                }

                var masterName,
                    match = nlsRegExp.exec(name),
                    prefix = match[1],
                    locale = match[4],
                    suffix = match[5],
                    parts = locale.split("-"),
                    toLoad = [],
                    value = {},
                    i, part, current = "";

                //If match[5] is blank, it means this is the top bundle definition,
                //so it does not have to be handled. Locale-specific requests
                //will have a match[4] value but no match[5]
                if (match[5]) {
                    //locale-specific bundle
                    prefix = match[1];
                    masterName = prefix + suffix;
                } else {
                    //Top-level bundle.
                    masterName = name;
                    suffix = match[4];
                    locale = masterConfig.locale;
                    if (!locale) {
                        locale = masterConfig.locale =
                            typeof navigator === "undefined" ? "root" :
                            (navigator.language ||
                             navigator.userLanguage || "root").toLowerCase();
                    }
                    parts = locale.split("-");
                }

                if (config.isBuild) {
                    //Check for existence of all locale possible files and
                    //require them if exist.
                    toLoad.push(masterName);
                    addIfExists(req, "root", toLoad, prefix, suffix);
                    for (i = 0; i < parts.length; i++) {
                        part = parts[i];
                        current += (current ? "-" : "") + part;
                        addIfExists(req, current, toLoad, prefix, suffix);
                    }

                    req(toLoad, function () {
                        onLoad();
                    });
                } else {
                    //First, fetch the master bundle, it knows what locales are available.
                    req([masterName], function (master) {
                        //Figure out the best fit
                        var needed = [],
                            part;

                        //Always allow for root, then do the rest of the locale parts.
                        addPart("root", master, needed, toLoad, prefix, suffix);
                        for (i = 0; i < parts.length; i++) {
                            part = parts[i];
                            current += (current ? "-" : "") + part;
                            addPart(current, master, needed, toLoad, prefix, suffix);
                        }

                        //Load all the parts missing.
                        req(toLoad, function () {
                            var i, partBundle, part;
                            for (i = needed.length - 1; i > -1 && needed[i]; i--) {
                                part = needed[i];
                                partBundle = master[part];
                                if (partBundle === true || partBundle === 1) {
                                    partBundle = req(prefix + part + '/' + suffix);
                                }
                                mixin(value, partBundle);
                            }

                            //All done, notify the loader.
                            onLoad(value);
                        });
                    });
                }
            }
        };
    });
}());

define('locale/nls/books',{
    "root": {
        "CPT_ASSISTANT": "CPT Assistant",
        "CDR": "Coders' Desk Reference",
        "CROSSWALK": "Crosswalk",
        "ANESTHESIA_CROSSWALK": "Anesthesia Crosswalk",
        "CODING_ADVICE": "Coding Advice",
        "ADDITIONAL_REFERENCES": "Additional References",

        "INTERVENTIONAL_RADIOLOGY": "Interventional Radiology",
        "ICD9_GUIDELINES": "ICD-9-CM Official Guidelines",
        "ICD10_GUIDELINES": "ICD-10 Official Guidelines",
        "CC_HCPCS": "Coding Clinic for HCPCS",
        "CC_ICD9": "Coding Clinic for ICD-9-CM",
        "CC_ICD10": "Coding Clinic for ICD-10",
        "DICTIONARY": "Medical Dictionary (Dorland's)",
        "DRUGS": "Drug Data (Micromedex)",

        "ICD9CM_DX": "ICD-9-CM Diagnosis",
        "ICD9CM_DX_INDEX": "ICD-9-CM Diagnosis",
        "ICD9CM_DX_TABULAR": "ICD-9-CM Diagnosis Tabular",
        "ICD9CM_E": "ICD-9-CM E Code",
        "ICD9CM_E_INDEX": "ICD-9-CM E Code",
        "ICD9CM_E_TABULAR": "ICD-9-CM E Code Tabular",
        "ICD9CM_PR": "ICD-9-CM Procedure",
        "ICD9CM_PR_INDEX": "ICD-9-CM Procedure",
        "ICD9CM_PR_TABULAR": "ICD-9-CM Procedure Tabular",

        "ICD10CM_DX": "ICD-10-CM Diagnosis",
        "ICD10CM_DX_INDEX": "ICD-10-CM Diagnosis",
        "ICD10CM_DX_TABULAR": "ICD-10-CM Diagnosis Tabular",
        "ICD10CM_E": "ICD-10-CM E Code",
        "ICD10CM_E_INDEX": "ICD-10-CM E Code",
        "ICD10CM_E_TABULAR": "ICD-10-CM E Code Tabular",
        "ICD10PCS_PR": "ICD-10 Procedure",
        "ICD10PCS_PR_INDEX": "ICD-10 Procedure",
        "ICD10PCS_PR_TABULAR": "ICD-10 Procedure Tabular",

        "MAP_ICD10PCS_PR": "ICD-10-PCS",
        "MAP_ICD10PCS_PR_INDEX": "ICD-10-PCS",
        "MAP_ICD10PCS_PR_TABULAR": "ICD-10-PCS",

        "CPT4": "CPT",
        "HCPCS": "HCPCS",
        "CPT4_TABULAR": "CPT",
        "HCPCS_TABULAR": "HCPCS"
    }
    //, "es-es": true // uncomment this line for spanish translations
});
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/views/index',["require", "exports", "Backbone", "underscore", "jql", "vendor/jquery/plugins/jquery.scrollTo", "text!controls/codebooks/templates/index/index.html", "text!controls/codebooks/templates/index/index-heading.html", "text!controls/codebooks/templates/index/index-heading-empty.html", "text!controls/codebooks/templates/index/index-no-results.html", "text!controls/codebooks/templates/index/index-empty.html", "text!controls/codebooks/templates/index/index-pcs.html", "lib/api", "lib/net", "lib/templates", "lib/events", "lib/shortcuts", "i18n!locale/nls/books"], function(require, exports, __Backbone__, _____, __$__, __scrollTo__, __indexTemplate__, __indexHeadingTemplate__, __indexHeadingEmptyTemplate__, __indexNoResultsTemplate__, __indexEmptyTemplate__, __indexPCSTemplate__, __api__, __net__, __Templates__, __Events__, __Shortcuts__, __TextBook__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../../../vendor/jquery/plugins/jquery.scrollTo.d.ts"/>
    
    var scrollTo = __scrollTo__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var indexTemplate = __indexTemplate__;

    var indexHeadingTemplate = __indexHeadingTemplate__;

    var indexHeadingEmptyTemplate = __indexHeadingEmptyTemplate__;

    var indexNoResultsTemplate = __indexNoResultsTemplate__;

    var indexEmptyTemplate = __indexEmptyTemplate__;

    var indexPCSTemplate = __indexPCSTemplate__;

    var api = __api__;

    
    var net = __net__;

    var Templates = __Templates__;

    var Events = __Events__;

    var Shortcuts = __Shortcuts__;
    ///<reference path="../../../locale/nls/locales.d.ts"/>
    
    var TextBook = __TextBook__;

    var IndexView = (function (_super) {
        __extends(IndexView, _super);
        function IndexView(options) {
            // Force include
            if(scrollTo || !scrollTo) {
            }
            this.hub = options.hub;
            this.noResultsTemplate = Templates.get(Templates.tk_indexNoResults, indexNoResultsTemplate);
            this.emptyTemplate = Templates.get(Templates.tk_indexEmpty, indexEmptyTemplate);
            this.emptyHeadingTemplate = Templates.compile(Templates.tk_indexHeadingEmpty, indexHeadingEmptyTemplate);
            this.headingTemplate = Templates.compile(Templates.tk_indexHeading, indexHeadingTemplate);
            this.template = Templates.compile(Templates.tk_indexResults, indexTemplate);
            this.pcsTemplate = Templates.compile(Templates.tk_indexPCS, indexPCSTemplate);
            this.sharedProperties = options.sharedProperties;
            this.$heading = options.$heading;
            this.scrollDuration = (api.TC.current().settings.effects) ? 0 : 0// scroll animation is buggy if set too high, disabling completely for now
            ;
            this.hideResearch = options.hideResearch;
            this.events = {
                'click': 'tcSetFocus',
                'click .btn-add-code.enabled': 'postPCSCode',
                'click .index-result': 'loadTabularForItem',
                'click .index-result .code': 'loadTabularForItem',
                'click .index-overflow-link': 'showOverflow'
            };
            this.scopeName = 'codebooks:index';
            this.shortcuts = {
                'up codebooks:index': 'moveArrow',
                'down codebooks:index': 'moveArrow',
                'enter codebooks:index': 'focusTabular'
            };
                _super.call(this, options);
        }
        IndexView.prototype.initialize = function (options) {
            this.tcInit();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.hub, Events.CodeBooksFocusIndex, this.tcSetFocus);
            this.listenTo(this.hub, Events.CodeBooksClear, this.clear);
            this.listenTo(this.hub, Events.CodeBooksSearch, this.clear);
            this.listenTo(this.hub, Events.CodeBooksSearchComplete, this.showResults);
            this.listenTo(this.hub, Events.CodeBooksPCSCodeChanged, this.renderPCS);
            this.listenTo(this.hub, Events.CodeBooksGetICD10PCSTableData, this.showPCS);
            this.listenTo(this.hub, Events.CodeBooksGetCrosswalk, this.hidePCS);
            this.listenTo(this.hub, Events.CodeBooksGetTabular, this.hidePCS);
        };
        IndexView.prototype.showPCS = function (e) {
            this.$('.pcs-pane').show();
            this.$('.default-pane').hide();
        };
        IndexView.prototype.hidePCS = function (e) {
            this.$('.default-pane').show();
            this.$('.pcs-pane').hide();
        };
        IndexView.prototype.renderPCS = /** */
        function (event) {
            var formattedCode = '_______'.split(''), codeLength = event.code.length, getDescriptionOptions, $pcsContainer = this.$('.pcs-pane'), pcsHtml;
            this.setLoading(false);
            for(var i = 0; i < codeLength; i++) {
                formattedCode[i] = event.code.charAt(i);
            }
            pcsHtml = this.pcsTemplate({
                pcsCodeParts: event.code.split(''),
                pcsCode: event.code,
                pcsCodeFormatted: formattedCode.join(''),
                headings: event.headings,
                labels: event.labels
            });
            if($pcsContainer.length === 0) {
                this.$el.append(pcsHtml);
            } else {
                $pcsContainer.html(pcsHtml);
            }
            this.showPCS();
            if(codeLength === 7) {
                getDescriptionOptions = {
                    code: event.code,
                    code_type: 'ICD10PCS_PR'
                };
                this.setPCSDescriptionLoading(true);
                net.Net.tryAbort(this.currentReq);
                this.currentReq = api.TC.current()._net.codeGetDescription(getDescriptionOptions, this.updatePCSCodeDescription, this.updatePCSCodeDescription);
            }
        };
        IndexView.prototype.setPCSDescriptionLoading = /** */
        function (notDone) {
            if(typeof notDone === 'undefined' || !notDone) {
                this.$('.pcs-pane .tc-loading').remove();
            } else {
                this.$('.pcs-pane .pcs-code-description').html('<span class="k-loading k-icon tc-loading">Loading</span>');
            }
        };
        IndexView.prototype.updatePCSCodeDescription = function (data) {
            this.setPCSDescriptionLoading(false);
            this.$('.pcs-pane .pcs-code-description').text(data.medium_description);
        };
        IndexView.prototype.postPCSCode = function (event) {
            var codePostedData, codeToPost;
            codeToPost = {
                code: this.$('.pcs-pane .pcs-code').text(),
                codeType: 'ICD10PCS_PR'
            };
            codePostedData = {
                codes: [
                    codeToPost
                ]
            };
            this.hub.trigger(Events.CodeBooksCodePosted, codePostedData);
        };
        IndexView.prototype.focusTabular = /** */
        function (event, keymasterEvent) {
            // capture enter key so it doesnt trickle down to tabular and select the highlighted code
            var jqe = $.event.fix(event);
            jqe.preventDefault();
            this.$('.default-pane .k-state-focused').click();
        };
        IndexView.prototype.clear = /**
        * @listens Events.EncoderSearch
        */
        function (event) {
            var isPCS = event && event.book && event.book === 'ICD10PCS_PR';
            if(typeof event === 'undefined' || !isPCS) {
                this.$heading.html(this.emptyHeadingTemplate({
                    hideResearch: this.hideResearch
                }));
                this.$('.default-pane').html(this.emptyTemplate);
                this.hidePCS();
                if(event && event.term) {
                    this.setLoading(true);
                }
            }
            if(isPCS) {
                this.$('.pcs-pane').empty();
                this.showPCS();
            }
        };
        IndexView.prototype.setLoading = /** */ function (notDone) {
            if(typeof notDone === 'undefined' || !notDone) {
                this.$heading.find('.tc-loading').remove();
            } else {
                this.$heading.find('.heading-slim').append('<span class="k-loading k-icon tc-loading">Loading</span>');
            }
        };
        IndexView.prototype.render = function () {
            this.clear();
            return this;
        };
        IndexView.prototype.showOverflow = function (event) {
            var $target = $(event.currentTarget), $selectedItem, $itemToSelect;
            $selectedItem = this.$('.k-state-focused').length > 0 ? this.$('.k-state-focused') : this.$('.item-selected');
            $target.next().removeClass().children(':first').unwrap();
            $itemToSelect = $selectedItem.hasClass('index-overflow-link') ? $target.next() : $selectedItem;
            this.focusEntry($itemToSelect);
            $target.remove();
        };
        IndexView.prototype.showResults = /**
        * @listens Events.CodebooksSearchComplete
        */
        function (event) {
            var getPCSTabularOptions;
            if(event.records.length === 0) {
                if(event.partialCode.length && event.book.indexOf('ICD10PCS') !== -1) {
                    getPCSTabularOptions = {
                        code: event.partialCode
                    };
                    this.hub.trigger(Events.CodeBooksGetICD10PCSTableData, getPCSTabularOptions);
                } else {
                    this.$heading.html(this.headingTemplate({
                        data: {
                            term: event.term,
                            book: event.book
                        },
                        book: TextBook[event.book] || event.book,
                        hideResearch: this.hideResearch
                    }));
                    this.$('.default-pane').html(this.noResultsTemplate);
                    this.hidePCS();
                    this.hub.trigger(Events.CodeBooksSearchNoResults, event);
                }
            } else if(typeof event.isSilent === 'undefined' || !event.isSilent) {
                if(event.type === 'Term') {
                    this.$heading.html(this.headingTemplate({
                        data: {
                            term: event.term,
                            book: event.book
                        },
                        book: TextBook[event.book] || event.book,
                        hideResearch: this.hideResearch
                    }));
                    var renderedHTML = this.template({
                        data: {
                            records: event.records.toJSON(),
                            book: event.book,
                            showPartial: event.partialCode.length > 0 && event.book.indexOf('ICD10PCS') !== -1,
                            partial: event.partialCode,
                            sections: this.sharedProperties.get('pcsSections'),
                            wasFindAllSearch: event.searchOption === 'FindAll'
                        },
                        TextBook: TextBook
                    });
                    this.$('.default-pane').html(renderedHTML);
                    this.hidePCS();
                    // 'select' first record
                    this.$('.default-pane .index-result:not(.partial-code-result)').first().click();
                } else {
                    this.setLoading(false);
                }
            }
        };
        IndexView.prototype.loadTabularForItem = /**
        * @triggers Events.EncoderGetTabular
        */
        function (event) {
            // don't let this click bubble up to the 'row'
            event.stopPropagation();
            var $target = $(event.currentTarget), isCode = $target.hasClass('code'), isPartialCode = $target.hasClass('partial-code-result'), $originalTarget = $target, isBracketed = false, getTabularEventOptions, getPCSTabularOptions, codeInContextData, setCodePairOptions, $bracketed, sequence, book, term, date;
            // change the target to the parent
            if(isCode) {
                $target = $target.closest('.index-result');
                term = $originalTarget.text();
                // HACK. HOW DOES SL CONTROL KNOW TO SEARCH INDEX INSTEAD? LIKE THIS?
                book = $target.attr('data-book').replace('_INDEX', '_TABULAR');
                date = $target.attr('data-date');
                $bracketed = $target.find('.bracketed');
                isBracketed = $bracketed.length > 0;
                if(isBracketed) {
                    term = $target.find('.code:first').text();
                    setCodePairOptions = {
                        primaryCode: term,
                        secondaryCode: $target.find('.bracketed:first').text()
                    };
                    this.hub.trigger(Events.CodeBooksSetCodePair, setCodePairOptions);
                }
            } else {
                term = $target.find('.text').text();
                book = $target.attr('data-book');
                date = $target.attr('data-date');
            }
            // this can be null and should be for code clicks
            try  {
                sequence = $originalTarget.attr('id').replace('index-', '');
            } catch (e) {
            }
            if(book.indexOf('ICD10PCS') !== -1 && (isCode || isPartialCode)) {
                // PCS
                term = $target.find('.code:first').text();
                getPCSTabularOptions = {
                    code: term
                };
                this.hub.trigger(Events.CodeBooksGetICD10PCSTableData, getPCSTabularOptions);
            } else {
                // Other
                // fire some event to pick up the selected item and run search(es)
                getTabularEventOptions = {
                    sequence: sequence,
                    book: book,
                    term: term,
                    date: date
                };
                this.hub.trigger(Events.CodeBooksGetTabular, getTabularEventOptions);
            }
            this.focusEntry($target, true);
        };
        IndexView.prototype.focusEntry = /** */
        function ($target, select) {
            var $c = this.$('.pane-content'), offset = $c.height() / 2, scrollOptions;
            $target.closest('.pane-content').show().siblings().hide();
            scrollOptions = {
                duration: this.scrollDuration,
                offset: -offset
            };
            $c.stop().scrollTo($target, scrollOptions);
            // place the selected indicators
            if(select) {
                $target.attr('aria-selected', 'true').addClass('item-selected').siblings().removeAttr('aria-selected').removeClass('item-selected');
                this.$('.k-state-focused').removeClass('k-state-focused');
            } else {
                this.$('.k-state-focused').removeClass('k-state-focused');
                $target.addClass('k-state-focused');
            }
        };
        IndexView.prototype.moveArrow = /** */
        function (event, keymasterEvent) {
            var jqE = $.event.fix(event);
            jqE.preventDefault();
            var $activeEl = this.$('.default-pane .k-state-focused').length > 0 ? this.$('.default-pane .k-state-focused') : this.$('.default-pane .item-selected');
            switch(keymasterEvent.key) {
                case 'up':
                    this.focusEntry($activeEl.prev());
                    break;
                case 'down':
                    this.focusEntry($activeEl.next());
                    break;
                default:
                    break;
            }
        };
        IndexView.prototype.onSplitterCreated = /** */
        function () {
            var splitter = this.$el.closest('.k-splitter').data('kendoSplitter');
            splitter.bind('layoutChange', this.fixContentScrollHeight);
            this.fixContentScrollHeight();
        };
        IndexView.prototype.fixContentScrollHeight = function (e) {
            var $scrollableContent = this.$el.closest('.index-mid-wrap.pane-scrollable');
            if($scrollableContent.length > 0) {
                this.contentHeight = $scrollableContent.height() - 20;
                $scrollableContent.find('.pane-content').css('height', this.contentHeight);
            }
        };
        return IndexView;
    })(Backbone.View);
    exports.IndexView = IndexView;    
})
;
//  Underscore.string
//  (c) 2010 Esa-Matti Suuronen <esa-matti aet suuronen dot org>
//  Underscore.string is freely distributable under the terms of the MIT license.
//  Documentation: https://github.com/epeli/underscore.string
//  Some code is borrowed from MooTools and Alexandru Marasteanu.
//  Version '2.3.0'

//!function (root, String) {
define('vendor/underscore/plugins/underscore.string',["underscore"], function (_) {

    

    // Defining helper functions.

    var nativeTrim = String.prototype.trim;
    var nativeTrimRight = String.prototype.trimRight;
    var nativeTrimLeft = String.prototype.trimLeft;

    var parseNumber = function (source) { return source * 1 || 0; };

    var strRepeat = function (str, qty) {
        if (qty < 1) return '';
        var result = '';
        while (qty > 0) {
            if (qty & 1) result += str;
            qty >>= 1, str += str;
        }
        return result;
    };

    var slice = [].slice;

    var defaultToWhiteSpace = function (characters) {
        if (characters == null)
            return '\\s';
        else if (characters.source)
            return characters.source;
        else
            return '[' + _s.escapeRegExp(characters) + ']';
    };

    var escapeChars = {
        lt: '<',
        gt: '>',
        quot: '"',
        amp: '&',
        apos: "'"
    };

    var reversedEscapeChars = {};
    for (var key in escapeChars) reversedEscapeChars[escapeChars[key]] = key;
    reversedEscapeChars["'"] = '#39';

    // sprintf() for JavaScript 0.7-beta1
    // http://www.diveintojavascript.com/projects/javascript-sprintf
    //
    // Copyright (c) Alexandru Marasteanu <alexaholic [at) gmail (dot] com>
    // All rights reserved.

    var sprintf = (function () {
        function get_type(variable) {
            return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
        }

        var str_repeat = strRepeat;

        var str_format = function () {
            if (!str_format.cache.hasOwnProperty(arguments[0])) {
                str_format.cache[arguments[0]] = str_format.parse(arguments[0]);
            }
            return str_format.format.call(null, str_format.cache[arguments[0]], arguments);
        };

        str_format.format = function (parse_tree, argv) {
            var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length;
            for (i = 0; i < tree_length; i++) {
                node_type = get_type(parse_tree[i]);
                if (node_type === 'string') {
                    output.push(parse_tree[i]);
                }
                else if (node_type === 'array') {
                    match = parse_tree[i]; // convenience purposes only
                    if (match[2]) { // keyword argument
                        arg = argv[cursor];
                        for (k = 0; k < match[2].length; k++) {
                            if (!arg.hasOwnProperty(match[2][k])) {
                                throw new Error(sprintf('[_.sprintf] property "%s" does not exist', match[2][k]));
                            }
                            arg = arg[match[2][k]];
                        }
                    } else if (match[1]) { // positional argument (explicit)
                        arg = argv[match[1]];
                    }
                    else { // positional argument (implicit)
                        arg = argv[cursor++];
                    }

                    if (/[^s]/.test(match[8]) && (get_type(arg) != 'number')) {
                        throw new Error(sprintf('[_.sprintf] expecting number but found %s', get_type(arg)));
                    }
                    switch (match[8]) {
                        case 'b': arg = arg.toString(2); break;
                        case 'c': arg = String.fromCharCode(arg); break;
                        case 'd': arg = parseInt(arg, 10); break;
                        case 'e': arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential(); break;
                        case 'f': arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg); break;
                        case 'o': arg = arg.toString(8); break;
                        case 's': arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg); break;
                        case 'u': arg = Math.abs(arg); break;
                        case 'x': arg = arg.toString(16); break;
                        case 'X': arg = arg.toString(16).toUpperCase(); break;
                    }
                    arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+' + arg : arg);
                    pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
                    pad_length = match[6] - String(arg).length;
                    pad = match[6] ? str_repeat(pad_character, pad_length) : '';
                    output.push(match[5] ? arg + pad : pad + arg);
                }
            }
            return output.join('');
        };

        str_format.cache = {};

        str_format.parse = function (fmt) {
            var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
            while (_fmt) {
                if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
                    parse_tree.push(match[0]);
                }
                else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
                    parse_tree.push('%');
                }
                else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
                    if (match[2]) {
                        arg_names |= 1;
                        var field_list = [], replacement_field = match[2], field_match = [];
                        if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                            field_list.push(field_match[1]);
                            while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
                                if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                                    field_list.push(field_match[1]);
                                }
                                else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
                                    field_list.push(field_match[1]);
                                }
                                else {
                                    throw new Error('[_.sprintf] huh?');
                                }
                            }
                        }
                        else {
                            throw new Error('[_.sprintf] huh?');
                        }
                        match[2] = field_list;
                    }
                    else {
                        arg_names |= 2;
                    }
                    if (arg_names === 3) {
                        throw new Error('[_.sprintf] mixing positional and named placeholders is not (yet) supported');
                    }
                    parse_tree.push(match);
                }
                else {
                    throw new Error('[_.sprintf] huh?');
                }
                _fmt = _fmt.substring(match[0].length);
            }
            return parse_tree;
        };

        return str_format;
    })();



    // Defining underscore.string

    var _s = {

        VERSION: '2.3.0',

        isBlank: function (str) {
            if (str == null) str = '';
            return (/^\s*$/).test(str);
        },

        stripTags: function (str) {
            if (str == null) return '';
            return String(str).replace(/<\/?[^>]+>/g, '');
        },

        capitalize: function (str) {
            str = str == null ? '' : String(str);
            return str.charAt(0).toUpperCase() + str.slice(1);
        },

        chop: function (str, step) {
            if (str == null) return [];
            str = String(str);
            step = ~~step;
            return step > 0 ? str.match(new RegExp('.{1,' + step + '}', 'g')) : [str];
        },

        clean: function (str) {
            return _s.strip(str).replace(/\s+/g, ' ');
        },

        count: function (str, substr) {
            if (str == null || substr == null) return 0;

            str = String(str);
            substr = String(substr);

            var count = 0,
              pos = 0,
              length = substr.length;

            while (true) {
                pos = str.indexOf(substr, pos);
                if (pos === -1) break;
                count++;
                pos += length;
            }

            return count;
        },

        chars: function (str) {
            if (str == null) return [];
            return String(str).split('');
        },

        swapCase: function (str) {
            if (str == null) return '';
            return String(str).replace(/\S/g, function (c) {
                return c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase();
            });
        },

        escapeHTML: function (str) {
            if (str == null) return '';
            return String(str).replace(/[&<>"']/g, function (m) { return '&' + reversedEscapeChars[m] + ';'; });
        },

        unescapeHTML: function (str) {
            if (str == null) return '';
            return String(str).replace(/\&([^;]+);/g, function (entity, entityCode) {
                var match;

                if (entityCode in escapeChars) {
                    return escapeChars[entityCode];
                } else if (match = entityCode.match(/^#x([\da-fA-F]+)$/)) {
                    return String.fromCharCode(parseInt(match[1], 16));
                } else if (match = entityCode.match(/^#(\d+)$/)) {
                    return String.fromCharCode(~~match[1]);
                } else {
                    return entity;
                }
            });
        },

        escapeRegExp: function (str) {
            if (str == null) return '';
            return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
        },

        splice: function (str, i, howmany, substr) {
            var arr = _s.chars(str);
            arr.splice(~~i, ~~howmany, substr);
            return arr.join('');
        },

        insert: function (str, i, substr) {
            return _s.splice(str, i, 0, substr);
        },

        include: function (str, needle) {
            if (needle === '') return true;
            if (str == null) return false;
            return String(str).indexOf(needle) !== -1;
        },

        join: function () {
            var args = slice.call(arguments),
              separator = args.shift();

            if (separator == null) separator = '';

            return args.join(separator);
        },

        lines: function (str) {
            if (str == null) return [];
            return String(str).split("\n");
        },

        reverse: function (str) {
            return _s.chars(str).reverse().join('');
        },

        startsWith: function (str, starts) {
            if (starts === '') return true;
            if (str == null || starts == null) return false;
            str = String(str); starts = String(starts);
            return str.length >= starts.length && str.slice(0, starts.length) === starts;
        },

        endsWith: function (str, ends) {
            if (ends === '') return true;
            if (str == null || ends == null) return false;
            str = String(str); ends = String(ends);
            return str.length >= ends.length && str.slice(str.length - ends.length) === ends;
        },

        succ: function (str) {
            if (str == null) return '';
            str = String(str);
            return str.slice(0, -1) + String.fromCharCode(str.charCodeAt(str.length - 1) + 1);
        },

        titleize: function (str) {
            if (str == null) return '';
            return String(str).replace(/(?:^|\s)\S/g, function (c) { return c.toUpperCase(); });
        },

        camelize: function (str) {
            return _s.trim(str).replace(/[-_\s]+(.)?/g, function (match, c) { return c.toUpperCase(); });
        },

        underscored: function (str) {
            return _s.trim(str).replace(/([a-z\d])([A-Z]+)/g, '$1_$2').replace(/[-\s]+/g, '_').toLowerCase();
        },

        dasherize: function (str) {
            return _s.trim(str).replace(/([A-Z])/g, '-$1').replace(/[-_\s]+/g, '-').toLowerCase();
        },

        classify: function (str) {
            return _s.titleize(String(str).replace(/_/g, ' ')).replace(/\s/g, '');
        },

        humanize: function (str) {
            return _s.capitalize(_s.underscored(str).replace(/_id$/, '').replace(/_/g, ' '));
        },

        trim: function (str, characters) {
            if (str == null) return '';
            if (!characters && nativeTrim) return nativeTrim.call(str);
            characters = defaultToWhiteSpace(characters);
            return String(str).replace(new RegExp('\^' + characters + '+|' + characters + '+$', 'g'), '');
        },

        ltrim: function (str, characters) {
            if (str == null) return '';
            if (!characters && nativeTrimLeft) return nativeTrimLeft.call(str);
            characters = defaultToWhiteSpace(characters);
            return String(str).replace(new RegExp('^' + characters + '+'), '');
        },

        rtrim: function (str, characters) {
            if (str == null) return '';
            if (!characters && nativeTrimRight) return nativeTrimRight.call(str);
            characters = defaultToWhiteSpace(characters);
            return String(str).replace(new RegExp(characters + '+$'), '');
        },

        truncate: function (str, length, truncateStr) {
            if (str == null) return '';
            str = String(str); truncateStr = truncateStr || '...';
            length = ~~length;
            return str.length > length ? str.slice(0, length) + truncateStr : str;
        },

        /**
         * _s.prune: a more elegant version of truncate
         * prune extra chars, never leaving a half-chopped word.
         * @author github.com/rwz
         */
        prune: function (str, length, pruneStr, split) {
            if (str == null) return '';

            str = String(str); length = ~~length;
            pruneStr = pruneStr != null ? String(pruneStr) : '...';

            if (str.length <= length) return str;

            var tmpl = function (c) { return c.toUpperCase() !== c.toLowerCase() ? 'A' : ' '; },
              template = str.slice(0, length + 1).replace(/.(?=\W*\w*$)/g, tmpl); // 'Hello, world' -> 'HellAA AAAAA'

            if (template.slice(template.length - 2).match(/\w\w/))
                template = template.replace(/\s*\S+$/, '');
            else
                template = _s.rtrim(template.slice(0, template.length - 1));

            if (split)
                return (template + pruneStr).length > str.length ? [str, null] : [str.slice(0, template.length) + pruneStr, str.slice(template.length + 1)];

            return (template + pruneStr).length > str.length ? str : str.slice(0, template.length) + pruneStr;
        },

        words: function (str, delimiter) {
            if (_s.isBlank(str)) return [];
            return _s.trim(str, delimiter).split(delimiter || /\s+/);
        },

        pad: function (str, length, padStr, type) {
            str = str == null ? '' : String(str);
            length = ~~length;

            var padlen = 0;

            if (!padStr)
                padStr = ' ';
            else if (padStr.length > 1)
                padStr = padStr.charAt(0);

            switch (type) {
                case 'right':
                    padlen = length - str.length;
                    return str + strRepeat(padStr, padlen);
                case 'both':
                    padlen = length - str.length;
                    return strRepeat(padStr, Math.ceil(padlen / 2)) + str
                            + strRepeat(padStr, Math.floor(padlen / 2));
                default: // 'left'
                    padlen = length - str.length;
                    return strRepeat(padStr, padlen) + str;
            }
        },

        lpad: function (str, length, padStr) {
            return _s.pad(str, length, padStr);
        },

        rpad: function (str, length, padStr) {
            return _s.pad(str, length, padStr, 'right');
        },

        lrpad: function (str, length, padStr) {
            return _s.pad(str, length, padStr, 'both');
        },

        sprintf: sprintf,

        vsprintf: function (fmt, argv) {
            argv.unshift(fmt);
            return sprintf.apply(null, argv);
        },

        toNumber: function (str, decimals) {
            if (!str) return 0;
            str = _s.trim(str);
            if (!str.match(/^-?\d+(?:\.\d+)?$/)) return NaN;
            return parseNumber(parseNumber(str).toFixed(~~decimals));
        },

        numberFormat: function (number, dec, dsep, tsep) {
            if (isNaN(number) || number == null) return '';

            number = number.toFixed(~~dec);
            tsep = typeof tsep == 'string' ? tsep : ',';

            var parts = number.split('.'), fnums = parts[0],
              decimals = parts[1] ? (dsep || '.') + parts[1] : '';

            return fnums.replace(/(\d)(?=(?:\d{3})+$)/g, '$1' + tsep) + decimals;
        },

        strRight: function (str, sep) {
            if (str == null) return '';
            str = String(str); sep = sep != null ? String(sep) : sep;
            var pos = !sep ? -1 : str.indexOf(sep);
            return ~pos ? str.slice(pos + sep.length, str.length) : str;
        },

        strRightBack: function (str, sep) {
            if (str == null) return '';
            str = String(str); sep = sep != null ? String(sep) : sep;
            var pos = !sep ? -1 : str.lastIndexOf(sep);
            return ~pos ? str.slice(pos + sep.length, str.length) : str;
        },

        strLeft: function (str, sep) {
            if (str == null) return '';
            str = String(str); sep = sep != null ? String(sep) : sep;
            var pos = !sep ? -1 : str.indexOf(sep);
            return ~pos ? str.slice(0, pos) : str;
        },

        strLeftBack: function (str, sep) {
            if (str == null) return '';
            str += ''; sep = sep != null ? '' + sep : sep;
            var pos = str.lastIndexOf(sep);
            return ~pos ? str.slice(0, pos) : str;
        },

        toSentence: function (array, separator, lastSeparator, serial) {
            separator = separator || ', '
            lastSeparator = lastSeparator || ' and '
            var a = array.slice(), lastMember = a.pop();

            if (array.length > 2 && serial) lastSeparator = _s.rtrim(separator) + lastSeparator;

            return a.length ? a.join(separator) + lastSeparator + lastMember : lastMember;
        },

        toSentenceSerial: function () {
            var args = slice.call(arguments);
            args[3] = true;
            return _s.toSentence.apply(_s, args);
        },

        slugify: function (str) {
            if (str == null) return '';

            var from = "ąàáäâãåæćęèéëêìíïîłńòóöôõøùúüûñçżź",
                to = "aaaaaaaaceeeeeiiiilnoooooouuuunczz",
                regex = new RegExp(defaultToWhiteSpace(from), 'g');

            str = String(str).toLowerCase().replace(regex, function (c) {
                var index = from.indexOf(c);
                return to.charAt(index) || '-';
            });

            return _s.dasherize(str.replace(/[^\w\s-]/g, ''));
        },

        surround: function (str, wrapper) {
            return [wrapper, str, wrapper].join('');
        },

        quote: function (str) {
            return _s.surround(str, '"');
        },

        exports: function () {
            var result = {};

            for (var prop in this) {
                if (!this.hasOwnProperty(prop) || prop.match(/^(?:include|contains|reverse)$/)) continue;
                result[prop] = this[prop];
            }

            return result;
        },

        repeat: function (str, qty, separator) {
            if (str == null) return '';

            qty = ~~qty;

            // using faster implementation if separator is not needed;
            if (separator == null) return strRepeat(String(str), qty);

            // this one is about 300x slower in Google Chrome
            for (var repeat = []; qty > 0; repeat[--qty] = str) { }
            return repeat.join(separator);
        },

        levenshtein: function (str1, str2) {
            if (str1 == null && str2 == null) return 0;
            if (str1 == null) return String(str2).length;
            if (str2 == null) return String(str1).length;

            str1 = String(str1); str2 = String(str2);

            var current = [], prev, value;

            for (var i = 0; i <= str2.length; i++)
                for (var j = 0; j <= str1.length; j++) {
                    if (i && j)
                        if (str1.charAt(j - 1) === str2.charAt(i - 1))
                            value = prev;
                        else
                            value = Math.min(current[j], current[j - 1], prev) + 1;
                    else
                        value = i + j;

                    prev = current[j];
                    current[j] = value;
                }

            return current.pop();
        }
    };

    // Aliases

    _s.strip = _s.trim;
    _s.lstrip = _s.ltrim;
    _s.rstrip = _s.rtrim;
    _s.center = _s.lrpad;
    _s.rjust = _s.lpad;
    _s.ljust = _s.rpad;
    _s.contains = _s.include;
    _s.q = _s.quote;

    // Exporting

    // CommonJS module is defined
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports)
            module.exports = _s;

        exports._s = _s;
    }

    // Register as a named module with AMD.
    if (typeof define === 'function' && define.amd)
        define('underscore.string', [], function () { return _s; });


    // Integrate with Underscore.js if defined
    // or create our own underscore object.
    //root._ = root._ || {};
    //root._.string = root._.str = _s;
    _.string = _.str = _s;

});
//}(this, String);
/*!
 * jQuery imagesLoaded plugin v2.1.0
 * http://github.com/desandro/imagesloaded
 *
 * MIT License. by Paul Irish et al.
 */

var define;

/*jshint curly: true, eqeqeq: true, noempty: true, strict: true, undef: true, browser: true */
/*global jQuery: false */

//; (function ($, undefined) {
define('vendor/jquery/plugins/jquery.imagesloaded',["jql"], function ($) {

    //

    // blank image data-uri bypasses webkit log warning (thx doug jones)
    var BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

    $.fn.imagesLoaded = function (callback) {
        var $this = this,
            deferred = $.isFunction($.Deferred) ? $.Deferred() : 0,
            hasNotify = $.isFunction(deferred.notify),
            $images = $this.find('img').add($this.filter('img')),
            loaded = [],
            proper = [],
            broken = [];

        // Register deferred callbacks
        if ($.isPlainObject(callback)) {
            $.each(callback, function (key, value) {
                if (key === 'callback') {
                    callback = value;
                } else if (deferred) {
                    deferred[key](value);
                }
            });
        }

        function doneLoading() {
            var $proper = $(proper),
                $broken = $(broken);

            if (deferred) {
                if (broken.length) {
                    deferred.reject($images, $proper, $broken);
                } else {
                    deferred.resolve($images);
                }
            }

            if ($.isFunction(callback)) {
                callback.call($this, $images, $proper, $broken);
            }
        }

        function imgLoaded(img, isBroken) {
            // don't proceed if BLANK image, or image is already loaded
            if (img.src === BLANK || $.inArray(img, loaded) !== -1) {
                return;
            }

            // store element in loaded images array
            loaded.push(img);

            // keep track of broken and properly loaded images
            if (isBroken) {
                broken.push(img);
            } else {
                proper.push(img);
            }

            // cache image and its state for future calls
            $.data(img, 'imagesLoaded', { isBroken: isBroken, src: img.src });

            // trigger deferred progress method if present
            if (hasNotify) {
                deferred.notifyWith($(img), [isBroken, $images, $(proper), $(broken)]);
            }

            // call doneLoading and clean listeners if all images are loaded
            if ($images.length === loaded.length) {
                setTimeout(doneLoading);
                $images.unbind('.imagesLoaded');
            }
        }

        // if no images, trigger immediately
        if (!$images.length) {
            doneLoading();
        } else {
            $images.bind('load.imagesLoaded error.imagesLoaded', function (event) {
                // trigger imgLoaded
                imgLoaded(event.target, event.type === 'error');
            }).each(function (i, el) {
                var src = el.src;

                // find out if this image has been already checked for status
                // if it was, and src has not changed, call imgLoaded on it
                var cached = $.data(el, 'imagesLoaded');
                if (cached && cached.src === src) {
                    imgLoaded(el, cached.isBroken);
                    return;
                }

                // if complete is true and browser supports natural sizes, try
                // to check for image status manually
                if (el.complete && el.naturalWidth !== undefined) {
                    imgLoaded(el, el.naturalWidth === 0 || el.naturalHeight === 0);
                    return;
                }

                // cached images don't fire load sometimes, so we reset src, but only when
                // dealing with IE, or image is complete (loaded) and failed manual check
                // webkit hack from http://groups.google.com/group/jquery-dev/browse_thread/thread/eee6ab7b2da50e1f
                if (el.readyState || el.complete) {
                    el.src = BLANK;
                    el.src = src;
                }
            });
        }

        return deferred ? deferred.promise($this) : $this;
    };

});
//})(jQuery);

define('text!controls/codebooks/templates/tabular/tabular.html',[],function () { return '<% _.each(records, function(record) { %>\r\n    <div class="tabular-result tabular-tabular-result type-<%= record.recordType %> level-<%= record.record.level %><% if (record.record.hasinstructionalnotes) { print (\' inote\'); } %><% if (record.record.subtypes && record.record.subtypes.length) { _.each(record.record.subtypes, function(st) { print(\' subtype-\' + st.name); }); } %><% if (record.selectable && !record.sevenCharCode) { print(\' selectable\'); } %><% if (record.sevenCharCode) { print(\' seven-char\'); } %>" id="tabular-<%= record.data_sequence %>" data-level="<%= record.record.level %>" data-book="<%= record.data_book %>" data-sequence="<%= record.data_sequence %>" data-date="<%= record.data_date %>">\r\n    <% switch (record.recordType) {\r\n        case \'booktitle\': { %>\r\n        <h1><%= record.record.content %></h1>\r\n        <% }\r\n        break;\r\n        case \'sectiontitle\':\r\n        case \'chaptertitle\': { %>\r\n        <h3><%= record.record.content %></h3>\r\n        <% }\r\n        break;\r\n        case \'regular\': { %>\r\n        <div class="padded">\r\n            <% _.each(record.record.regular_note_data.segments, function(segment) { %>\r\n            <span class="note <%= segment.type %> note-level-<%= segment.level%>"><%= segment.content %></span>\r\n            <% }); %>\r\n        </div>\r\n        <% }\r\n        break;\r\n        case \'instructionalnote\': { %>\r\n        <% if (typeof inotePopup !== \'undefined\' && inotePopup && record.startCode && record.endCode) { %>\r\n            <div class="code-range code-text"><%= record.startCode %> &mdash; <%= record.endCode %></div>\r\n        <% } %>\r\n        <div class="padded <%= record.record.instructional_note_data.type %>">\r\n            <%_.forEach(record.record.instructional_note_data.segments, function(segment, i) { %>\r\n            <div class="parts<% if (i === 0) { print(\' first\'); } %>">\r\n                <% if (i === 0) { %><span class="prefix"><%= _.str.titleize(record.record.instructional_note_data.type) + \':\' %>&nbsp;</span><% } %><span class="segment level-<%= segment.level %>"><span class="part <%= segment.type %>"><%= segment.content.replace(/^Includes:\\s?|^Excludes[12]:\\s?/i, \'\') %></span></span>\r\n            </div>\r\n            <% }); %>\r\n        </div>\r\n        <% }\r\n        break;\r\n        default: { %>\r\n        <div class="leading col">\r\n            <a class="inote-icon icon" title="Show Instructional Notes" href="javascript:void(0)"></a>\r\n        </div>\r\n        <div class="padded">\r\n            <div class="status-icon-wrapper col">\r\n                <span class="new-icon icon" title="New Code"></span>\r\n                <span class="modified-icon icon" title="Revised Code"></span>\r\n            </div>\r\n            <div class="codes-wrapper col">\r\n                <span class="codes">\r\n                <%_.forEach(record.record.codes, function(recordCode, i) { %>\r\n                    <% if (i > 0) { %>, <% } %>\r\n                    <% if (record.sevenCharCode) { %>\r\n                    <a href="javascript:void(0)" class="code invisible full<% if (i === 0) print(\' primary-code default-target\'); %>"><%= recordCode.startcode %></a><a href="javascript:void(0)" class="code trimmed"><%= recordCode.startcode.charAt(recordCode.startcode.length - 1) %></a>\r\n                    <% } else { %>\r\n                    <a href="javascript:void(0)" class="code<% if (i === 0) print(\' primary-code default-target\'); %>"><%= recordCode.startcode %></a>\r\n                    <% } %>\r\n                <% }); %>\r\n                </span>\r\n            </div>\r\n            <div class="icon-wrapper col">\r\n                <span class="cc-icon icon" title="Complication/Comorbid Condition"></span>\r\n                <span class="mcc-icon icon" title="Major Complication/Comorbid Condition"></span>\r\n                <span class="nonor-icon icon" title="Nonoperative procedure"></span>\r\n                <span class="or-icon icon" title="Operative procedure"></span>\r\n            </div>\r\n            <div class="parts-wrapper">\r\n                <span class="parts"><span class="part"><%= record.record.content %></span></span>\r\n            </div>\r\n        </div>\r\n        <% }\r\n        break;\r\n    } %>\r\n    </div>\r\n<% }); %>';});

define('text!controls/codebooks/templates/tabular/cpt.html',[],function () { return '<% var lastRowLength = 0 %>\r\n<% _.each(records, function(record) { %>\r\n    <% if (record.recordType.indexOf(\'table\') === -1) { %>\r\n    <div class="tabular-result tabular-cpt-result type-<%= record.recordType %> level-<%= record.record.level %><% if (record.record.subtypes && record.record.subtypes.length) { _.each(record.record.subtypes, function(st) { print(\' subtype-\' + st.name); }); } %><% if (record.record.hasinstructionalnotes) { print (\' inote\'); } %><% if (record.selectable) { print(\' selectable\'); } %>" id="tabular-<%= record.data_sequence %>" data-book="<%= record.data_book %>" data-sequence="<%= record.data_sequence %>" data-date="<%= record.data_date %>">\r\n    <% } %>\r\n    <% switch (record.recordType) {\r\n        case \'section\':\r\n        case \'sectiontitle\': { %>\r\n        <h1><span><%= record.record.content %></span></h1>\r\n        <% }\r\n        break;\r\n        case \'tabletitle\': { %>\r\n        <h3><span><%= record.record.content %></span></h3>\r\n        <table class="tabular-table tabular-result tabular-cpt-result" id="tabular-<%= record.data_sequence %>" data-book="<%= record.data_book %>" data-sequence="<%= record.data_sequence %>" data-date="<%= record.data_date %>">\r\n        <% }\r\n        break;\r\n        case \'tablehead\': { %>\r\n        <% lastRowLength = record.record.column_content.length %>\r\n        <tr>\r\n            <% _.each(record.record.column_content, function(col) { %>\r\n            <th><%= col %></th>\r\n            <% }); %>\r\n        </tr>\r\n        <% }\r\n        break;\r\n        case \'tableheading\': { %>\r\n        <tr><td class="table-heading" colspan="<%= lastRowLength %>"><%= record.record.content %></td></tr>\r\n        <% }\r\n        break;\r\n        case \'tableoddrow\': { %>\r\n        <tr class="odd">\r\n            <% _.forEach(record.record.column_content, function(col, i) { %>\r\n            <td<% if (i === 0) { if (col.length) { print(\' class="first has-content"\'); } else { print(\' class="first"\'); } } %>><%= col %></td>\r\n            <% }); %>\r\n        </tr>\r\n        <% }\r\n        break;\r\n        case \'tableevenrow\': { %>\r\n        <tr class="even">\r\n            <% _.forEach(record.record.column_content, function(col, i) { %>\r\n            <td<% if (i === 0) { if (col.length) { print(\' class="first has-content"\'); } else { print(\' class="first"\'); } } %>><%= col %></td>\r\n            <% }); %>\r\n        </tr>\r\n        <% }\r\n        break;\r\n        case \'tableend\': { %>\r\n        </table>\r\n        <% }\r\n        break;\r\n        case \'sectionline\':\r\n        case \'orderedlistitem\': { %>\r\n        <span><%= record.record.content %></span>\r\n        <% }\r\n        break;\r\n        case \'codingtiptitle\': { %>\r\n        <h2><span><%= record.record.content %></span></h2>\r\n        <% }\r\n        break;\r\n        case \'codingtipline\': { %>\r\n        <blockquote><%= record.record.content %></blockquote>\r\n        <% }\r\n        break;\r\n        default: { %>\r\n        <div class="icon-wrapper col">\r\n            <a class="inote-icon icon" title="Show Instructional Notes" href="javascript:void(0)"></a>\r\n            <span class="order-icon icon" title="Code is out of numerical sequence"></span>\r\n            <span class="exempt-icon icon" title="Modifier -51 Exempt"></span>\r\n            <span class="cs-icon icon" title="Conscious Sedation"></span>\r\n            <span class="fda-icon icon" title="FDA approval pending"></span>\r\n            <span class="new-icon icon" title="New Code"></span>\r\n            <span class="addon-icon icon" title="Add-On Code"></span>\r\n            <span class="modified-icon icon" title="Revised Code"></span>\r\n        </div>\r\n        <div class="codes-wrapper col">\r\n            <span class="codes"><a href="javascript:void(0)" class="code primary-code default-target"><%= record.record.code %></a></span>\r\n        </div>\r\n        <div class="parts-wrapper">\r\n            <div class="images-wrapper">\r\n            <%_.forEach(record.record.images, function(img, i) { %>\r\n                <a href="javascript:void(0)" class="img-icon icon" data-image-name="<%= img.filename %>" title="<%= img.title %>" data-image-caption="<%= img.caption %>"></a>\r\n            <% }); %>\r\n            </div>\r\n            <span class="parts"><%= record.record.content %></span>\r\n        </div>\r\n        <% }\r\n        break;\r\n    } %>\r\n    <% if (record.recordType.indexOf(\'table\') === -1) { %>\r\n    </div>\r\n    <% } %>\r\n<% }); %>';});

define('text!controls/codebooks/templates/tabular/hcpcs.html',[],function () { return '<% _.each(records, function(record) { %>\r\n    <div class="tabular-result tabular-hcpcs-result type-<%= record.recordType %> level-<%= record.record.level %><% if (record.record.subtypes && record.record.subtypes.length) { _.each(record.record.subtypes, function(st) { print(\' subtype-\' + st.name); }); } %><% if (record.record.hasinstructionalnotes) { print (\' inote\'); } %><% if (record.selectable) { print(\' selectable\'); } %>" id="tabular-<%= record.data_sequence %>" data-book="<%= record.data_book %>" data-sequence="<%= record.data_sequence %>" data-date="<%= record.data_date %>">\r\n    <% switch (record.recordType) {\r\n        case \'section\': { %>\r\n        <h1><%= record.record.content %></h1>\r\n        <% }\r\n        break;\r\n        default: { %>\r\n        <div class="icon-wrapper col padded">\r\n            <span class="new-icon icon" title="New Code"></span>\r\n            <span class="modified-icon icon" title="Revised Code"></span>\r\n        </div>\r\n        <div class="codes-wrapper col">\r\n            <span class="codes"><a href="javascript:void(0)" class="code primary-code default-target"><%= record.record.code %></a></span>\r\n        </div>\r\n        <div class="parts-wrapper">\r\n            <div class="images-wrapper"></div>\r\n            <span class="parts"><%= record.record.content %></span>\r\n        </div>\r\n        <% }\r\n        break;\r\n    } %>\r\n    </div>\r\n<% }); %>';});

define('text!controls/codebooks/templates/tabular/crosswalk.html',[],function () { return '<% _.forEach(data.items, function(item, i) { %>\r\n<div class="tabular-result tabular-crosswalk-result selectable<% if (item.is_best_match === true) { print(\' best\'); } %>" id="tabular-<%= item.id %>" data-book="<%= item.book %>" data-id="<%= item.id %>" title="<%= item.is_best_match === true ? \'Best\' : \'Other\' %> Result">\r\n    <span><%= item.medium_description %></span>\r\n    <span class="code default-target"><%= item.code %></span>\r\n</div>\r\n<% }); %>';});

define('text!controls/codebooks/templates/tabular/pcs-wrapper.html',[],function () { return '<div class="pcs pane-content pane-slim-n pane-slim-s<% if (!hideResearch) { print(\' pane-slim-e\'); } %>">\r\n    <input type="text" class="pcsHelper" style="position:absolute;top:-2000px;right:0;z-index:-100" />\r\n    <div class="pcs-outer">\r\n        <!-- splitter -->\r\n        <div class="pcs-inner">\r\n            <% for (var i = 1; i <= 7; i++) { %>\r\n            <!-- pane -->\r\n            <div class="pcs-pane">\r\n                <!-- splitter -->\r\n                <div class="pcs-column inactive<% if (i === 1) { print(\' extra-action\'); } %>" data-col="<%= i %>">\r\n                    <!-- pane -->\r\n                    <div class="pane-head"></div>\r\n                    <!-- pane -->\r\n                    <div class="pane-body"></div>\r\n                </div>\r\n            </div>\r\n            <% } %>\r\n        </div>\r\n    </div>\r\n</div>\r\n';});

define('text!controls/codebooks/templates/tabular/pcs-column-head.html',[],function () { return '<% switch (colNum) { \r\n    case 1: { %>\r\n    <div class="pcs-column-head first">\r\n        <div><% if (sections.columns) { %><%= sections.columns[0].header %><% } else { %>Section<% } %></div>\r\n    </div>\r\n    <% }\r\n    break;\r\n    case 4: { %>\r\n    <div class="pcs-column-head pivot">\r\n        <div><%= column.header %></div>\r\n        <span class="icon-pivot icon-right-small"></span>\r\n    </div>\r\n    <% }\r\n    break;\r\n    case 7: { %>\r\n    <div class="pcs-column-head last">\r\n        <div><%= column.header %></div>\r\n    </div>\r\n    <% }\r\n    break;\r\n    default: { %>\r\n    <div class="pcs-column-head">\r\n        <div><%= column.header %></div>\r\n    </div>\r\n    <% }\r\n    break;\r\n} %>';});

define('text!controls/codebooks/templates/tabular/pcs-column-choices.html',[],function () { return '<% switch (colNum) { \r\n    case 1: { %>\r\n    <div class="pcs-column-choices first">\r\n        <div>\r\n            <div class="spacer">&nbsp;</div>\r\n    <% if (sections.columns) { %>\r\n        <% _.each(sections.columns[0].choices, function(section) { %>\r\n            <% if (section.label === sectionTitle) { %>\r\n            <div class="item-selected" aria-selected="true">\r\n                <a href="javascript:void(0)"><%= section.char %></a>\r\n                <span><%= section.label %></span>\r\n            </div>\r\n            <% } else { %>\r\n            <div class="not-selected">\r\n                <a href="javascript:void(0)"><%= section.char %></a>\r\n                <span><%= section.label %></span>\r\n            </div>\r\n            <% } %>\r\n        <% }); %>\r\n    <% } else { %>\r\n            <div class="item-selected" aria-selected="true">\r\n                <a href="javascript:void(0)"></a>\r\n                <span><%= sectionTitle %></span>\r\n            </div>\r\n    <% } %>\r\n        </div>\r\n    </div>\r\n    <% }\r\n    break;\r\n    default: { %>\r\n    <div class="pcs-column-choices<% if (colNum === 7) { print(\' last\'); } %>">\r\n        <div>\r\n        <% if (colNum === code.length + 1) { %>\r\n            <div class="spacer item-selected" aria-selected="true">&nbsp;</div>\r\n        <% } else { %>\r\n            <div class="spacer">&nbsp;</div>\r\n        <% } %>\r\n        <% _.each(column.choices, function(choice) { %>\r\n            <% if (choice) { %>\r\n            <div<% if (code[colNum - 1] === choice.char) { print(\' class="item-selected" aria-selected="true"\'); } else { print(\' class="not-selected"\'); } %>>\r\n                <a href="javascript:void(0)"><%= choice.char %></a>\r\n                <span><%= choice.label %></span>\r\n            </div>\r\n            <% } %>\r\n        <% }); %>\r\n        </div>\r\n    </div>\r\n    <% }\r\n    break;\r\n} %>';});

define('text!controls/codebooks/templates/tabular/index.html',[],function () { return '<% _.each(records, function(record) { %>\r\n    <div class="tabular-result tabular-index-result type-<%= record.recordType %> level-<%= record.record.level %><% if (record.record.subtypes && record.record.subtypes.length) { _.each(record.record.subtypes, function(st) { print(\' subtype-\' + st.name); }); } %><% if (record.selectable) { print(\' selectable\'); } %>" id="tabular-<%= record.data_sequence %>" data-book="<%= record.data_book %>" data-sequence="<%= record.data_sequence %>" data-date="<%= record.data_date %>">\r\n    <% switch (record.recordType) {\r\n        case \'letter\': { %>\r\n        <span class="letter"><%= record.record.content %></span>\r\n        <% }\r\n        break;\r\n        case \'tablerowchannelpublishing\':\r\n        case \'tablerow\': { %>\r\n        <div class="table-wrapper <%= record.record.table_row_codes.table %>" data-table-type="<%= record.record.table_row_codes.table %>">\r\n            <div class="text-wrapper padded">\r\n                <span class="cp-icon icon" title="Channel Publishing Expanded ICD-9-CM Table of Drugs and Chemicals"></span>\r\n                <span class="text"><%= record.record.content %></span>\r\n                <span class="short-text hide"><%= (record.record.full_path) ? record.record.full_path.short : \'\' %></span>\r\n            </div>\r\n            <div class="codes table-codes-wrapper">\r\n            <% _.forEach(record.record.table_row_codes.items, function(rowCodeCollection, i) { %>\r\n                <% if (rowCodeCollection != null && rowCodeCollection[0] !== \'-\') { %>\r\n                    <% if (i === 0) { %>\r\n                    <a href="javascript:void(0)" class="code primary-code default-target"><%= rowCodeCollection[rowCodeCollection.length - 1] %></a>\r\n                    <% } else { %>\r\n                    <a href="javascript:void(0)" class="code<% if (rowCodeCollection.length > 1) { print(\' bracketed\'); } else { print(\' primary-code\'); } %>"<% if (rowCodeCollection.length > 1) { %> data-paired-code="<%= rowCodeCollection[0] %>"<% } %>><%= rowCodeCollection[rowCodeCollection.length - 1] %></a>\r\n                    <% } %>\r\n                <% } else { %>\r\n                <span>&mdash;</span>\r\n                <% } %>\r\n            <% }); %>\r\n            </div>\r\n        </div>\r\n        <% }\r\n        break;\r\n        case \'regular\':\r\n        case \'customline\': { %>\r\n        <div class="padded">\r\n            <div class="icon-wrapper col">\r\n                <span class="customline-icon icon" title="TruCode Custom Index Line"></span>\r\n            </div>\r\n            <div class="text-wrapper">\r\n                <span class="text"><%= record.record.content %></span>\r\n                <span class="codes">\r\n                <% if (record.hasCodes) { %>\r\n                <%_.forEach(record.record.regular_row_codes, function(rowCode, i) { %>\r\n                    <% if (i === 0) { %> \r\n                    <a href="javascript:void(0)" class="code primary-code default-target"><%= rowCode %></a>\r\n                    <% } else { %>\r\n                    <strong>[</strong><a href="javascript:void(0)" class="code bracketed"><%= rowCode %></a><strong>]</strong>\r\n                    <% } %>\r\n                <% }); %>\r\n                <% } %>\r\n                </span>\r\n                <span class="short-text hide"><%= (record.record.full_path) ? record.record.full_path.short : \'\' %></span>\r\n            </div>\r\n        </div>\r\n        <% }\r\n        break;\r\n        default: { %>\r\n        <div class="padded">\r\n            <span class="text"><%= record.record.content %></span>\r\n        </div>\r\n        <% }\r\n        break;\r\n    } %>\r\n    </div>\r\n<% }); %>';});

define('text!controls/codebooks/templates/tabular/wrapper.html',[],function () { return '<div class="pane-content pane-slim-s<% if (!hideResearch) { print(\' pane-slim-e\'); } %>">\r\n    <div class="heading-slim">\r\n        <span>Book: <%= book %></span>\r\n    </div>\r\n    <div class="heading-alt">\r\n        <div class="controls control-group">\r\n            <button type="button" class="tabular-back tabular-history disabled k-state-disabled k-button"><span class="k-icon k-i-arrow-w">Back</span></button>\r\n            <button type="button" class="tabular-forward tabular-history disabled k-state-disabled k-button"><span class="k-icon k-i-arrow-e">Forward</span></button>\r\n            <span class="context"></span>\r\n        </div>\r\n    </div>\r\n</div>';});

define('text!controls/codebooks/templates/tableHeadings/drug-ICD9.html',[],function () { return '<div id="column-labels" class="drug">\r\n    <strong>Poisoning</strong>\r\n    <strong>Accident</strong>\r\n    <strong>Therapeutic Use</strong>\r\n    <strong>Suicide Attempt</strong>\r\n    <strong>Assault</strong>\r\n    <strong>Undetermined</strong>\r\n</div>';});

define('text!controls/codebooks/templates/tableHeadings/drug-ICD10.html',[],function () { return '<div id="column-labels" class="drug">\r\n    <strong>Poisoning, Accidental (unintentional)</strong>\r\n    <strong>Poisoning, Intentional Self-Harm</strong>\r\n    <strong>Poisoning, Assault</strong>\r\n    <strong>Poisoning, Undetermined</strong>\r\n    <strong>Adverse Effect</strong>\r\n    <strong>Underdosing</strong>\r\n</div>';});

define('text!controls/codebooks/templates/tableHeadings/hypertension.html',[],function () { return '<div id="column-labels" class="hypertension">\r\n    <strong>Malignant</strong>\r\n    <strong>Benign</strong>\r\n    <strong>Unspecified</strong>\r\n</div>';});

define('text!controls/codebooks/templates/tableHeadings/neoplasm.html',[],function () { return '<div id="column-labels" class="neoplasm">\r\n    <strong>Malignant Primary</strong>\r\n    <strong>Malignant Secondary</strong>\r\n    <strong>Malignant Ca in situ</strong>\r\n    <strong>Benign</strong>\r\n    <strong>Uncertain Behavior</strong>\r\n    <strong>Unspecified</strong>\r\n</div>';});

define('text!controls/codebooks/templates/instructional-note.html',[],function () { return '<div class="codebooks">\r\n    <div class="instructional-note-content tabular-results">\r\n        <%= formatted %>\r\n    </div>\r\n</div>';});

define('text!controls/codebooks/templates/modifiers.html',[],function () { return '<div class="codebooks">\r\n    <div class="modifiers-content">\r\n        <% var currentCategory = \'\'; %>\r\n<% _.each(modifiers, function(modifier) { %>\r\n    <% if (modifier.category !== currentCategory) {\r\n        currentCategory = modifier.category; %>\r\n        <h1 class="category"><%= modifier.category %></h1>\r\n        <% } %>\r\n    <div class="modifier">\r\n        <span class="modifier-code modifier-code-<%= modifier.code %>"><%= modifier.code %></span>\r\n        <p class="modifier-description"><%= modifier.long_description %></p>\r\n        <p class="modifier-note"><%= modifier.note %></p>\r\n    </div>\r\n        <% }); %>\r\n    </div>\r\n</div>';});

define('text!controls/codebooks/templates/tabular/cpt-image-modal.html',[],function () { return '<div class="codebooks">\r\n    <div class="cpt-image-modal">\r\n        <h1 class="image-title"><%= title %></h1>\r\n        <p class="image-caption"><%= caption %></p>\r\n        <p class="image-wrapper">\r\n            <img src="<%= imgPath %>" />\r\n        </p>\r\n    </div>\r\n</div>';});

define('text!controls/common/templates/loading-large.html',[],function () { return '<div class="k-loading-image shrink tc-loading"></div>';});

define('kendoui/kendo.userevents',["kendoui/kendo.jquery","kendoui/kendo.core"],function(e,t){var n=t.support,i=window.document,r=t.Class,o=t.Observable,a=e.now,s=e.extend,c=n.mobileOS,u=c&&c.android,l=n.browser.ie?5:0,h="press",f="select",d="start",p="move",v="end",g="cancel",_="tap",m="release",y="gesturestart",T="gesturechange",x="gestureend",M="gesturetap";function D(e,t){var n=e.x.location,i=e.y.location,r=t.x.location,o=t.y.location,a=n-r,s=i-o;return{center:{x:(n+r)/2,y:(i+o)/2},distance:Math.sqrt(a*a+s*s)}}function E(e){var t=[],i=e.originalEvent,r=e.currentTarget,o=0,a,s,c;if(e.api){t.push({id:2,event:e,target:e.target,currentTarget:e.target,location:e})}else if(e.type.match(/touch/)){s=i?i.changedTouches:[];for(a=s.length;o<a;o++){c=s[o];t.push({location:c,event:e,target:c.target,currentTarget:r,id:c.identifier})}}else if(n.pointers||n.msPointers){t.push({location:i,event:e,target:e.target,currentTarget:r,id:i.pointerId})}else{t.push({id:1,event:e,target:e.target,currentTarget:r,location:e})}return t}var w=r.extend({init:function(e,t){var n=this;n.axis=e;n._updateLocationData(t);n.startLocation=n.location;n.velocity=n.delta=0;n.timeStamp=a()},move:function(e){var t=this,n=e["page"+t.axis],i=a(),r=i-t.timeStamp||1;if(!n&&u){return}t.delta=n-t.location;t._updateLocationData(e);t.initialDelta=n-t.startLocation;t.velocity=t.delta/r;t.timeStamp=i},_updateLocationData:function(e){var t=this,n=t.axis;t.location=e["page"+n];t.client=e["client"+n];t.screen=e["screen"+n]}});var b=r.extend({init:function(e,t,n){var i=this;s(i,{x:new w("X",n.location),y:new w("Y",n.location),userEvents:e,target:t,currentTarget:n.currentTarget,initialTouch:n.target,id:n.id,_moved:false,_finished:false});i.notifyInit=function(){i._trigger(h,n)}},move:function(e){var t=this;if(t._finished){return}t.x.move(e.location);t.y.move(e.location);if(!t._moved){if(t._withinIgnoreThreshold()){return}if(!S.current||S.current===t.userEvents){t._start(e)}else{return t.dispose()}}if(!t._finished){t._trigger(p,e)}},end:function(e){var t=this;t.endTime=a();if(t._finished){return}if(t._moved){t._trigger(v,e)}else{t._trigger(_,e)}t._trigger(m,e);t.dispose()},dispose:function(){var t=this,n=t.userEvents,i=n.touches;t._finished=true;i.splice(e.inArray(t,i),1)},skip:function(){this.dispose()},cancel:function(){this.dispose()},isMoved:function(){return this._moved},_start:function(e){this.startTime=a();this._moved=true;this._trigger(d,e)},_trigger:function(e,t){var n=this,i=t.event,r={touch:n,x:n.x,y:n.y,target:n.target,event:i};if(n.userEvents.notify(e,r)){i.preventDefault()}},_withinIgnoreThreshold:function(){var e=this.x.initialDelta,t=this.y.initialDelta;return Math.sqrt(e*e+t*t)<=this.userEvents.threshold}});function k(t){t.preventDefault();var n=e(t.data.root),i=n.closest(".k-widget").parent();if(!i[0]){i=n.parent()}var r=e.extend(true,{},t,{target:n[0]});i.trigger(e.Event(t.type,r))}function I(e){var n=t.eventMap.up.split(" "),i=0,r=n.length;for(;i<r;i++){e(n[i])}}var S=o.extend({init:function(r,a){var c=this,u,D=t.guid();a=a||{};u=c.filter=a.filter;c.threshold=a.threshold||l;c.touches=[];c._maxTouches=a.multiTouch?2:1;c.allowSelection=a.allowSelection;c.captureUpIfMoved=a.captureUpIfMoved;c.eventNS=D;r=e(r).handler(c);o.fn.init.call(c);s(c,{element:r,surface:a.global?e(i.documentElement):e(a.surface||r),stopPropagation:a.stopPropagation,pressed:false});c.surface.handler(c).on(t.applyEventMap("move",D),"_move").on(t.applyEventMap("up cancel",D),"_end");r.on(t.applyEventMap("down",D),u,"_start");if(n.pointers||n.msPointers){r.css("-ms-touch-action","pinch-zoom double-tap-zoom")}if(a.preventDragEvent){r.on(t.applyEventMap("dragstart",D),t.preventDefault)}r.on(t.applyEventMap("mousedown selectstart",D),u,{root:r},"_select");if(c.captureUpIfMoved&&n.eventCapture){var E=c.surface[0],w=e.proxy(c.preventIfMoving,c);I(function(e){E.addEventListener(e,w,true)})}c.bind([h,_,d,p,v,m,g,y,T,x,M,f],a)},preventIfMoving:function(e){if(this._isMoved()){e.preventDefault()}},destroy:function(){var e=this;if(e._destroyed){return}e._destroyed=true;if(e.captureUpIfMoved&&n.eventCapture){var t=e.surface[0];I(function(n){t.removeEventListener(n,e.preventIfMoving)})}e.element.kendoDestroy(e.eventNS);e.surface.kendoDestroy(e.eventNS);e.element.removeData("handler");e.surface.removeData("handler");e._disposeAll();e.unbind();delete e.surface;delete e.element},capture:function(){S.current=this},cancel:function(){this._disposeAll();this.trigger(g)},notify:function(e,t){var n=this,i=n.touches;if(this._isMultiTouch()){switch(e){case p:e=T;break;case v:e=x;break;case _:e=M;break}s(t,{touches:i},D(i[0],i[1]))}return this.trigger(e,t)},press:function(e,t,n){this._apiCall("_start",e,t,n)},move:function(e,t){this._apiCall("_move",e,t)},end:function(e,t){this._apiCall("_end",e,t)},_isMultiTouch:function(){return this.touches.length>1},_maxTouchesReached:function(){return this.touches.length>=this._maxTouches},_disposeAll:function(){e.each(this.touches,function(){this.dispose()})},_isMoved:function(){return e.grep(this.touches,function(e){return e.isMoved()}).length},_select:function(e){if(!this.allowSelection||this.trigger(f,{event:e})){k(e)}},_start:function(t){var n=this,i=0,r=n.filter,o,a=E(t),s=a.length,c;if(n._maxTouchesReached()){return}S.current=null;n.currentTarget=t.currentTarget;if(n.stopPropagation){t.stopPropagation()}for(;i<s;i++){if(n._maxTouchesReached()){break}c=a[i];if(r){o=e(c.currentTarget)}else{o=n.element}if(!o.length){continue}c=new b(n,o,c);n.touches.push(c);c.notifyInit();if(n._isMultiTouch()){n.notify("gesturestart",{})}}},_move:function(e){this._eachTouch("move",e)},_end:function(e){this._eachTouch("end",e)},_eachTouch:function(e,t){var n=this,i={},r=E(t),o=n.touches,a,s,c,u;for(a=0;a<o.length;a++){s=o[a];i[s.id]=s}for(a=0;a<r.length;a++){c=r[a];u=i[c.id];if(u){u[e](c)}}},_apiCall:function(t,n,i,r){this[t]({api:true,pageX:n,pageY:i,target:r||this.element,stopPropagation:e.noop,preventDefault:e.noop})}});t.getTouches=E;t.touchDelta=D;t.UserEvents=S});
define('kendoui/kendo.draganddrop',["kendoui/kendo.jquery","kendoui/kendo.core","kendoui/kendo.userevents"],function(e,t){var n=t.support,i=window.document,r=t.Class,a=t.ui.Widget,s=t.Observable,o=t.UserEvents,l=e.proxy,u=e.extend,f=t.getOffset,c={},d={},h={},g,p=n.mobileOS,v=p&&p.android,m=v&&p.browser=="chrome",x="keyup",_="change",y="dragstart",b="drag",T="dragend",E="dragcancel",M="dragenter",S="dragleave",w="drop";function O(t,n){try{return e.contains(t,n)||t==n}catch(i){return false}}function D(e){if(m){return i.elementFromPoint(e.x.screen,e.y.screen)}else{return i.elementFromPoint(e.x.client,e.y.client)}}function k(e,t){return parseInt(e.css(t),10)||0}function z(e,t){return Math.min(Math.max(e,t.min),t.max)}function C(e,t){var n=f(e),i=n.left+k(e,"borderLeftWidth")+k(e,"paddingLeft"),r=n.top+k(e,"borderTopWidth")+k(e,"paddingTop"),a=i+e.width()-t.outerWidth(true),s=r+e.height()-t.outerHeight(true);return{x:{min:i,max:a},y:{min:r,max:s}}}function W(e,t,i){var r,a,s=0,o=t&&t.length,l=i&&i.length;while(e&&e.parentNode){for(s=0;s<o;s++){r=t[s];if(r.element[0]===e){return{target:r,targetElement:e}}}for(s=0;s<l;s++){a=i[s];if(n.matchesSelector.call(e,a.options.filter)){return{target:a,targetElement:e}}}e=e.parentNode}return undefined}var H=s.extend({init:function(n,i){var r=this,a=n[0];r.capture=false;e.each(t.eventMap.down.split(" "),function(){a.addEventListener(this,l(r._press,r),true)});e.each(t.eventMap.up.split(" "),function(){a.addEventListener(this,l(r._release,r),true)});s.fn.init.call(r);r.bind(["press","release"],i||{})},captureNext:function(){this.capture=true},cancelCapture:function(){this.capture=false},_press:function(e){var t=this;t.trigger("press");if(t.capture){e.preventDefault()}},_release:function(e){var t=this;t.trigger("release");if(t.capture){e.preventDefault();t.cancelCapture()}}});var P=s.extend({init:function(t){var n=this;s.fn.init.call(n);n.forcedEnabled=false;e.extend(n,t);n.scale=1;if(n.horizontal){n.measure="offsetWidth";n.scrollSize="scrollWidth";n.axis="x"}else{n.measure="offsetHeight";n.scrollSize="scrollHeight";n.axis="y"}},makeVirtual:function(){e.extend(this,{virtual:true,forcedEnabled:true,_virtualMin:1e3,_virtualMax:-1e3})},virtualSize:function(e,t){if(this._virtualMin!==e||this._virtualMax!==t){this._virtualMin=e;this._virtualMax=t;this.update()}},outOfBounds:function(e){return e>this.max||e<this.min},forceEnabled:function(){this.forcedEnabled=true},getSize:function(){return this.container[0][this.measure]},getTotal:function(){return this.element[0][this.scrollSize]},rescale:function(e){this.scale=e},update:function(e){var t=this,n=t.virtual?t._virtualMax:t.getTotal(),i=n*t.scale,r=t.getSize();t.max=t.virtual?-t._virtualMin:0;t.size=r;t.total=i;t.min=Math.min(t.max,r-i);t.minScale=r/n;t.centerOffset=(i-r)/2;t.enabled=t.forcedEnabled||i>r;if(!e){t.trigger(_,t)}}});var A=s.extend({init:function(e){var n=this,i=l(n.refresh,n);s.fn.init.call(n);n.x=new P(u({horizontal:true},e));n.y=new P(u({horizontal:false},e));n.forcedMinScale=e.minScale;n.bind(_,e);t.onResize(i)},rescale:function(e){this.x.rescale(e);this.y.rescale(e);this.refresh()},centerCoordinates:function(){return{x:Math.min(0,-this.x.centerOffset),y:Math.min(0,-this.y.centerOffset)}},refresh:function(){var e=this;e.x.update();e.y.update();e.enabled=e.x.enabled||e.y.enabled;e.minScale=e.forcedMinScale||Math.min(e.x.minScale,e.y.minScale);e.fitScale=Math.max(e.x.minScale,e.y.minScale);e.trigger(_)}});var L=s.extend({init:function(e){var t=this;u(t,e);s.fn.init.call(t)},dragMove:function(e){var t=this,n=t.dimension,i=t.axis,r=t.movable,a=r[i]+e;if(!n.enabled){return}if(a<n.min&&e<0||a>n.max&&e>0){e*=t.resistance}r.translateAxis(i,e);t.trigger(_,t)}});var N=r.extend({init:function(e){var t=this,n,i,r,a;u(t,{elastic:true},e);r=t.elastic?.5:0;a=t.movable;t.x=n=new L({axis:"x",dimension:t.dimensions.x,resistance:r,movable:a});t.y=i=new L({axis:"y",dimension:t.dimensions.y,resistance:r,movable:a});t.userEvents.bind(["move","end","gesturestart","gesturechange"],{gesturestart:function(e){t.gesture=e},gesturechange:function(e){var r=t.gesture,s=r.center,o=e.center,l=e.distance/r.distance,u=t.dimensions.minScale,f;if(a.scale<=u&&l<1){l+=(1-l)*.8}f={x:(a.x-s.x)*l+o.x-a.x,y:(a.y-s.y)*l+o.y-a.y};a.scaleWith(l);n.dragMove(f.x);i.dragMove(f.y);t.dimensions.rescale(a.scale);t.gesture=e;e.preventDefault()},move:function(e){if(e.event.target.tagName.match(/textarea|input/i)){return}if(n.dimension.enabled||i.dimension.enabled){n.dragMove(e.x.delta);i.dragMove(e.y.delta);e.preventDefault()}else{e.touch.skip()}},end:function(e){e.preventDefault()}})}});var F=n.transitions.prefix+"Transform",B;if(n.hasHW3D){B=function(e,t,n){return"translate3d("+e+"px,"+t+"px,0) scale("+n+")"}}else{B=function(e,t,n){return"translate("+e+"px,"+t+"px) scale("+n+")"}}var G=s.extend({init:function(t){var n=this;s.fn.init.call(n);n.element=e(t);n.element[0].style.webkitTransformOrigin="left top";n.x=0;n.y=0;n.scale=1;n._saveCoordinates(B(n.x,n.y,n.scale))},translateAxis:function(e,t){this[e]+=t;this.refresh()},scaleTo:function(e){this.scale=e;this.refresh()},scaleWith:function(e){this.scale*=e;this.refresh()},translate:function(e){this.x+=e.x;this.y+=e.y;this.refresh()},moveAxis:function(e,t){this[e]=t;this.refresh()},moveTo:function(e){u(this,e);this.refresh()},refresh:function(){var e=this,t=B(e.x,e.y,e.scale);if(t!=e.coordinates){e.element[0].style[F]=t;e._saveCoordinates(t);e.trigger(_)}},_saveCoordinates:function(e){this.coordinates=e}});var I=a.extend({init:function(e,t){var n=this;a.fn.init.call(n,e,t);var i=n.options.group;if(!(i in d)){d[i]=[n]}else{d[i].push(n)}},events:[M,S,w],options:{name:"DropTarget",group:"default"},destroy:function(){var e=this.options.group,t=d[e]||h[e],n;if(t.length>1){a.fn.destroy.call(this);for(n=0;n<t.length;n++){if(t[n]==this){t.splice(n,1);break}}}else{I.destroyGroup(e)}},_trigger:function(e,t){var n=this,i=c[n.options.group];if(i){return n.trigger(e,u({},t.event,{draggable:i,dropTarget:t.dropTarget}))}},_over:function(e){this._trigger(M,e)},_out:function(e){this._trigger(S,e)},_drop:function(e){var t=this,n=c[t.options.group];if(n){n.dropped=!t._trigger(w,e)}}});I.destroyGroup=function(e){var t=d[e]||h[e],n;if(t){for(n=0;n<t.length;n++){a.fn.destroy.call(t[n])}t.length=0;delete d[e];delete h[e]}};I._cache=d;var j=I.extend({init:function(e,t){var n=this;a.fn.init.call(n,e,t);var i=n.options.group;if(!(i in h)){h[i]=[n]}else{h[i].push(n)}},options:{name:"DropTargetArea",group:"default",filter:null}});var q=a.extend({init:function(e,n){var i=this;a.fn.init.call(i,e,n);i.userEvents=new o(i.element,{global:true,stopPropagation:true,filter:i.options.filter,threshold:i.options.distance,start:l(i._start,i),move:l(i._drag,i),end:l(i._end,i),cancel:l(i._cancel,i)});i._afterEndHandler=l(i._afterEnd,i);i.captureEscape=function(e){if(e.keyCode===t.keys.ESC){i._trigger(E,{event:e});i.userEvents.cancel()}}},events:[y,b,T,E],options:{name:"Draggable",distance:5,group:"default",cursorOffset:null,axis:null,container:null,dropped:false},_updateHint:function(t){var n=this,i,r=n.options,a=n.boundaries,s=r.axis,o=n.options.cursorOffset;if(o){i={left:t.x.location+o.left,top:t.y.location+o.top}}else{n.hintOffset.left+=t.x.delta;n.hintOffset.top+=t.y.delta;i=e.extend({},n.hintOffset)}if(a){i.top=z(i.top,a.y);i.left=z(i.left,a.x)}if(s==="x"){delete i.top}else if(s==="y"){delete i.left}n.hint.css(i)},_start:function(t){var n=this,r=n.options,a=r.container,s=r.hint;n.currentTarget=t.target;n.currentTargetOffset=f(n.currentTarget);if(s){if(n.hint){n.hint.stop(true,true).remove()}n.hint=e.isFunction(s)?e(s.call(n,n.currentTarget)):s;var o=f(n.currentTarget);n.hintOffset=o;n.hint.css({position:"absolute",zIndex:2e4,left:o.left,top:o.top}).appendTo(i.body)}c[r.group]=n;n.dropped=false;if(a){n.boundaries=C(a,n.hint)}if(n._trigger(y,t)){n.userEvents.cancel();n._afterEnd()}e(i).on(x,n.captureEscape)},_drag:function(t){var n=this;t.preventDefault();n._withDropTarget(t,function(n,i){if(!n){if(g){g._trigger(S,u(t,{dropTarget:e(g.targetElement)}));g=null}return}if(g){if(i===g.targetElement){return}g._trigger(S,u(t,{dropTarget:e(g.targetElement)}))}n._trigger(M,u(t,{dropTarget:e(i)}));g=u(n,{targetElement:i})});n._trigger(b,t);if(n.hint){n._updateHint(t)}},_end:function(t){var n=this;n._withDropTarget(t,function(n,i){if(n){n._drop(u({},t,{dropTarget:e(i)}));g=null}});n._trigger(T,t);n._cancel(t.event)},_cancel:function(){var e=this;if(e.hint&&!e.dropped){setTimeout(function(){e.hint.stop(true,true).animate(e.currentTargetOffset,"fast",e._afterEndHandler)},0)}else{e._afterEnd()}},_trigger:function(e,t){var n=this;return n.trigger(e,u({},t.event,{x:t.x,y:t.y,currentTarget:n.currentTarget,dropTarget:t.dropTarget}))},_withDropTarget:function(e,t){var n=this,i,r,a=n.options,s=d[a.group],o=h[a.group];if(s&&s.length||o&&o.length){i=D(e);if(n.hint&&O(n.hint[0],i)){n.hint.hide();i=D(e);if(!i){i=D(e)}n.hint.show()}r=W(i,s,o);if(r){t(r.target,r.targetElement)}else{t()}}},destroy:function(){var e=this;a.fn.destroy.call(e);e._afterEnd();e.userEvents.destroy()},_afterEnd:function(){var t=this;if(t.hint){t.hint.remove()}delete c[t.options.group];t.trigger("destroy");e(i).off(x,t.captureEscape)}});t.ui.plugin(I);t.ui.plugin(j);t.ui.plugin(q);t.TapCapture=H;t.containerBoundaries=C;u(t.ui,{Pane:N,PaneDimensions:A,Movable:G})});
define('kendoui/kendo.resizable',["kendoui/kendo.jquery","kendoui/kendo.core","kendoui/kendo.draganddrop","kendoui/kendo.userevents"],function(i,n){var t=n.ui,o=t.Widget,e=i.proxy,s=i.isFunction,r=i.extend,a="horizontal",d="vertical",u="start",l="resize",c="resizeend";var p=o.extend({init:function(i,n){var s=this;o.fn.init.call(s,i,n);s.orientation=s.options.orientation.toLowerCase()!=d?a:d;s._positionMouse=s.orientation==a?"x":"y";s._position=s.orientation==a?"left":"top";s._sizingDom=s.orientation==a?"outerWidth":"outerHeight";s.draggable=new t.Draggable(i,{distance:0,filter:n.handle,drag:e(s._resize,s),dragcancel:e(s._cancel,s),dragstart:e(s._start,s),dragend:e(s._stop,s)});s.userEvents=s.draggable.userEvents},events:[l,c,u],options:{name:"Resizable",orientation:a},_max:function(i){var n=this,t=n.hint?n.hint[n._sizingDom]():0,o=n.options.max;return s(o)?o(i):o!==undefined?n._initialElementPosition+o-t:o},_min:function(i){var n=this,t=n.options.min;return s(t)?t(i):t!==undefined?n._initialElementPosition+t:t},_start:function(n){var t=this,o=t.options.hint,e=i(n.currentTarget);t._initialElementPosition=e.position()[t._position];t._initialMousePosition=n[t._positionMouse].startLocation;if(o){t.hint=s(o)?i(o(e)):o;t.hint.css({position:"absolute"}).css(t._position,t._initialElementPosition).appendTo(t.element)}t.trigger(u,n);t._maxPosition=t._max(n);t._minPosition=t._min(n);i(document.body).css("cursor",e.css("cursor"))},_resize:function(n){var t=this,o=i(n.currentTarget),e=t._maxPosition,s=t._minPosition,a=t._initialElementPosition+(n[t._positionMouse].location-t._initialMousePosition),d;d=s!==undefined?Math.max(s,a):a;t.position=d=e!==undefined?Math.min(e,d):d;if(t.hint){t.hint.toggleClass(t.options.invalidClass||"",d==e||d==s).css(t._position,d)}t.resizing=true;t.trigger(l,r(n,{position:d}))},_stop:function(n){var t=this;if(t.hint){t.hint.remove()}t.resizing=false;t.trigger(c,r(n,{position:t.position}));i(document.body).css("cursor","")},_cancel:function(i){var n=this;if(n.hint){n.position=undefined;n.hint.css(n._position,n._initialElementPosition);n._stop(i)}},destroy:function(){var i=this;o.fn.destroy.call(i);if(i.draggable){i.draggable.destroy()}},press:function(i){if(!i){return}var n=i.position(),t=this;t.userEvents.press(n.left,n.top,i[0]);t.targetPosition=n;t.target=i},move:function(i){var n=this,t=n._position,o=n.targetPosition,e=n.position;if(e===undefined){e=o[t]}o[t]=e+i;n.userEvents.move(o.left,o.top)},end:function(){this.userEvents.end();this.target=this.position=undefined}});n.ui.plugin(p)});
define('kendoui/kendo.window',["kendoui/kendo.jquery","kendoui/kendo.core","kendoui/kendo.userevents","kendoui/kendo.draganddrop","kendoui/kendo.resizable","kendoui/kendo.fx"],function(i,e){var t=e.ui.Widget,n=e.ui.Draggable,o=i.isPlainObject,r=e._activeElement,s=i.proxy,a=i.extend,d=i.each,l=e.template,f="body",c,p=".kendoWindow",h=".k-window",u=".k-window-title",g=u+"bar",m=".k-window-content",w=".k-resize-handle",v=".k-overlay",k="k-content-frame",y="k-loading",z="k-state-hover",x="k-state-focused",_=":visible",b="hidden",T="cursor",M="open",W="activate",H="deactivate",O="close",I="refresh",C="resize",S="dragstart",P="dragend",F="error",D="overflow",L="zIndex",j=".k-window-actions .k-i-minimize,.k-window-actions .k-i-maximize",R=".k-i-pin",A=".k-i-unpin",E=R+","+A,q=".k-window-titlebar .k-window-action",N=e.isLocalUrl;function G(i){return typeof i!="undefined"}function U(i,e,t){return Math.max(Math.min(parseInt(i,10),t===Infinity?t:parseInt(t,10)),parseInt(e,10))}function K(i,e){return function(){var t=this,n=t.wrapper,o=n[0].style,r=t.options;if(r.isMaximized||r.isMinimized){return}t.restoreOptions={width:o.width,height:o.height};n.find(w).hide().end().find(j).parent().hide().eq(0).before(c.action({name:"Restore"}));e.call(t);if(i=="maximize"){t.wrapper.find(g).find(E).parent().hide()}else{t.wrapper.find(g).find(E).parent().show()}return t}}var V=t.extend({init:function(n,r){var a=this,d,l={},f,c,w=false,v,k,y=r&&r.actions&&!r.actions.length,T;t.fn.init.call(a,n,r);r=a.options;n=a.element;v=r.content;if(y){r.actions=[]}a.appendTo=i(i(r.appendTo)[0]||document.body);a._animations();if(v&&!o(v)){v=r.content={url:v}}n.find("script").filter(function(){return!this.type||this.type.toLowerCase().indexOf("script")>=0}).remove();if(!n.parent().is(a.appendTo)&&(r.position.top===undefined||r.position.left===undefined)){if(n.is(_)){l=n.offset();w=true}else{f=n.css("visibility");c=n.css("display");n.css({visibility:b,display:""});l=n.offset();n.css({visibility:f,display:c})}}if(!G(r.visible)||r.visible===null){r.visible=n.is(_)}d=a.wrapper=n.closest(h);if(!n.is(".k-content")||!d[0]){n.addClass("k-window-content k-content");a._createWindow(n,r);d=a.wrapper=n.closest(h);a._dimensions()}d.css({top:r.position.top||l.top||"",left:r.position.left||l.left||""});if(r.pinned){a.pin(true)}if(v){a.refresh(v)}if(r.visible){a.toFront()}k=d.children(m);a._tabindex(k);if(r.visible&&r.modal){a._overlay(d.is(_)).css({opacity:.5})}d.on("mouseenter"+p,q,function(){i(this).addClass(z)}).on("mouseleave"+p,q,function(){i(this).removeClass(z)}).on("click"+p,q,s(a._windowActionHandler,a));k.on("keydown"+p,s(a._keydown,a)).on("focus"+p,function(){d.addClass(x)}).on("blur"+p,function(){d.removeClass(x)});this._resizable();this._draggable();T=n.attr("id");if(T){T=T+"_wnd_title";d.find(g).children(u).attr("id",T);k.attr({role:"dialog","aria-labelledby":T})}d.add(d.find(".k-resize-handle,.k-window-titlebar")).on("mousedown"+p,s(a.toFront,a));a.touchScroller=e.touchScroller(n);a._resizeHandler=function(i){return a._onDocumentResize(i)};i(window).on("resize",a._resizeHandler);if(r.visible){a.trigger(M);a.trigger(W)}e.notify(a)},_dimensions:function(){var i=this,e=i.wrapper,t=i.options,n=t.width,o=t.height,r=t.maxHeight;i.title(t.title);d(["minWidth","minHeight","maxWidth","maxHeight"],function(i,n){var o=t[n];if(o&&o!=Infinity){e.css(n,o)}});if(r&&r!=Infinity){i.element.css("maxHeight",r)}if(n){if(n.toString().indexOf("%")>0){e.width(n)}else{e.width(U(n,t.minWidth,t.maxWidth))}}if(o){if(o.toString().indexOf("%")>0){e.height(o)}else{e.height(U(o,t.minHeight,t.maxHeight))}}if(!t.visible){e.hide()}},_animations:function(){var i=this.options;if(i.animation===false){i.animation={open:{effects:{}},close:{hide:true,effects:{}}}}},_resizable:function(){var e=this.options.resizable;var t=this.wrapper;if(e){t.on("dblclick"+p,g,s(function(e){if(!i(e.target).closest(".k-window-action").length){this.toggleMaximization()}},this));d("n e s w se sw ne nw".split(" "),function(i,e){t.append(c.resizeHandle(e))});this.resizing=new B(this)}else if(this.resizing){t.off("dblclick"+p).find(w).remove();this.resizing.destroy();this.resizing=null}},_draggable:function(){var i=this.options.draggable;if(i){this.dragging=new J(this,i.dragHandle||g)}else if(this.dragging){this.dragging.destroy();this.dragging=null}},setOptions:function(i){t.fn.setOptions.call(this,i);this._animations();this._dimensions();this._resizable();this._draggable()},events:[M,W,H,O,I,C,S,P,F],options:{name:"Window",animation:{open:{effects:{zoom:{direction:"in"},fade:{direction:"in"}},duration:350},close:{effects:{zoom:{direction:"out",properties:{scale:.7}},fade:{direction:"out"}},duration:350,hide:true}},title:"",actions:["Close"],autoFocus:true,modal:false,resizable:true,draggable:true,minWidth:90,minHeight:50,maxWidth:Infinity,maxHeight:Infinity,pinned:false,position:{},content:null,visible:null,height:null,width:null},_closable:function(){return i.inArray("close",i.map(this.options.actions,function(i){return i.toLowerCase()}))>-1},_keydown:function(i){var t=this,n=t.options,o=e.keys,r=i.keyCode,s=t.wrapper,a,d,l=10,f=t.options.isMaximized,c,p;if(i.target!=i.currentTarget||t._closing){return}if(r==o.ESC&&t._closable()){t._close(true)}if(n.draggable&&!i.ctrlKey&&!f){a=e.getOffset(s);if(r==o.UP){d=s.css("top",a.top-l)}else if(r==o.DOWN){d=s.css("top",a.top+l)}else if(r==o.LEFT){d=s.css("left",a.left-l)}else if(r==o.RIGHT){d=s.css("left",a.left+l)}}if(n.resizable&&i.ctrlKey&&!f){if(r==o.UP){d=true;p=s.height()-l}else if(r==o.DOWN){d=true;p=s.height()+l}if(r==o.LEFT){d=true;c=s.width()-l}else if(r==o.RIGHT){d=true;c=s.width()+l}if(d){s.css({width:U(c,n.minWidth,n.maxWidth),height:U(p,n.minHeight,n.maxHeight)});t.trigger(C)}}if(d){i.preventDefault()}},_overlay:function(e){var t=this.appendTo.children(v),n=this.wrapper;if(!t.length){t=i("<div class='k-overlay' />")}t.insertBefore(n[0]).toggle(e).css(L,parseInt(n.css(L),10)-1);return t},_windowActionHandler:function(e){var t=i(e.target).closest(".k-window-action").find(".k-icon"),n=this;if(n._closing){return}d({"k-i-close":function(){n._close(true)},"k-i-maximize":n.maximize,"k-i-minimize":n.minimize,"k-i-restore":n.restore,"k-i-refresh":n.refresh,"k-i-pin":n.pin,"k-i-unpin":n.unpin},function(i,o){if(t.hasClass(i)){e.preventDefault();o.call(n);return false}})},_modals:function(){var e=this;return i(h).filter(function(){var t=i(this);var n=e._object(t).options;return n.modal&&n.visible&&t.is(_)}).sort(function(e,t){return+i(e).css("zIndex")-+i(t).css("zIndex")})},_object:function(i){var e=i.children(m);return e.data("kendoWindow")||e.data("kendo"+this.options.name)},center:function(){var e=this,t=e.wrapper,n=i(window);if(e.options.isMaximized){return e}t.css({left:n.scrollLeft()+Math.max(0,(n.width()-t.width())/2),top:n.scrollTop()+Math.max(0,(n.height()-t.height())/2)});return e},title:function(i){var e=this,t=e.wrapper,n=e.options,o=t.find(g),r=o.children(u),s=o.outerHeight();if(!arguments.length){return r.text()}if(i===false){t.addClass("k-window-titleless");o.remove()}else{if(!o.length){t.prepend(c.titlebar(a(c,n)))}t.css("padding-top",s);o.css("margin-top",-s)}r.text(i);return e},content:function(i){var t=this.wrapper.children(m),n=t.children(".km-scroll-container");t=n[0]?n:t;if(!i){return t.html()}e.destroy(this.element.children());t.html(i);return this},open:function(){var t=this,n=t.wrapper,o=t.options,r=o.animation.open,s=n.children(m),a=s.css(D),d;if(!t.trigger(M)){if(t._closing){n.kendoStop(true,true)}t._closing=false;t.toFront();if(o.autoFocus){t.element.focus()}o.visible=true;if(o.modal){d=t._overlay(false);d.kendoStop(true,true);if(r.duration&&e.effects.Fade){var l=e.fx(d).fadeIn();l.duration(r.duration||0);l.endValue(.5);l.play()}else{d.css("opacity",.5)}d.show()}if(!n.is(_)){s.css(D,b);n.show().kendoStop().kendoAnimate({effects:r.effects,duration:r.duration,complete:function(){if(o.autoFocus){t.element.focus()}t.trigger(W);s.css(D,a)}})}}if(o.isMaximized){t._documentScrollTop=i(document).scrollTop();i("html, body").css(D,b)}return t},_removeOverlay:function(t){var n=this._modals();var o=this.options;var r=o.modal&&!n.length;var s=o.modal?this._overlay(true):i(undefined);var a=o.animation.close;if(r){if(!t&&a.duration&&e.effects.Fade){var d=e.fx(s).fadeOut();d.duration(a.duration||0);d.startValue(.5);d.play()}else{this._overlay(false).remove()}}else if(n.length){this._object(n.last())._overlay(true)}},_close:function(e){var t=this,n=t.wrapper,o=t.options,r=o.animation.open,s=o.animation.close;if(n.is(_)&&!t.trigger(O,{userTriggered:!!e})){t._closing=true;o.visible=false;i(h).each(function(e,t){var o=i(t).find(m);if(t!=n&&o.find("> ."+k).length>0){o.children(v).remove()}});this._removeOverlay();n.kendoStop().kendoAnimate({effects:s.effects||r.effects,reverse:s.reverse===true,duration:s.duration,complete:function(){n.hide().css("opacity","");t.trigger(H);var i=t._object(t._modals().last());if(i){i.toFront()}}})}if(t.options.isMaximized){i("html, body").css(D,"");if(t._documentScrollTop&&t._documentScrollTop>0){i(document).scrollTop(t._documentScrollTop)}}},close:function(){this._close(false);return this},toFront:function(e){var t=this,n=t.wrapper,o=n[0],s=+n.css(L),a=s,d=r(),l=t.element,f=e&&e.target?e.target:null;i(h).each(function(e,t){var n=i(t),r=n.css(L),a=n.find(m);if(!isNaN(r)){s=Math.max(+r,s)}if(t!=o&&a.find("> ."+k).length>0){a.append(c.overlay)}});if(!n[0].style.zIndex||a<s){n.css(L,s+2)}t.element.find("> .k-overlay").remove();if(t.options.autoFocus&&!i(d).is(l)&&!i(f).is(q+","+q+" .k-icon,:input,a")&&(!l.find(d).length||!l.find(f).length)){l.focus();var p=i(window).scrollTop(),u=parseInt(t.wrapper.position().top,10);if(u>0&&u-p<0){if(p>0){i(window).scrollTop(u)}else{t.wrapper.css("top",p)}}}return t},toggleMaximization:function(){if(this._closing){return this}return this[this.options.isMaximized?"restore":"maximize"]()},restore:function(){var e=this;var t=e.options;var n=t.minHeight;var o=e.restoreOptions;if(!t.isMaximized&&!t.isMinimized){return}if(n&&n!=Infinity){e.wrapper.css("min-height",n)}e.wrapper.css({position:t.pinned?"fixed":"absolute",left:o.left,top:o.top,width:o.width,height:o.height}).find(".k-window-content,.k-resize-handle").show().end().find(".k-window-titlebar .k-i-restore").parent().remove().end().end().find(j).parent().show().end().end().find(E).parent().show();i("html, body").css(D,"");if(this._documentScrollTop&&this._documentScrollTop>0){i(document).scrollTop(this._documentScrollTop)}t.isMaximized=t.isMinimized=false;e.trigger(C);return e},maximize:K("maximize",function(){var e=this,t=e.wrapper,n=t.position();a(e.restoreOptions,{left:n.left,top:n.top});t.css({left:0,top:0,position:"fixed"});this._documentScrollTop=i(document).scrollTop();i("html, body").css(D,b);e.options.isMaximized=true;e._onDocumentResize()}),minimize:K("minimize",function(){var i=this;i.wrapper.css({height:"",minHeight:""});i.element.hide();i.options.isMinimized=true}),pin:function(e){var t=this,n=i(window),o=t.wrapper,r=parseInt(o.css("top"),10),s=parseInt(o.css("left"),10);if(e||!t.options.pinned&&!t.options.isMaximized){o.css({position:"fixed",top:r-n.scrollTop(),left:s-n.scrollLeft()});o.find(g).find(R).addClass("k-i-unpin").removeClass("k-i-pin");t.options.pinned=true}},unpin:function(){var e=this,t=i(window),n=e.wrapper,o=parseInt(n.css("top"),10),r=parseInt(n.css("left"),10);if(e.options.pinned&&!e.options.isMaximized){n.css({position:"",top:o+t.scrollTop(),left:r+t.scrollLeft()});n.find(g).find(A).addClass("k-i-pin").removeClass("k-i-unpin");e.options.pinned=false}},_onDocumentResize:function(){var e=this,t=e.wrapper,n=i(window);if(!e.options.isMaximized){return}t.css({width:n.width(),height:n.height()-parseInt(t.css("padding-top"),10)});e.trigger(C)},refresh:function(e){var t=this,n=t.options,r=i(t.element),s,d,f;if(!o(e)){e={url:e}}e=a({},n.content,e);d=G(n.iframe)?n.iframe:e.iframe;f=e.url;if(f){if(!G(d)){d=!N(f)}if(!d){t._ajaxRequest(e)}else{s=r.find("."+k)[0];if(s){s.src=f||s.src}else{r.html(c.contentFrame(a({},n,{content:e})))}r.find("."+k).unbind("load"+p).on("load"+p,function(){t.trigger(I)})}}else{if(e.template){t.content(l(e.template)({}))}t.trigger(I)}return t},_ajaxRequest:function(e){var t=this,n=e.template,o=t.wrapper.find(".k-window-titlebar .k-i-refresh"),r=setTimeout(function(){o.addClass(y)},100);i.ajax(a({type:"GET",dataType:"html",cache:false,error:function(i,e){t.trigger(F,{status:e,xhr:i})},complete:function(){clearTimeout(r);o.removeClass(y)},success:function(i){if(n){i=l(n)(i||{})}t.content(i);t.element.prop("scrollTop",0);t.trigger(I)}},e))},destroy:function(){var n=this.wrapper;t.fn.destroy.call(this);e.destroy(n);if(this.resizing){this.resizing.destroy()}if(this.dragging){this.dragging.destroy()}this.element.children("iframe").remove();n.find(".k-resize-handle,.k-window-titlebar").off(p);n.remove().off(p);i(window).off("resize",this._resizeHandler);this._removeOverlay(true)},_createWindow:function(){var t=this,n=t.element,o=t.options,r,s,d=e.support.isRtl(n);if(o.scrollable===false){n.attr("style","overflow:hidden;")}s=i(c.wrapper(o));if(o.title!==false){s.append(c.titlebar(a(c,o)))}r=n.find("iframe:not(.k-content)").map(function(){var i=this.getAttribute("src");this.src="";return i});s.toggleClass("k-rtl",d).appendTo(t.appendTo).append(n).find("iframe:not(.k-content)").each(function(i){this.src=r[i]});s.find(".k-window-title").css(d?"left":"right",s.find(".k-window-actions").outerWidth()+10);n.show();n.find("[data-role=editor]").each(function(){var e=i(this).data("kendoEditor");if(e){e.refresh()}})}});c={wrapper:l("<div class='k-widget k-window' />"),action:l("<a role='button' href='\\#' class='k-window-action k-link'>"+"<span role='presentation' class='k-icon k-i-#= name.toLowerCase() #'>#= name #</span>"+"</a>"),titlebar:l("<div class='k-window-titlebar k-header'>&nbsp;"+"<span class='k-window-title'>#= title #</span>"+"<div class='k-window-actions'>"+"# for (var i = 0; i < actions.length; i++) { #"+"#= action({ name: actions[i] }) #"+"# } #"+"</div>"+"</div>"),overlay:"<div class='k-overlay' />",contentFrame:l("<iframe frameborder='0' title='#= title #' class='"+k+"' "+"src='#= content.url #'>"+"This page requires frames in order to show content"+"</iframe>"),resizeHandle:l("<div class='k-resize-handle k-resize-#= data #'></div>")};function B(i){var e=this;e.owner=i;e._draggable=new n(i.wrapper,{filter:w,group:i.wrapper.id+"-resizing",dragstart:s(e.dragstart,e),drag:s(e.drag,e),dragend:s(e.dragend,e)})}B.prototype={dragstart:function(t){var n=this,o=n.owner,r=o.wrapper;n.elementPadding=parseInt(o.wrapper.css("padding-top"),10);n.initialCursorPosition=e.getOffset(r,"position");n.resizeDirection=t.currentTarget.prop("className").replace("k-resize-handle k-resize-","");n.initialSize={width:r.width(),height:r.height()};n.containerOffset=e.getOffset(o.appendTo);r.append(c.overlay).find(w).not(t.currentTarget).hide();i(f).css(T,t.currentTarget.css(T))},drag:function(i){var e=this,t=e.owner,n=t.wrapper,o=t.options,r=e.resizeDirection,s=e.containerOffset,a=e.initialCursorPosition,d=e.initialSize,l,f,c,p,h=Math.max(i.x.location,s.left),u=Math.max(i.y.location,s.top);if(r.indexOf("e")>=0){l=h-a.left;n.width(U(l,o.minWidth,o.maxWidth))}else if(r.indexOf("w")>=0){p=a.left+d.width;l=U(p-h,o.minWidth,o.maxWidth);n.css({left:p-l-s.left,width:l})}if(r.indexOf("s")>=0){f=u-a.top-e.elementPadding;n.height(U(f,o.minHeight,o.maxHeight))}else if(r.indexOf("n")>=0){c=a.top+d.height;f=U(c-u,o.minHeight,o.maxHeight);n.css({top:c-f-s.top,height:f})}t.trigger(C)},dragend:function(e){var t=this,n=t.owner,o=n.wrapper;o.find(v).remove().end().find(w).not(e.currentTarget).show();i(f).css(T,"");if(n.touchScroller){n.touchScroller.reset()}if(e.keyCode==27){o.css(t.initialCursorPosition).css(t.initialSize)}return false},destroy:function(){this._draggable.destroy()}};function J(i,e){var t=this;t.owner=i;t._draggable=new n(i.wrapper,{filter:e,group:i.wrapper.id+"-moving",dragstart:s(t.dragstart,t),drag:s(t.drag,t),dragend:s(t.dragend,t),dragcancel:s(t.dragcancel,t)})}J.prototype={dragstart:function(t){var n=this.owner,o=n.element,r=o.find(".k-window-actions"),s=e.getOffset(n.appendTo);n.trigger(S);n.initialWindowPosition=e.getOffset(n.wrapper,"position");n.startPosition={left:t.x.client-n.initialWindowPosition.left,top:t.y.client-n.initialWindowPosition.top};if(r.length>0){n.minLeftPosition=r.outerWidth()+parseInt(r.css("right"),10)-o.outerWidth()}else{n.minLeftPosition=20-o.outerWidth()}n.minLeftPosition-=s.left;n.minTopPosition=-s.top;n.wrapper.append(c.overlay).find(w).hide();i(f).css(T,t.currentTarget.css(T))},drag:function(e){var t=this.owner,n={left:Math.max(e.x.client-t.startPosition.left,t.minLeftPosition),top:Math.max(e.y.client-t.startPosition.top,t.minTopPosition)};i(t.wrapper).css(n)},_finishDrag:function(){var e=this.owner;e.wrapper.find(w).toggle(!e.options.isMinimized).end().find(v).remove();i(f).css(T,"")},dragcancel:function(i){this._finishDrag();i.currentTarget.closest(h).css(this.owner.initialWindowPosition)},dragend:function(){this._finishDrag();this.owner.trigger(P);return false},destroy:function(){this._draggable.destroy()}};e.ui.plugin(V)});
define('text!controls/common/templates/modal.html',[],function () { return '<div class="trucode" style="display:none; overflow-y:auto">\r\n    <div class="modal-content"></div>\r\n</div>';});

define('text!controls/common/templates/modal-confirm-buttons.html',[],function () { return '<div class="dialog-confirm">\r\n    <button type="button" class="k-button ok-button">Ok</button>\r\n    <button type="button" class="k-button cancel-button">Cancel</button>\r\n</div>\r\n';});

define('lib/modal',["require", "exports", "jql", "kendoui/kendo.window", "lib/api", "lib/templates", "text!controls/common/templates/modal.html", "text!controls/common/templates/modal-confirm-buttons.html"], function(require, exports, __$__, __dialog__, __api__, __Templates__, __modalTemplate__, __modalConfirmTemplate__) {
    ///<reference path="../vendor/jquery/jquery.d.ts"/>
    var $ = __$__;
    ///<reference path="../vendor/kendoui/kendoui.d.ts"/>
    
    var dialog = __dialog__;

    var api = __api__;

    var Templates = __Templates__;
    ///<reference path="../controls/common/templates/templates.d.ts"/>
    
    var modalTemplate = __modalTemplate__;

    var modalConfirmTemplate = __modalConfirmTemplate__;

    function show(options) {
        // INCLUDE HACK
        if(dialog || !dialog) {
        }
        var modalId = api.TC.current().settings.modalId, $modal = $('#' + modalId), exists = $modal.length !== 0, kWindow = exists ? $modal.data('kendoWindow') : null, settings;
        settings = {
            draggable: true,
            modal: true,
            resizable: false,
            visible: false,
            maxWidth: 650,
            maxHeight: 300,
            minWidth: 300
        };
        $.extend(settings, options);
        if(!api.TC.current().settings.effects) {
            settings.animation = false;
        }
        if(!exists) {
            $modal = $(Templates.get(Templates.tk_modal, modalTemplate)).attr('id', modalId);
            if(options.htmlContent) {
                $modal.find('.modal-content').html(options.htmlContent);
            }
            kWindow = $modal.kendoWindow(settings).data('kendoWindow');
            // avoid kendoui from handling arrows as moving the window position...
            kWindow.element.unbind('keydown').bind('keydown', closeOnEscape).click();
        } else {
            // unbind all event handlers previously registered, new/default ones will be set again
            kWindow.unbind();
            if(options.htmlContent) {
                $modal.find('.modal-content').html(options.htmlContent);
            }
            if(kWindow.options.visible === true) {
                delete settings.visible;
            }
            kWindow.setOptions(settings);
        }
        kWindow.bind('open', addClassToModal);
        kWindow.center().open();
        if(typeof options.confirm === 'function') {
            $modal.find('.k-button').click(function () {
                if($(this).hasClass('ok-button')) {
                    options.confirm();
                }
                close();
            });
        }
        return $modal;
    }
    exports.show = show;
    function closeOnEscape(e) {
        if(e.keyCode === 27) {
            close();
        }
    }
    function addClassToModal() {
        $('#' + api.TC.current().settings.modalId).parent().addClass('trucode');
    }
    function close() {
        // INCLUDE HACK
        if(dialog || !dialog) {
        }
        var modalId = api.TC.current().settings.modalId, $modal = $('#' + modalId), exists = $modal.length !== 0, kWindow = exists ? $modal.data('kendoWindow') : null;
        if(kWindow !== null) {
            kWindow.close();
        }
    }
    exports.close = close;
    function confirm(options) {
        options.htmlContent += Templates.get(Templates.tk_modalConfirm, modalConfirmTemplate);
        options.width = '500px';
        show(options);
    }
    exports.confirm = confirm;
    function get() {
        var modalId = api.TC.current().settings.modalId, $modal = $('#' + modalId);
        return $modal;
    }
    exports.get = get;
})
;
define('kendoui/kendo.splitter',["kendoui/kendo.jquery","kendoui/kendo.core","kendoui/kendo.userevents","kendoui/kendo.draganddrop","kendoui/kendo.resizable"],function(e,t){var i=t.ui,n=t.keys,r=e.extend,s=e.proxy,a=i.Widget,o=/^\d+(\.\d+)?px$/i,l=/^\d+(\.\d+)?%$/i,d=".kendoSplitter",p="expand",c="collapse",f="contentLoad",u="error",h="resize",g="layoutChange",v="horizontal",k="vertical",m="mouseenter",_="click",z="pane",y="mouseleave",x="k-state-focused",b="k-"+z,P="."+b;function w(e){return l.test(e)}function C(e){return o.test(e)||/^\d+$/.test(e)}function S(e){return!w(e)&&!C(e)}function H(e,t){return function(i,n){var r=this.element.find(i).data(z);if(arguments.length==1){return r[e]}r[e]=n;if(t){var s=this.element.data("kendo"+this.options.name);s.trigger(h)}}}var T=a.extend({init:function(e,i){var r=this,o;a.fn.init.call(r,e,i);r.wrapper=r.element;o=r.options.orientation.toLowerCase()!=k;r.orientation=o?v:k;r._dimension=o?"width":"height";r._keys={decrease:o?n.LEFT:n.UP,increase:o?n.RIGHT:n.DOWN};r._resizeStep=10;r.bind(h,s(r._resize,r));r._marker=t.guid().substring(0,8);r._resizeHandler=function(){r.trigger(h)};r._initPanes();r.resizing=new E(r);r.element.triggerHandler("init"+d)},events:[p,c,f,u,h,g],_parentSplitter:function(){return this.element.parent().closest(".k-splitter")},_attachEvents:function(){var t=this,i=t.options.orientation,n=t._parentSplitter();t.element.children(".k-splitbar-draggable-"+i).on("keydown"+d,e.proxy(t._keydown,t)).on("mousedown"+d,function(e){e.currentTarget.focus()}).on("focus"+d,function(t){e(t.currentTarget).addClass(x)}).on("blur"+d,function(i){e(i.currentTarget).removeClass(x);if(t.resizing){t.resizing.end()}}).on(m+d,function(){e(this).addClass("k-splitbar-"+t.orientation+"-hover")}).on(y+d,function(){e(this).removeClass("k-splitbar-"+t.orientation+"-hover")}).on("mousedown"+d,function(){t._panes().append("<div class='k-splitter-overlay k-overlay' />")}).on("mouseup"+d,function(){t._panes().children(".k-splitter-overlay").remove()}).end().children(".k-splitbar").on("dblclick"+d,s(t._togglePane,t)).children(".k-collapse-next, .k-collapse-prev").on(_+d,t._arrowClick(c)).end().children(".k-expand-next, .k-expand-prev").on(_+d,t._arrowClick(p)).end().end();if(!n.length){e(window).on("resize",t._resizeHandler)}else{var r=n.data("kendo"+t.options.name);if(r){r.bind(h,t._resizeHandler)}else{n.off("init"+d).one("init"+d,function(){e(this).data("kendo"+t.options.name).bind(h,t._resizeHandler);t._resizeHandler()})}}},_detachEvents:function(){var t=this,i=t._parentSplitter().data("kendo"+t.options.name);t.element.children(".k-splitbar-draggable-"+t.orientation).off(d).end().children(".k-splitbar").off("dblclick"+d).children(".k-collapse-next, .k-collapse-prev, .k-expand-next, .k-expand-prev").off(d);if(i){i.unbind(h,t._resizeHandler)}else{e(window).off("resize",t._resizeHandler)}},options:{name:"Splitter",orientation:v,panes:[]},destroy:function(){var e=this;a.fn.destroy.call(e);e._detachEvents();if(e.resizing){e.resizing.destroy()}t.destroy(e.element)},_keydown:function(t){var i=this,r=t.keyCode,s=i.resizing,a=e(t.currentTarget),o=i._keys,l=r===o.increase,d=r===o.decrease,f;if(l||d){if(t.ctrlKey){f=a[d?"next":"prev"]();if(s&&s.isResizing()){s.end()}if(!f[i._dimension]()){i._triggerAction(p,f)}else{i._triggerAction(c,a[d?"prev":"next"]())}}else if(s){s.move((d?-1:1)*i._resizeStep,a)}t.preventDefault()}else if(r===n.ENTER&&s){s.end();t.preventDefault()}},_initPanes:function(){var e=this,t=e.options.panes||[];e.element.addClass("k-widget").addClass("k-splitter").children(":not(script)").each(function(i,n){var r=t&&t[i];e._initPane(n,r)}).end();e.trigger(h)},_initPane:function(t,i){t=e(t).attr("role","group").addClass(b);t.data(z,i?i:{}).toggleClass("k-scrollable",i?i.scrollable!==false:true);this.ajaxRequest(t)},ajaxRequest:function(e,i,n){var r=this,s;e=r.element.find(e);s=e.data(z);i=i||s.contentUrl;if(i){e.append("<span class='k-icon k-loading k-pane-loading' />");if(t.isLocalUrl(i)){jQuery.ajax({url:i,data:n||{},type:"GET",dataType:"html",success:function(t){e.html(t);r.trigger(f,{pane:e[0]})},error:function(t,i){r.trigger(u,{pane:e[0],status:i,xhr:t})}})}else{e.removeClass("k-scrollable").html("<iframe src='"+i+"' frameborder='0' class='k-content-frame'>"+"This page requires frames in order to show content"+"</iframe>")}}},_triggerAction:function(e,t){if(!this.trigger(e,{pane:t[0]})){this[e](t[0])}},_togglePane:function(t){var i=this,n=e(t.target),r;if(n.closest(".k-splitter")[0]!=i.element[0]){return}r=n.children(".k-icon:not(.k-resize-handle)");if(r.length!==1){return}if(r.is(".k-collapse-prev")){i._triggerAction(c,n.prev())}else if(r.is(".k-collapse-next")){i._triggerAction(c,n.next())}else if(r.is(".k-expand-prev")){i._triggerAction(p,n.prev())}else if(r.is(".k-expand-next")){i._triggerAction(p,n.next())}},_arrowClick:function(t){var i=this;return function(n){var r=e(n.target),s;if(r.closest(".k-splitter")[0]!=i.element[0]){return}if(r.is(".k-"+t+"-prev")){s=r.parent().prev()}else{s=r.parent().next()}i._triggerAction(t,s)}},_updateSplitBar:function(e,t,i){var n=function(e,t){return t?"<div class='k-icon "+e+"' />":""},r=this.orientation,s=t.resizable!==false&&i.resizable!==false,a=t.collapsible,o=t.collapsed,l=i.collapsible,d=i.collapsed;e.addClass("k-splitbar k-state-default k-secondary k-splitbar-"+r).attr("role","separator").attr("aria-expanded",!(o||d)).removeClass("k-splitbar-"+r+"-hover").toggleClass("k-splitbar-draggable-"+r,s&&!o&&!d).toggleClass("k-splitbar-static-"+r,!s&&!a&&!l).html(n("k-collapse-prev",a&&!o&&!d)+n("k-expand-prev",a&&o&&!d)+n("k-resize-handle",s)+n("k-collapse-next",l&&!d&&!o)+n("k-expand-next",l&&d&&!o))},_updateSplitBars:function(){var t=this;this.element.children(".k-splitbar").each(function(){var i=e(this),n=i.prevAll(P).first().data(z),r=i.nextAll(P).first().data(z);if(!r){return}t._updateSplitBar(i,n,r)})},_removeSplitBars:function(){this.element.children(".k-splitbar").remove()},_panes:function(){return this.element.children(P)},_resize:function(){var t=this,i=t.element,n=i.children(P),r=t.orientation==v,s=i.children(".k-splitbar"),a=s.length,o=r?"width":"height",l=i[o]();if(a===0){a=n.length-1;n.slice(0,a).after("<div tabindex='0' class='k-splitbar' data-marker='"+t._marker+"' />");t._updateSplitBars();s=i.children(".k-splitbar")}else{t._updateSplitBars()}s.each(function(){l-=this[r?"offsetWidth":"offsetHeight"]});var d=0,p=0,c=e();n.css({position:"absolute",top:0})[o](function(){var t=e(this).data(z)||{},i;if(t.collapsed){i=0;e(this).css("overflow","hidden")}else if(S(t.size)){c=c.add(this);return}else{i=parseInt(t.size,10);if(w(t.size)){i=Math.floor(i*l/100)}}p++;d+=i;return i});l-=d;var f=c.length,u=Math.floor(l/f);c.slice(0,f-1).css(o,u).end().eq(f-1).css(o,l-(f-1)*u);var h=0,k=r?"height":"width",m=r?"left":"top",_=r?"offsetWidth":"offsetHeight";if(f===0){var y=n.filter(function(){return!(e(this).data(z)||{}).collapsed}).last();y[o](l+y[0][_])}i.children(":not(script)").css(k,i[k]()).each(function(e,t){t.style[m]=Math.floor(h)+"px";h+=t[_]});t._detachEvents();t._attachEvents();t.trigger(g)},toggle:function(e,t){var i=this,n;e=i.element.find(e);n=e.data(z);if(!t&&!n.collapsible){return}if(arguments.length==1){t=n.collapsed===undefined?false:n.collapsed}n.collapsed=!t;if(n.collapsed){e.css("overflow","hidden")}else{e.css("overflow","")}i.trigger(h)},collapse:function(e){this.toggle(e,false)},expand:function(e){this.toggle(e,true)},_addPane:function(e,t,i){var n=this;if(i.length){n.options.panes.splice(t,0,e);n._initPane(i,e);n._removeSplitBars();n.trigger(h)}return i},append:function(t){t=t||{};var i=this,n=e("<div />").appendTo(i.element);return i._addPane(t,i.options.panes.length,n)},insertBefore:function(t,i){i=e(i);t=t||{};var n=this,r=i.index(".k-pane"),s=e("<div />").insertBefore(e(i));return n._addPane(t,r,s)},insertAfter:function(t,i){i=e(i);t=t||{};var n=this,r=i.index(".k-pane"),s=e("<div />").insertAfter(e(i));return n._addPane(t,r+1,s)},remove:function(i){i=e(i);var n=this;if(i.length){t.destroy(i);i.each(function(t,i){n.options.panes.splice(e(i).index(".k-pane"),1);e(i).remove()});n._removeSplitBars();if(n.options.panes.length){n.trigger(h)}}return n},size:H("size",true),min:H("min"),max:H("max")});i.plugin(T);var A={sizingProperty:"height",sizingDomProperty:"offsetHeight",alternateSizingProperty:"width",positioningProperty:"top",mousePositioningProperty:"pageY"};var B={sizingProperty:"width",sizingDomProperty:"offsetWidth",alternateSizingProperty:"height",positioningProperty:"left",mousePositioningProperty:"pageX"};function E(e){var i=this,n=e.orientation;i.owner=e;i._element=e.element;i.orientation=n;r(i,n===v?B:A);i._resizable=new t.ui.Resizable(e.element,{orientation:n,handle:".k-splitbar-draggable-"+n+"[data-marker="+e._marker+"]",hint:s(i._createHint,i),start:s(i._start,i),max:s(i._max,i),min:s(i._min,i),invalidClass:"k-restricted-size-"+n,resizeend:s(i._stop,i)})}E.prototype={press:function(e){this._resizable.press(e)},move:function(e,t){if(!this.pressed){this.press(t);this.pressed=true}if(!this._resizable.target){this._resizable.press(t)}this._resizable.move(e)},end:function(){this._resizable.end();this.pressed=false},destroy:function(){this._resizable.destroy()},isResizing:function(){return this._resizable.resizing},_createHint:function(t){var i=this;return e("<div class='k-ghost-splitbar k-ghost-splitbar-"+i.orientation+" k-state-default' />").css(i.alternateSizingProperty,t[i.alternateSizingProperty]())},_start:function(t){var i=this,n=e(t.currentTarget),r=n.prev(),s=n.next(),a=r.data(z),o=s.data(z),l=parseInt(r[0].style[i.positioningProperty],10),d=parseInt(s[0].style[i.positioningProperty],10)+s[0][i.sizingDomProperty]-n[0][i.sizingDomProperty],p=parseInt(i._element.css(i.sizingProperty),10),c=function(e){var t=parseInt(e,10);return(C(e)?t:p*t/100)||0},f=c(a.min),u=c(a.max)||d-l,h=c(o.min),g=c(o.max)||d-l;i.previousPane=r;i.nextPane=s;i._maxPosition=Math.min(d-h,l+u);i._minPosition=Math.max(l+f,d-g)},_max:function(){return this._maxPosition},_min:function(){return this._minPosition},_stop:function(i){var n=this,r=e(i.currentTarget),s=n.owner;s._panes().children(".k-splitter-overlay").remove();if(i.keyCode!==t.keys.ESC){var a=i.position,o=r.prev(),l=r.next(),d=o.data(z),p=l.data(z),c=a-parseInt(o[0].style[n.positioningProperty],10),f=parseInt(l[0].style[n.positioningProperty],10)+l[0][n.sizingDomProperty]-a-r[0][n.sizingDomProperty],u=n._element.children(P).filter(function(){return S(e(this).data(z).size)}).length;if(!S(d.size)||u>1){if(S(d.size)){u--}d.size=c+"px"}if(!S(p.size)||u>1){p.size=f+"px"}s._resizeHandler()}return false}}});
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/baseRow',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    
    var BaseRow = (function (_super) {
        __extends(BaseRow, _super);
        function BaseRow(attrs, options) {
            this.defaults = {
                'selectable': false
            };
                _super.call(this, attrs, options);
        }
        BaseRow.prototype.initialize = function () {
            var rtype = 'unknown';
            try  {
                rtype = this.get('record').type.toLowerCase();
            } catch (e) {
            }
            this.set('recordType', rtype);
        };
        return BaseRow;
    })(Backbone.Model);
    exports.BaseRow = BaseRow;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/chapterTitle',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var ChapterTitle = (function (_super) {
        __extends(ChapterTitle, _super);
        function ChapterTitle(attrs, options) {
                _super.call(this, attrs, options);
        }
        ChapterTitle.prototype.initialize = function (attrs) {
            this.set('recordType', 'chaptertitle');
        };
        return ChapterTitle;
    })(BR.BaseRow);
    exports.ChapterTitle = ChapterTitle;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/codeEntry',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var CodeEntry = (function (_super) {
        __extends(CodeEntry, _super);
        function CodeEntry(attrs, options) {
                _super.call(this, attrs, options);
        }
        CodeEntry.prototype.initialize = function (attrs) {
            this.set('selectable', true);
            this.set('recordType', 'codeentry');
        };
        return CodeEntry;
    })(BR.BaseRow);
    exports.CodeEntry = CodeEntry;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/codingTipLine',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var CodingTipLine = (function (_super) {
        __extends(CodingTipLine, _super);
        function CodingTipLine(attrs, options) {
                _super.call(this, attrs, options);
        }
        CodingTipLine.prototype.initialize = function (attrs) {
            this.set('recordType', 'codingtipline');
        };
        return CodingTipLine;
    })(BR.BaseRow);
    exports.CodingTipLine = CodingTipLine;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/codingTipTitle',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var CodingTipTitle = (function (_super) {
        __extends(CodingTipTitle, _super);
        function CodingTipTitle(attrs, options) {
                _super.call(this, attrs, options);
        }
        CodingTipTitle.prototype.initialize = function (attrs) {
            this.set('recordType', 'codingtiptitle');
        };
        return CodingTipTitle;
    })(BR.BaseRow);
    exports.CodingTipTitle = CodingTipTitle;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/customLine',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var CustomLine = (function (_super) {
        __extends(CustomLine, _super);
        function CustomLine(attrs, options) {
                _super.call(this, attrs, options);
        }
        CustomLine.prototype.initialize = function (attrs) {
            var rec = this.get('record');
            this.set('selectable', true);
            this.set('recordType', 'customline');
            this.set('hasCodes', (typeof rec.regular_row_codes !== 'undefined' && rec.regular_row_codes.length > 0));
        };
        return CustomLine;
    })(BR.BaseRow);
    exports.CustomLine = CustomLine;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/instructionalNote',["require", "exports", "underscore", "controls/codebooks/models/tabular/baseRow"], function(require, exports, _____, __BR__) {
    
    ///<reference path="../../../../vendor/underscore/underscore.d.ts"/>
    var _ = _____;

    var BR = __BR__;

    var InstructionalNote = (function (_super) {
        __extends(InstructionalNote, _super);
        function InstructionalNote(attrs, options) {
                _super.call(this, attrs, options);
        }
        InstructionalNote.prototype.initialize = function (attrs) {
            var startCode = '', endCode = '';
            this.set('recordType', 'instructionalnote');
            try  {
                startCode = _.find(this.get('record').codes, function (c) {
                    return c.startcode;
                }).startcode;
            } catch (e) {
            }
            try  {
                endCode = _.find(this.get('record').codes, function (c) {
                    return c.endcode;
                }).endcode;
            } catch (e) {
            }
            this.set('startCode', startCode);
            this.set('endCode', endCode);
        };
        return InstructionalNote;
    })(BR.BaseRow);
    exports.InstructionalNote = InstructionalNote;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/letter',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var Letter = (function (_super) {
        __extends(Letter, _super);
        function Letter(attrs, options) {
                _super.call(this, attrs, options);
        }
        Letter.prototype.initialize = function (attrs) {
            this.set('recordType', 'letter');
        };
        return Letter;
    })(BR.BaseRow);
    exports.Letter = Letter;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/mainEntry',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var MainEntry = (function (_super) {
        __extends(MainEntry, _super);
        function MainEntry(attrs, options) {
                _super.call(this, attrs, options);
        }
        MainEntry.prototype.initialize = function (attrs) {
            this.set('selectable', true);
            this.set('recordType', 'mainentry');
        };
        return MainEntry;
    })(BR.BaseRow);
    exports.MainEntry = MainEntry;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/mainEntrySelectable',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var MainEntrySelectable = (function (_super) {
        __extends(MainEntrySelectable, _super);
        function MainEntrySelectable(attrs, options) {
                _super.call(this, attrs, options);
        }
        MainEntrySelectable.prototype.initialize = function (attrs) {
            var isSevenCharCode = false;
            try  {
                if(this.get('data_book').indexOf('ICD10') !== -1 && this.get('record').codes[0].startcode.replace('.', '').length === 7) {
                    isSevenCharCode = true;
                }
            } catch (e) {
            }
            this.set('sevenCharCode', isSevenCharCode);
            this.set('selectable', true);
            this.set('recordType', 'mainentryselectable');
        };
        return MainEntrySelectable;
    })(BR.BaseRow);
    exports.MainEntrySelectable = MainEntrySelectable;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/orderedListItem',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var OrderedListItem = (function (_super) {
        __extends(OrderedListItem, _super);
        function OrderedListItem(attrs, options) {
                _super.call(this, attrs, options);
        }
        OrderedListItem.prototype.initialize = function (attrs) {
            this.set('recordType', 'orderedlistitem');
        };
        return OrderedListItem;
    })(BR.BaseRow);
    exports.OrderedListItem = OrderedListItem;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/regular',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var Regular = (function (_super) {
        __extends(Regular, _super);
        function Regular(attrs, options) {
                _super.call(this, attrs, options);
        }
        Regular.prototype.initialize = function (attrs) {
            var selectable = false, rec = this.get('record');
            try  {
                selectable = this.get('data_book').toUpperCase().indexOf('_INDEX') !== -1;
            } catch (e) {
            }
            this.set('selectable', selectable);
            this.set('recordType', 'regular');
            this.set('hasCodes', (typeof rec.regular_row_codes !== 'undefined' && rec.regular_row_codes.length > 0));
        };
        return Regular;
    })(BR.BaseRow);
    exports.Regular = Regular;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/section',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var Section = (function (_super) {
        __extends(Section, _super);
        function Section(attrs, options) {
                _super.call(this, attrs, options);
        }
        Section.prototype.initialize = function (attrs) {
            this.set('recordType', 'section');
        };
        return Section;
    })(BR.BaseRow);
    exports.Section = Section;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/sectionLine',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var SectionLine = (function (_super) {
        __extends(SectionLine, _super);
        function SectionLine(attrs, options) {
                _super.call(this, attrs, options);
        }
        SectionLine.prototype.initialize = function (attrs) {
            this.set('recordType', 'sectionline');
        };
        return SectionLine;
    })(BR.BaseRow);
    exports.SectionLine = SectionLine;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/sectionTitle',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var SectionTitle = (function (_super) {
        __extends(SectionTitle, _super);
        function SectionTitle(attrs, options) {
                _super.call(this, attrs, options);
        }
        SectionTitle.prototype.initialize = function (attrs) {
            this.set('recordType', 'sectiontitle');
        };
        return SectionTitle;
    })(BR.BaseRow);
    exports.SectionTitle = SectionTitle;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/tableRow',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var TableRow = (function (_super) {
        __extends(TableRow, _super);
        function TableRow(attrs, options) {
                _super.call(this, attrs, options);
        }
        TableRow.prototype.initialize = function (attrs) {
            this.set('selectable', true);
            this.set('recordType', 'tablerow');
        };
        return TableRow;
    })(BR.BaseRow);
    exports.TableRow = TableRow;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/tableRowChannelPublishing',["require", "exports", "controls/codebooks/models/tabular/baseRow"], function(require, exports, __BR__) {
    
    
    var BR = __BR__;

    var TableRowChannelPublishing = (function (_super) {
        __extends(TableRowChannelPublishing, _super);
        function TableRowChannelPublishing(attrs, options) {
                _super.call(this, attrs, options);
        }
        TableRowChannelPublishing.prototype.initialize = function (attrs) {
            this.set('selectable', true);
            this.set('recordType', 'tablerowchannelpublishing');
        };
        return TableRowChannelPublishing;
    })(BR.BaseRow);
    exports.TableRowChannelPublishing = TableRowChannelPublishing;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabular/rowCollection',["require", "exports", "Backbone", "controls/codebooks/models/tabular/baseRow", "controls/codebooks/models/tabular/chapterTitle", "controls/codebooks/models/tabular/codeEntry", "controls/codebooks/models/tabular/codingTipLine", "controls/codebooks/models/tabular/codingTipTitle", "controls/codebooks/models/tabular/customLine", "controls/codebooks/models/tabular/instructionalNote", "controls/codebooks/models/tabular/letter", "controls/codebooks/models/tabular/mainEntry", "controls/codebooks/models/tabular/mainEntrySelectable", "controls/codebooks/models/tabular/orderedListItem", "controls/codebooks/models/tabular/regular", "controls/codebooks/models/tabular/section", "controls/codebooks/models/tabular/sectionLine", "controls/codebooks/models/tabular/sectionTitle", "controls/codebooks/models/tabular/tableRow", "controls/codebooks/models/tabular/tableRowChannelPublishing"], function(require, exports, __Backbone__, __BR__, __CT__, __CE__, __CTL__, __CTT__, __CL__, __IN__, __L__, __ME__, __MES__, __OLI__, __R__, __S__, __SL__, __ST__, __TR__, __TRCP__) {
    ///<reference path="../../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    
    var BR = __BR__;

    var CT = __CT__;

    var CE = __CE__;

    var CTL = __CTL__;

    var CTT = __CTT__;

    var CL = __CL__;

    var IN = __IN__;

    var L = __L__;

    var ME = __ME__;

    var MES = __MES__;

    var OLI = __OLI__;

    var R = __R__;

    var S = __S__;

    var SL = __SL__;

    var ST = __ST__;

    var TR = __TR__;

    var TRCP = __TRCP__;

    var RowCollection = (function (_super) {
        __extends(RowCollection, _super);
        function RowCollection() {
            _super.apply(this, arguments);

            this.model = function (attrs, options) {
                var type = 'regular', typeMap = {
                    'regular': R.Regular,
                    'chaptertitle': CT.ChapterTitle,
                    'codeentry': CE.CodeEntry,
                    'codingtipline': CTL.CodingTipLine,
                    'codingtiptitle': CTT.CodingTipTitle,
                    'customline': CL.CustomLine,
                    'instructionalnote': IN.InstructionalNote,
                    'letter': L.Letter,
                    'mainentry': ME.MainEntry,
                    'mainentryselectable': MES.MainEntrySelectable,
                    'orderedlistitem': OLI.OrderedListItem,
                    'section': S.Section,
                    'sectionline': SL.SectionLine,
                    'sectiontitle': ST.SectionTitle,
                    'tablerow': TR.TableRow,
                    'tablerowchannelpublishing': TRCP.TableRowChannelPublishing,
                    'unknown': BR.BaseRow
                }, recordType;
                if(attrs.record && attrs.record.type) {
                    type = attrs.record.type;
                }
                recordType = typeMap[type] || typeMap.unknown;
                return new recordType(attrs, options);
            };
        }
        return RowCollection;
    })(Backbone.Collection);
    exports.RowCollection = RowCollection;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/models/research/baseSection',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var BaseSection = (function (_super) {
        __extends(BaseSection, _super);
        function BaseSection(attrs, options) {
            var sType = (typeof attrs.research_type === 'string') ? attrs.research_type.toUpperCase() : 'baseSection', itemCount = attrs.best_count + attrs.other_count || 0;
            this.defaults = {
                sectionType: sType,
                itemCount: itemCount
            };
                _super.call(this, attrs, options);
        }
        BaseSection.prototype.initialize = function (attrs) {
            this.set('items', this.get('articles') || []);
            this.unset('articles');
            this.set('hasMore', this.hasMore());
        };
        BaseSection.prototype.hasMore = function () {
            try  {
                return this.get('itemCount') > this.get('items').length;
            } catch (e) {
                return false;
            }
        };
        return BaseSection;
    })(Backbone.Model);
    exports.BaseSection = BaseSection;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/models/research/codersDeskReference',["require", "exports", "underscore", "controls/research/models/research/baseSection"], function(require, exports, _____, __BS__) {
    
    var _ = _____;

    var BS = __BS__;

    var CodersDeskReference = (function (_super) {
        __extends(CodersDeskReference, _super);
        function CodersDeskReference(attrs, options) {
                _super.call(this, attrs, options);
        }
        CodersDeskReference.prototype.initialize = function (attrs) {
            var cdrEntries = this.get('cdr_entries') || [], groupedByTitle;
            // case 13843
            if(cdrEntries.length > 1) {
                groupedByTitle = _.groupBy(cdrEntries, 'title');
                cdrEntries = [];
                for(var groupTitle in groupedByTitle) {
                    // only take the most recent entry of the group which is correctly sorted by the service/chronOrder
                    cdrEntries.push(groupedByTitle[groupTitle][0]);
                }
            }
            this.set('items', cdrEntries);
            this.set('itemCount', cdrEntries.length);
            this.unset('cdr_entries');
            this.set('hasMore', false);
        };
        return CodersDeskReference;
    })(BS.BaseSection);
    exports.CodersDeskReference = CodersDeskReference;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/models/research/codingAdvice',["require", "exports", "controls/research/models/research/baseSection"], function(require, exports, __BS__) {
    
    var BS = __BS__;

    var CodingAdvice = (function (_super) {
        __extends(CodingAdvice, _super);
        function CodingAdvice(attrs, options) {
                _super.call(this, attrs, options);
        }
        CodingAdvice.prototype.initialize = function (attrs) {
            var items = this.get('coding_advices') || [];
            this.set('items', items);
            this.set('itemCount', items.length);
            this.unset('coding_advices');
            this.set('hasMore', false);
        };
        return CodingAdvice;
    })(BS.BaseSection);
    exports.CodingAdvice = CodingAdvice;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/models/research/crosswalk',["require", "exports", "controls/research/models/research/baseSection"], function(require, exports, __BS__) {
    
    var BS = __BS__;

    var Crosswalk = (function (_super) {
        __extends(Crosswalk, _super);
        function Crosswalk(attrs, options) {
                _super.call(this, attrs, options);
        }
        Crosswalk.prototype.initialize = function (attrs) {
            var items = this.get('crosswalk_entries') || [];
            this.set('items', items);
            this.set('itemCount', items.length);
            this.unset('crosswalk_entries');
            this.set('hasMore', this.hasMore());
        };
        Crosswalk.prototype.hasMore = function () {
            try  {
                return this.get('best_count') + this.get('other_count') > this.get('items').length;
            } catch (e) {
                return false;
            }
        };
        return Crosswalk;
    })(BS.BaseSection);
    exports.Crosswalk = Crosswalk;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/models/research/sectionCollection',["require", "exports", "Backbone", "controls/research/models/research/baseSection", "controls/research/models/research/codersDeskReference", "controls/research/models/research/codingAdvice", "controls/research/models/research/crosswalk"], function(require, exports, __Backbone__, __RS__, __CDR__, __CA__, __C__) {
    ///<reference path="../../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var RS = __RS__;

    var CDR = __CDR__;

    var CA = __CA__;

    var C = __C__;

    var SectionCollection = (function (_super) {
        __extends(SectionCollection, _super);
        function SectionCollection() {
            _super.apply(this, arguments);

            this.model = function (attrs, options) {
                var type = 'regular', typeMap = {
                    'CDR': CDR.CodersDeskReference,
                    'CODING_ADVICE': CA.CodingAdvice,
                    'CROSSWALK': C.Crosswalk,
                    'ANESTHESIA_CROSSWALK': C.Crosswalk,
                    'UNKNOWN': RS.BaseSection
                }, sectionType;
                if(typeof attrs.research_type === 'string') {
                    type = attrs.research_type.toUpperCase();
                }
                sectionType = typeMap[type] || typeMap.UNKNOWN;
                return new sectionType(attrs, options);
            };
        }
        return SectionCollection;
    })(Backbone.Collection);
    exports.SectionCollection = SectionCollection;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/tabularViewModel',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    
    var TabularViewModel = (function (_super) {
        __extends(TabularViewModel, _super);
        function TabularViewModel(options) {
            this.defaults = function () {
                return {
                    history: [],
                    pcsSections: {
                        columns: null
                    },
                    pcsCodeBuilder: []
                };
            };
                _super.call(this, options);
        }
        return TabularViewModel;
    })(Backbone.Model);
    exports.TabularViewModel = TabularViewModel;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/views/tabular',["require", "exports", "Backbone", "underscore", "vendor/underscore/plugins/underscore.string", "jql", "vendor/jquery/plugins/jquery.scrollTo", "vendor/jquery/plugins/jquery.imagesloaded", "text!controls/codebooks/templates/tabular/tabular.html", "text!controls/codebooks/templates/tabular/cpt.html", "text!controls/codebooks/templates/tabular/hcpcs.html", "text!controls/codebooks/templates/tabular/crosswalk.html", "text!controls/codebooks/templates/tabular/pcs-wrapper.html", "text!controls/codebooks/templates/tabular/pcs-column-head.html", "text!controls/codebooks/templates/tabular/pcs-column-choices.html", "text!controls/codebooks/templates/tabular/index.html", "text!controls/codebooks/templates/tabular/wrapper.html", "text!controls/codebooks/templates/tableHeadings/drug-ICD9.html", "text!controls/codebooks/templates/tableHeadings/drug-ICD10.html", "text!controls/codebooks/templates/tableHeadings/hypertension.html", "text!controls/codebooks/templates/tableHeadings/neoplasm.html", "text!controls/codebooks/templates/instructional-note.html", "text!controls/codebooks/templates/modifiers.html", "text!controls/codebooks/templates/tabular/cpt-image-modal.html", "text!controls/common/templates/loading-large.html", "lib/api", "lib/dom", "lib/config", "lib/templates", "lib/modal", "lib/net", "lib/events", "lib/shortcuts", "kendoui/kendo.core", "kendoui/kendo.splitter", "controls/codebooks/models/tabular/rowCollection", "controls/research/models/research/sectionCollection", "controls/codebooks/models/tabularViewModel", "i18n!locale/nls/books"], function(require, exports, __Backbone__, _____, ___string__, __$__, __scrollTo__, __imagesloaded__, __tabularTemplate__, __tabularTemplateCPT__, __tabularTemplateHCPCS__, __tabularTemplateCrosswalk__, __tabularTemplatePCSWrapper__, __tabularTemplatePCSColumnHead__, __tabularTemplatePCSColumnChoices__, __indexTemplate__, __wrapperTemplate__, __drug9HeadingTemplate__, __drug10HeadingTemplate__, __hypertensionHeadingTemplate__, __neoplasmHeadingTemplate__, __instructionalNoteTemplate__, __modifiersTemplate__, __cptModalTemplate__, __loadingTemplate__, __api__, __dom__, __config__, __Templates__, __Modal__, __net__, __Events__, __Shortcuts__, __KC__, __KS__, __RC__, __RSC__, __TVM__, __TextBook__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/underscore/plugins/underscore.string.d.ts"/>
    
    var _string = ___string__;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../../../vendor/jquery/plugins/jquery.scrollTo.d.ts"/>
    
    var scrollTo = __scrollTo__;
    ///<reference path="../../../vendor/jquery/plugins/jquery.imagesloaded.d.ts"/>
    
    var imagesloaded = __imagesloaded__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var tabularTemplate = __tabularTemplate__;

    var tabularTemplateCPT = __tabularTemplateCPT__;

    var tabularTemplateHCPCS = __tabularTemplateHCPCS__;

    var tabularTemplateCrosswalk = __tabularTemplateCrosswalk__;

    var tabularTemplatePCSWrapper = __tabularTemplatePCSWrapper__;

    var tabularTemplatePCSColumnHead = __tabularTemplatePCSColumnHead__;

    var tabularTemplatePCSColumnChoices = __tabularTemplatePCSColumnChoices__;

    var indexTemplate = __indexTemplate__;

    var wrapperTemplate = __wrapperTemplate__;

    var drug9HeadingTemplate = __drug9HeadingTemplate__;

    var drug10HeadingTemplate = __drug10HeadingTemplate__;

    var hypertensionHeadingTemplate = __hypertensionHeadingTemplate__;

    var neoplasmHeadingTemplate = __neoplasmHeadingTemplate__;

    var instructionalNoteTemplate = __instructionalNoteTemplate__;

    var modifiersTemplate = __modifiersTemplate__;

    var cptModalTemplate = __cptModalTemplate__;
    /// <reference path="../../common/templates/templates.d.ts" />
    
    var loadingTemplate = __loadingTemplate__;

    var api = __api__;

    
    var dom = __dom__;

    var config = __config__;

    var Templates = __Templates__;

    var Modal = __Modal__;

    var net = __net__;

    var Events = __Events__;

    
    var Shortcuts = __Shortcuts__;
    ///<reference path="../../../vendor/kendoui/kendoui.d.ts"/>
    
    var KC = __KC__;

    var KS = __KS__;

    
    
    var RC = __RC__;

    var RSC = __RSC__;

    var TVM = __TVM__;
    ///<reference path="../../../locale/nls/locales.d.ts"/>
    
    var TextBook = __TextBook__;

    var TABULAR_MODE = {
        PCS: 'PCS',
        NORMAL: 'NORMAL'
    };
    var TabularView = (function (_super) {
        __extends(TabularView, _super);
        function TabularView(options) {
            // Force include
            if(scrollTo || !scrollTo) {
            }
            if(imagesloaded || !imagesloaded) {
            }
            if(_string || !_string) {
            }
            if(KC || !KC) {
            }
            if(KS || !KS) {
            }
            this.hub = options.hub;
            this.$heading = options.$heading;
            this.$content = options.$content;
            this.scrollSampleRate = 100// 150 or higher was unable to pick up last event if scrolled quickly
            ;
            this.loadMoreThreshold = 30;
            this.cachedSector = '';
            this.reachedBottom = false;
            this.reachedTop = false;
            this.currentlyLoadingMore = false;
            this.shouldAppend = false;
            this.contentSelector = '.pane-content';
            this.displayType = '';
            this.tabularyHistorySelector = '.tabular-history';
            this.historyIndex = 0;
            this.modalSelector = '#' + api.TC.current().settings.modalId;
            this.scrollDuration = (api.TC.current().settings.effects) ? 300 : 0// scroll animation is buggy if set too high, disabled for vertical tabular scrolling
            ;
            this.pairedCodeInContext = [];
            this.codesToPost = [];
            this.debugInfiniteScroll = false;
            this.mode = TABULAR_MODE.NORMAL;
            this.pcsHeaders = [];
            this.listenForPCSResize = true;
            this.isPCSMovedRight = false;
            this.sharedProperties = options.sharedProperties;
            this.isShowingNoResults = false;
            this.hideResearch = options.hideResearch;
            this.targetDate = options.targetDate || '';
            this.model = new TVM.TabularViewModel();
            this.history = this.model.get('history');
            // It's efficient to compile these only once but due to the increasing amount of them
            // would it be better to compile them as needed instead? Or is now the time to switch to handlebars
            // and precompile all templates?
            this.templateWrapper = Templates.compile(Templates.tk_tabularWrapper, wrapperTemplate);
            this.templateIndex = Templates.compile(Templates.tk_tabularIndex, indexTemplate);
            this.templateTabular = Templates.compile(Templates.tk_tabularTabular, tabularTemplate);
            this.templateTabularCrosswalk = Templates.compile(Templates.tk_tabularTabularCrosswalk, tabularTemplateCrosswalk);
            this.templateTabularCPT = Templates.compile(Templates.tk_tabularTabularCPT, tabularTemplateCPT);
            this.templateTabularHCPCS = Templates.compile(Templates.tk_tabularTabularHCPCS, tabularTemplateHCPCS);
            this.templateTabularPCSWrapper = Templates.compile(Templates.tk_tabularPCSWrapper, tabularTemplatePCSWrapper);
            this.templateTabularPCSColumnHead = Templates.compile(Templates.tk_tabularPCSColumnHead, tabularTemplatePCSColumnHead);
            this.templateTabularPCSColumnChoices = Templates.compile(Templates.tk_tabularPCSColumnChoices, tabularTemplatePCSColumnChoices);
            this.templateDrug9Heading = Templates.get(Templates.tk_drugHeading, drug9HeadingTemplate);
            this.templateDrug10Heading = Templates.get(Templates.tk_drugHeading, drug10HeadingTemplate);
            this.templateHypertensionHeading = Templates.get(Templates.tk_hypertensionHeading, hypertensionHeadingTemplate);
            this.templateNeoplasmHeading = Templates.get(Templates.tk_neoplasmHeading, neoplasmHeadingTemplate);
            this.templateInstructionalNote = Templates.compile(Templates.tk_instructionalNote, instructionalNoteTemplate);
            this.templateLoading = Templates.get(Templates.tk_loadingLarge, loadingTemplate);
            this.templateModifiers = Templates.compile(Templates.tk_modifiers, modifiersTemplate);
            this.templateCPTModal = Templates.compile(Templates.tk_cptImageModal, cptModalTemplate);
            this.events = {
                'keypress .pcsHelper': 'pcsKeypressHandler',
                'keydown .pcsHelper': 'pcsKeydownHandler',
                'click .pcs': 'pcsClick',
                'click .pcs-column-choices div div': 'selectPCSItem',
                'click .pcs-column-choices div div .icon-enter': 'selectPCSItem',
                'click .pcs-column-head .icon-left-small': 'movePCSClick',
                'click .pcs-column-head .icon-right-small': 'movePCSClick',
                'click': 'tcSetFocus',
                'click .tabular-result': 'selectItem',
                'click .tabular-result .code': 'selectItem',
                'click .tabular-result .seeAlsoLink': 'selectItem',
                'click .tabular-history': 'navigateHistory',
                'click .img-icon': 'showImage',
                'click .inote-icon': 'getInstructionalNotes',
                'click .toggle-seven': 'toggleSeventhCharCodeDisplay',
                'mouseenter .bracketed': 'bracketedAlsoHighlightsPrimaryCode',
                'mouseleave .bracketed': 'bracketedAlsoHighlightsPrimaryCodeStop',
                'click a.modifier': 'modifierClick'
            };
            // 'click .instructional-note-content a': 'instructionalNoteCodeClick' // cannot be delegated as its outside of this.el's scope, see this.showInstructionalNotes
            // 'scroll': 'loadMore' // does not bubble, see this.enableScrollHandler and callers
            this.scopeName = 'codebooks:tabular';
            this.shortcuts = {
                'up codebooks:tabular': 'moveArrow',
                'down codebooks:tabular': 'moveArrow',
                'left codebooks:tabular': 'moveArrow',
                'right codebooks:tabular': 'moveArrow',
                'enter codebooks:tabular': 'handleEnter'
            };
                _super.call(this, options);
        }
        TabularView.prototype.initialize = function (options) {
            this.tcInit();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.throttleFunc = _.throttle(this.loadMore, this.scrollSampleRate);
            this.listenTo(this.model, 'change:history', this.setHistoryButtons);
            this.listenTo(this.hub, Events.CodeBooksFocusTabular, this.tcSetFocus);
            this.listenTo(this.hub, Events.CodeBooksSearch, this.clear);
            this.listenTo(this.hub, Events.CodeBooksClear, this.clearWithoutLoading);
            this.listenTo(this.hub, Events.CodeBooksGetTabular, this.search);
            this.listenTo(this.hub, Events.ResearchCodeSelected, this.searchByCodeSelected);
            this.listenTo(this.hub, Events.CodeBooksSearchComplete, this.findSequence);
            this.listenTo(this.hub, Events.CodeBooksSearchNoResults, this.onNoSearchResults);
            this.listenTo(this.hub, Events.CodeBooksGetCrosswalk, this.getCrosswalk);
            this.listenTo(this.hub, Events.CodeBooksCodePosted, this.clearPostedCodes);
            this.listenTo(this.hub, Events.CodeBooksSearch, this.clearPostedCodes);
            this.listenTo(this.hub, Events.CodeBooksSearch, this.onSearch);
            this.listenTo(this.hub, Events.CodeBooksSetCodePair, this.setPairedCode);
            this.listenTo(this.hub, Events.CodeBooksChangeBookdate, this.onUpdateTargetDate);
            this.listenTo(this.hub, Events.CodeBooksResizeBottom, this.resizePCSColumns);
            this.listenTo(this.hub, Events.CodeBooksGetICD10PCSTableData, this.getPCSCodeTableData);
            this.listenTo(this.hub, Events.CodeBooksListModifiers, this.getModifiers);
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                this.debugHistory = _.bind(function () {
                    return this.history;
                }, this);
            }
        };
        TabularView.prototype.onUpdateTargetDate = function (event) {
            this.targetDate = event.bookdate;
        };
        TabularView.prototype.navigateHistory = //#region History
        function (e) {
            var $target = $(e.currentTarget), options;
            if(!$target.hasClass('disabled')) {
                if($target.hasClass('tabular-back')) {
                    if(this.historyIndex > 0 && !this.isShowingNoResults) {
                        this.historyIndex--;
                    }
                } else {
                    if(this.historyIndex < this.history.length - 1) {
                        this.historyIndex++;
                    }
                }
                options = this.history[this.historyIndex];
                options.isHistoryEvent = true;
                if(options.isPCS) {
                    this.hub.trigger(Events.CodeBooksGetICD10PCSTableData, options);
                } else if(options.code) {
                    this.hub.trigger(Events.CodeBooksGetCrosswalk, options);
                } else {
                    this.hub.trigger(Events.CodeBooksGetTabular, options);
                }
            }
        };
        TabularView.prototype.addHistory = function (data, last) {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[tabular:history] addHistory');
            }
            // we only care about two things, sequence and book
            // ...until crosswalk came along
            var mergedData = $.extend({
            }, {
                sequence: null,
                code: null,
                isPCS: false,
                date: null
            }, data);
            var dataToInsert = {
                sequence: mergedData.sequence,
                book: mergedData.book || mergedData.code_type,
                code: mergedData.code,
                isPCS: mergedData.isPCS,
                date: mergedData.date || this.targetDate
            }, shouldChange = false;
            // add to current index if isn't already equal to what we're adding, give precedence to other conditions
            if(typeof last === 'string') {
                if(this.history.length > 0) {
                    shouldChange = true;
                }
                // if not operating at the tail of the array rewrite the history from this point forward
                            } else if(this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
                shouldChange = true;
                // operating at the tail, act like 'last'
                            } else {
                if(this.history.length >= 0) {
                    shouldChange = true;
                }
            }
            if(shouldChange) {
                if(_.isEqual(this.history[this.historyIndex], dataToInsert) === false) {
                    this.history.push(dataToInsert);
                }
                this.historyIndex = this.history.length - 1;
            }
            this.model.trigger('change:history');
        };
        TabularView.prototype.setHistoryButtons = function () {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[tabular:history] changed');
            }
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[tabular:history] index: ' + this.historyIndex + ', historyLength: ' + this.history.length);
            }
            // check current history position and enable/disable forward button
            if(this.historyIndex > 0) {
                this.$heading.find('.tabular-back').removeClass('disabled k-state-disabled');
            } else {
                this.$heading.find('.tabular-back').addClass('disabled k-state-disabled');
            }
            // check current history position and enable/disable forward button
            if(this.historyIndex < this.history.length - 1) {
                this.$heading.find('.tabular-forward').removeClass('disabled k-state-disabled');
            } else {
                this.$heading.find('.tabular-forward').addClass('disabled k-state-disabled');
            }
        };
        TabularView.prototype.pushSelectedItemToHistory = /** */
        function () {
            var selectionDetails = this.getSelectionDetails();
            if(selectionDetails) {
                this.addHistory(selectionDetails, 'last');
            }
        };
        TabularView.prototype.getSelectionDetails = function () {
            var $item = this.$content.find('.item-selected'), sequence = null, id, book, date;
            if($item.hasClass('tabular-crosswalk-result')) {
                return null;
            }
            if($item.length === 1) {
                sequence = $item.attr('data-sequence');
                if(sequence === null || sequence === undefined) {
                    id = $item.attr('id');
                    sequence = (typeof id === 'string') ? id.replace('tabular-', '') : '';
                }
                book = $item.attr('data-book');
                date = $item.attr('data-date');
                return {
                    sequence: sequence,
                    book: book,
                    date: date
                };
            }
            return null;
        };
        TabularView.prototype.onSearch = //#endregion
        //#region Search
        /** */
        function (e) {
            this.isShowingNoResults = false;
        };
        TabularView.prototype.onNoSearchResults = /** */
        function () {
            this.clearWithoutLoading();
            this.isShowingNoResults = true;
            this.setHistoryButtons();
        };
        TabularView.prototype.searchByCodeSelected = /**
        * @listens Events.CodeSelected
        */
        function (event) {
            var getTabularOptions;
            if(event.pane === 'research') {
                getTabularOptions = {
                    book: event.codeType,
                    term: event.code
                };
                this.hub.trigger(Events.CodeBooksGetTabular, getTabularOptions);
            }
        };
        TabularView.prototype.search = /**
        * @listens Events.EncoderGetTabular
        */
        function (event) {
            var detailOptions, searchOptions, isHistoryEvent = (typeof event.isHistoryEvent !== 'undefined' && event.isHistoryEvent);
            if(this.mode !== TABULAR_MODE.NORMAL) {
                if(this.mode === TABULAR_MODE.PCS) {
                    this.cleanupPCSColumns();
                }
                this.mode = TABULAR_MODE.NORMAL;
            }
            // cache the book for infinite scroll
            this.cachedBook = event.book;
            this.shouldAppend = (typeof event.append !== 'undefined' && event.append);
            this.setLoading(true);
            this.isShowingNoResults = false;
            if(event.sequence) {
                // cache the sequence for reference during show results
                this.cachedSequence = event.sequence;
                this.cachedSector = event.sector;
                detailOptions = {
                    sequence: event.sequence,
                    book: event.book,
                    sector: event.sector,
                    records: event.records,
                    date: event.date
                };
                net.Net.tryAbort(this.currentReq);
                this.currentReq = api.TC.current()._net.codebooksGetDetail(detailOptions, this.render, this.handleError);
                if(!this.shouldAppend && !isHistoryEvent) {
                    this.addHistory(detailOptions);
                }
            } else {
                // cache the term for reference during silent search
                this.cachedTerm = event.term;
                searchOptions = {
                    book: event.book,
                    term: event.term
                };
                if(event.options) {
                    searchOptions.options = event.options;
                }
                if(this.targetDate.length) {
                    searchOptions.date = this.targetDate;
                }
                net.Net.tryAbort(this.currentReq);
                this.currentReq = api.TC.current()._net.codebooksSearch(searchOptions, this.proxySearchResults, this.handleError);
            }
        };
        TabularView.prototype.proxySearchResults = /**
        * @triggers Events.EncoderSearchResultProxy
        */
        function (ajaxData) {
            // re-use searchbar's data processing yet suppress typical search events
            // also provide the silent term that was clicked as search typically pulls from
            // the searchbar
            var userData = {
                isSilent: true,
                term: this.cachedTerm
            };
            this.hub.trigger(Events.CodeBooksSearchResultProxy, ajaxData, userData);
        };
        TabularView.prototype.findSequence = /**
        * When there are index results the index view will trigger a GetTabular event.
        * When there are no index results this method is required to trigger GetTabular.
        *
        * @listens Events.CodebooksSearchComplete
        * @triggers Events.EncoderGetTabular
        */
        function (event) {
            var getTabularOptions;
            var shouldGetTabular = event.records.length > 0, record, book;
            // Trigger get tabular for all isSilent searches (see also links)
            // and for non-silent searches only trigger if this was code search since term searches will be picked up by index's auto-click action
            if(shouldGetTabular && !event.isSilent) {
                shouldGetTabular = event.type === 'Code';
            }//event.records.first().get('record') === undefined ||
            
            if(shouldGetTabular) {
                record = event.records.first();
                getTabularOptions = {
                    sequence: record.get('data_sequence'),
                    book: record.get('data_book'),
                    term: event.term,
                    date: record.get('data_date')
                };
                this.hub.trigger(Events.CodeBooksGetTabular, getTabularOptions);
            }
        };
        TabularView.prototype.clearPostedCodes = //#endregion
        //#region Code posting/bracketed codes
        function (event) {
            this.pairedCodeInContext = [];
            this.codesToPost = [];
        };
        TabularView.prototype.bracketedAlsoHighlightsPrimaryCode = /** */
        function (event) {
            var $target = $(event.currentTarget);
            $target.parent().find('.code-active').removeClass('code-active');
            $target.addClass('code-active').parent().find('.primary-code:first').addClass('code-active');
        };
        TabularView.prototype.bracketedAlsoHighlightsPrimaryCodeStop = /** */
        function (event) {
            var $target = $(event.currentTarget);
            $target.parent().find('.code-active').removeClass('code-active');
        };
        TabularView.prototype.setPairedCode = /** */
        function (event) {
            this.pairedCodeInContext = [
                event.primaryCode, 
                event.secondaryCode
            ];
        };
        TabularView.prototype.moveArrowNormal = //#endregion
        //#region Item selection & keyboard actions
        function (keymasterEvent) {
            // find currently selected
                        var $selectedRow = this.$content.find('.item-selected'), $selectedCode = $selectedRow.find('.code:focus'), rowAction = false, codeAction = false, focusDirection = 'center';
            // remove highlighted code before moving anywhere
            $selectedRow.find('.code-active').removeClass('code-active');
            // navigate
            switch(keymasterEvent.key) {
                case 'up':
                    rowAction = true;
                    focusDirection = 'top';
                    $selectedRow = $selectedRow.prevAll('.selectable:first');
                    break;
                case 'down':
                    rowAction = true;
                    focusDirection = 'bottom';
                    $selectedRow = $selectedRow.nextAll('.selectable:first');
                    break;
                case 'left':
                    if($selectedRow.hasClass('seven-char-parent')) {
                        $selectedRow.find('.k-minus').click();
                    } else {
                        codeAction = true;
                        if($selectedCode.length === 1) {
                            $selectedCode = $selectedCode.prevAll('.code:first');
                            if($selectedCode.hasClass('bracketed')) {
                                $selectedRow.find('.primary-code:first').addClass('code-active');
                            }
                        }
                    }
                    break;
                case 'right':
                    if($selectedRow.hasClass('seven-char-parent')) {
                        $selectedRow.find('.k-plus').click();
                    } else {
                        codeAction = true;
                        if($selectedCode.length === 0) {
                            $selectedCode = $selectedRow.find('.code:first');
                        } else {
                            $selectedCode = $selectedCode.nextAll('.code:first');
                        }
                        if($selectedCode.hasClass('bracketed')) {
                            $selectedRow.find('.primary-code:first').addClass('code-active');
                        }
                    }
                    break;
                default:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[tabular:moveArrowNormal] Unknown key sequence!');
                    }
                    break;
            }
            if(rowAction) {
                if($selectedRow.length === 1) {
                    this.focusEntry($selectedRow, false, focusDirection);
                }
            }
            if(codeAction) {
                if($selectedCode.length === 1) {
                    dom.focusWithoutWindowScroll($selectedCode);
                }
            }
        };
        TabularView.prototype.selectPCSItem = function (event) {
            var that = this, $target = $(event.currentTarget), $activeColumn = $target.closest('.pcs-column'), $columns = $target.closest('.pcs-inner').find('.pcs-column'), charIndex = parseInt($activeColumn.attr('data-col'), 10), code = this.model.get('pcsCodeBuilder').slice(0, charIndex - 1), isFirstCol = charIndex === 1, cancelUpdate = false, getPCSOptions;
            if(isFirstCol || !$target.hasClass('spacer')) {
                if(isFirstCol) {
                    // section column
                    cancelUpdate = true;
                    $target = $target.closest('div');
                    code = $target.find('a').text();
                    event.stopPropagation();
                    getPCSOptions = {
                        code: [
                            code
                        ]
                    };
                    if(code.length) {
                        this.hub.trigger(Events.CodeBooksGetICD10PCSTableData, getPCSOptions);
                    }
                } else {
                    // other columns
                    code.push($target.find('a').text());
                }
            }
            this.$('.pcs-column.active').toggleClass('active inactive');
            $activeColumn.toggleClass('active inactive').find('.item-selected').removeClass('item-selected').removeAttr('aria-selected').addClass('not-selected');
            $target.addClass('item-selected').attr('aria-selected', 'true').removeClass('not-selected');
            $columns.each(function (idx, el) {
                if(idx > charIndex) {
                    $(el).find('.pcs-column-choices div div').remove();
                }
                if(charIndex === 1 && idx === charIndex) {
                    if($target.find('span').text() === that.pcsData.section_title) {
                        $(el).find('.pcs-column-choices > div > *').show();
                    } else {
                        $(el).find('.pcs-column-choices > div > *').hide();
                    }
                }
                return this;
            });
            if(!cancelUpdate) {
                this.updatePCSCodeBuilder(code, false, true, false);
            }
            this.focusPCSHelper();
        };
        TabularView.prototype.moveArrowPCS = function (keymasterEvent) {
            var $activeColumn = this.$('.pcs-column.active'), $activeRow = $activeColumn.find('.k-state-focused').length > 0 ? $activeColumn.find('.k-state-focused') : $activeColumn.find('.item-selected'), charIndex = parseInt($activeColumn.attr('data-col'), 10), code = this.model.get('pcsCodeBuilder').slice(0), movingForward = // slice to make a clone instead of operating on the ref
            false, stayInPreviousColumn, afterRedraw = null, cancelUpdate = false, $newRow, getPCSOptions, $columns, $choicesInColumn, rowIndex, keypressChar, temp, codePostedData = {
                codes: []
            }, codeToPost;
            if(keymasterEvent.keyHelper) {
                keypressChar = String.fromCharCode(keymasterEvent.keyHelper).toUpperCase();
                $choicesInColumn = $activeColumn.find('.pcs-column-choices div div');
                $choicesInColumn.each(function (idx, el) {
                    var $el = $(el);
                    if($el.find('a').text() === keypressChar) {
                        $activeRow.removeClass('item-selected').removeAttr('aria-selected').addClass('not-selected');
                        dom.focusWithoutWindowScroll($el.addClass('item-selected').attr('aria-selected', 'true').removeClass('not-selected').find('a'));
                        code[charIndex - 1] = $el.find('a').text();
                        keymasterEvent.key = 'hotkey';
                    }
                });
            }
            // navigate
            switch(keymasterEvent.key) {
                case 'up':
                    $choicesInColumn = $choicesInColumn || $activeColumn.find('.pcs-column-choices div div');
                    stayInPreviousColumn = charIndex < 7;
                    if($choicesInColumn.index($activeRow) > 0) {
                        if(charIndex === 1) {
                            $newRow = $activeRow.removeClass('k-state-focused').addClass('not-selected').prev();
                            temp = dom.focusWithoutWindowScroll($newRow.addClass('k-state-focused').removeClass('not-selected').find('a'));
                        } else {
                            $newRow = $activeRow.removeClass('item-selected').removeAttr('aria-selected').addClass('not-selected').prev();
                            temp = dom.focusWithoutWindowScroll($newRow.addClass('item-selected').attr('aria-selected', 'true').removeClass('not-selected').find('a'));
                        }
                        if(temp.length === 0) {
                            // this is a spacer
                            stayInPreviousColumn = false;
                            code.pop();
                            $activeRow.closest('.pcs-column-choices').scrollTo(0);
                        } else {
                            code[charIndex - 1] = temp.text();
                        }
                    } else {
                        cancelUpdate = true;
                    }
                    break;
                case 'down':
                    $choicesInColumn = $choicesInColumn || $activeColumn.find('.pcs-column-choices div div');
                    stayInPreviousColumn = charIndex < 7;
                    if($choicesInColumn.index($activeRow) < $choicesInColumn.length - 1) {
                        if(charIndex === 1) {
                            $newRow = $activeRow.removeClass('k-state-focused').addClass('not-selected').next();
                            code[charIndex - 1] = dom.focusWithoutWindowScroll($newRow.addClass('k-state-focused').removeClass('not-selected').find('a')).text();
                        } else {
                            $newRow = $activeRow.removeClass('item-selected').removeAttr('aria-selected').addClass('not-selected').next();
                            code[charIndex - 1] = dom.focusWithoutWindowScroll($newRow.addClass('item-selected').attr('aria-selected', 'true').removeClass('not-selected').find('a')).text();
                        }
                    } else {
                        cancelUpdate = true;
                    }
                    break;
                case 'backspace':
                case 'left':
                    if(charIndex > 1) {
                        stayInPreviousColumn = true;
                        $columns = $activeColumn.closest('.pcs-inner').find('.pcs-column');
                        $activeColumn.toggleClass('active inactive').find('.item-selected').removeClass('item-selected').addClass('not-selected');
                        $columns.eq(charIndex - 2).toggleClass('active inactive');
                        if(charIndex <= 6) {
                            $columns.eq(charIndex).find('.pcs-column-choices div div').remove();
                        }
                        // only pop if we weren't on the "spacer" row
                        if(code.length === charIndex) {
                            code.pop();
                        }
                    } else {
                        cancelUpdate = true;
                    }
                    break;
                case 'enter':
                case 'right':
                    if(charIndex < 7 && !$activeRow.hasClass('spacer')) {
                        movingForward = true;
                        $columns = $activeColumn.closest('.pcs-inner').find('.pcs-column');
                        $activeColumn.toggleClass('active inactive');
                        $choicesInColumn = $columns.eq(charIndex).toggleClass('active inactive').find('.pcs-column-choices div div');
                        $choicesInColumn.filter('.item-selected').removeClass('item-selected').removeAttr('aria-selected').addClass('not-selected');
                        if($choicesInColumn.length === 2) {
                            temp = $choicesInColumn.eq(1).addClass('item-selected').attr('aria-selected', 'true').removeClass('not-selected');
                            code.push(temp.find('a').text());
                        } else {
                            $choicesInColumn.eq(0).addClass('item-selected').attr('aria-selected', 'true').removeClass('not-selected');
                        }
                        if(charIndex === 1) {
                            temp = $activeColumn.find('.k-state-focused');
                            if(temp.length) {
                                // remove old active item styling
                                $activeColumn.find('.item-selected').removeClass('item-selected').removeAttr('aria-selected').addClass('not-selected');
                                // add active styling to focused
                                temp.removeClass('k-state-focused').addClass('item-selected').attr('aria-selected', 'true');
                            }
                            temp = $activeColumn.find('.item-selected a').text();
                            if(temp) {
                                code = [
                                    temp
                                ];
                            }
                        }
                    } else {
                        cancelUpdate = true;
                        // don't allow posting with 'right'
                        if(keymasterEvent.key === 'enter') {
                            codeToPost = {
                                code: code,
                                codeType: 'ICD10PCS_PR'
                            };
                            codePostedData.codes = [
                                codeToPost
                            ];
                            this.hub.trigger(Events.CodeBooksCodePosted, codePostedData);
                        }
                    }
                    break;
                case 'hotkey':
                    // don't move forward for the section column
                    movingForward = charIndex !== 1;
                    break;
                default:
                    cancelUpdate = true;
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[tabular:moveArrowPCS] Unknown key sequence!');
                    }
                    break;
            }
            // if section column  and possibly get data
            if(charIndex === 1) {
                cancelUpdate = true;
                if(!movingForward) {
                    // hide the next column choices to indicate they aren't loaded
                    if($newRow && $newRow.find('span').text() === this.pcsData.section_title) {
                        $activeColumn.closest('.pcs-inner').find('.pcs-column').eq(1).find('.pcs-column-choices > div div').show();
                    } else {
                        $activeColumn.closest('.pcs-inner').find('.pcs-column').eq(1).find('.pcs-column-choices > div div').hide();
                    }
                } else {
                    getPCSOptions = {
                        code: code
                    };
                    this.hub.trigger(Events.CodeBooksGetICD10PCSTableData, getPCSOptions);
                }
            }
            // if section column do not update
            if(!cancelUpdate) {
                this.updatePCSCodeBuilder(code, stayInPreviousColumn, movingForward, true);
            }
            // restore focus to key helper
            this.focusPCSHelper();
        };
        TabularView.prototype.moveArrow = function (e, keymasterEvent) {
            $.event.fix(e).preventDefault();
            switch(this.mode) {
                case TABULAR_MODE.NORMAL:
                    this.moveArrowNormal(keymasterEvent);
                    break;
                default:
                    break;
            }
        };
        TabularView.prototype.pcsKeypressHandler = function (event) {
            if(this.mode === TABULAR_MODE.PCS && ((event.which >= 48 && event.which <= 90) || (event.which >= 97 && event.which <= 122))) {
                if(!event.altKey && !event.metaKey && !event.ctrlKey) {
                    event.preventDefault();
                    this.moveArrowPCS({
                        keyHelper: event.which
                    });
                }
            }
        };
        TabularView.prototype.pcsKeydownHandler = function (event) {
            var map = {
                8: 'backspace',
                13: 'enter',
                37: 'left',
                38: 'up',
                39: 'right',
                40: 'down'
            };
            if(this.mode === TABULAR_MODE.PCS && map[event.which] && !event.altKey && !event.metaKey && !event.ctrlKey) {
                event.preventDefault();
                this.moveArrowPCS({
                    key: map[event.which]
                });
            }
        };
        TabularView.prototype.selectItem = /**
        * @triggers Events.EncoderGetTabular
        * @triggers Events.ResearchClear
        * @triggers Events.ResearchCodeInContext
        */
        function (e) {
            var that = this, $target = $(e.currentTarget), didClickCode = $target.hasClass('code'), didClickSeeAlso = $target.hasClass('seeAlsoLink'), $originalTarget = $target, hasDefaultCode = false, isBracketed = false, shouldTakeTargetText = false, codePostedData = {
                codes: []
            }, isTrimmed7CharCode = $originalTarget.hasClass('trimmed'), codeType = $originalTarget.attr('data-code-type'), searchOptions = $originalTarget.attr('data-ref-options') || 'Ref', cancelTabularLoad = false, $bracketed, isPrimaryCode, isSelectable, $defaultTarget, termOrCode, _book, getTabularOptions, getPCSTabularOptions, codeInContextData, codeToPost, date;
            // change the target to the parent
            if(didClickCode || didClickSeeAlso) {
                $target = $target.closest('.tabular-result');
                shouldTakeTargetText = didClickSeeAlso || $target.hasClass('type-instructionalnote') || $target.hasClass('type-codeentryline') || $target.hasClass('tabular-crosswalk-result') || $target.hasClass('type-sectionline') || $target.hasClass('tabular-table');
                isPrimaryCode = $originalTarget.hasClass('primary-code');
                termOrCode = (isPrimaryCode || shouldTakeTargetText || didClickSeeAlso) ? $originalTarget.text() : $target.find('.primary-code:first').text();
                termOrCode = termOrCode.replace(/\-$/g, '');
                $bracketed = $target.find('.bracketed');
                isBracketed = $bracketed.length > 0;
                if(isBracketed) {
                    // when inside a tablerow only queue a code if the originalTarget is bracketed
                    if($target.hasClass('type-tablerowchannelpublishing') || $target.hasClass('type-tablerow')) {
                        if($originalTarget.hasClass('bracketed')) {
                            termOrCode = $originalTarget.attr('data-paired-code');
                            this.pairedCodeInContext = [
                                termOrCode, 
                                $originalTarget.text().replace(/\-$/g, '')
                            ];
                        }
                    } else {
                        this.pairedCodeInContext = [
                            termOrCode, 
                            $bracketed.text().replace(/\-$/g, '')
                        ];
                    }
                }
                // for research pane updates
                $defaultTarget = $target.find('.default-target:first');
                if($defaultTarget.hasClass('code')) {
                    hasDefaultCode = true;
                }
                // cross browser stop propagation handled by jQuery
                e.stopPropagation();
            } else {
                // see if there is a default-target code available instead
                // for updating the research pane
                $defaultTarget = $target.find('.default-target:first');
                if($defaultTarget.hasClass('code')) {
                    hasDefaultCode = true;
                    termOrCode = $defaultTarget.text();
                    termOrCode = termOrCode.replace(/\-$/g, '');
                }
            }
            isSelectable = $target.hasClass('selectable');
            _book = $target.attr('data-book');
            codeType = codeType || _book.replace('_TABULAR', '').replace('_INDEX', '');
            date = $target.attr('data-date');
            // fire code in context
            if(isSelectable) {
                this.hub.trigger(Events.ResearchClear, {
                    book: codeType
                });
            }
            if(_book.indexOf('_TABULAR') !== -1 && hasDefaultCode && isSelectable) {
                codeInContextData = {
                    book: codeType,
                    code: termOrCode
                };
                this.hub.trigger(Events.ResearchCodeInContext, codeInContextData);
            }
            if(isSelectable) {
                this.focusEntry($target, true);
            }
            // if they clicked a code reload the tabular accordingly
            // but not if it is the primary code or the display is the tabular
            // (it would reload almost the same exact data)
            if((didClickCode || didClickSeeAlso) && !isTrimmed7CharCode && termOrCode && codeType && (this.displayType !== 'tabular' || isPrimaryCode === false)) {
                if(codeType.indexOf('ICD10PCS') !== -1 && didClickCode) {
                    // PCS codes
                    getPCSTabularOptions = {
                        code: termOrCode
                    };
                    this.hub.trigger(Events.CodeBooksGetICD10PCSTableData, getPCSTabularOptions);
                } else {
                    // Other
                    this.pushSelectedItemToHistory();
                    getTabularOptions = {
                        term: termOrCode,
                        book: codeType,
                        options: searchOptions,
                        date: date
                    };
                    this.hub.trigger(Events.CodeBooksGetTabular, getTabularOptions);
                }
            } else if(didClickCode && termOrCode && this.displayType === 'tabular') {
                // if this isn't a specific code stay where we are
                if($target.hasClass('type-mainentry')) {
                    cancelTabularLoad = true;
                }
                if(!cancelTabularLoad) {
                    if(this.pairedCodeInContext.length > 0) {
                        // code pair in context
                        if(this.codesToPost.length === 0) {
                            // check if code start-matches first code in pair
                            if(termOrCode.slice(0, this.pairedCodeInContext[0].length) === this.pairedCodeInContext[0]) {
                                this.codesToPost.push({
                                    code: termOrCode,
                                    codeType: codeType
                                });
                                getTabularOptions = {
                                    term: this.pairedCodeInContext[1],
                                    book: codeType,
                                    options: searchOptions,
                                    date: date
                                };
                                this.hub.trigger(Events.CodeBooksGetTabular, getTabularOptions);
                            } else {
                                Modal.confirm({
                                    title: 'Are you sure?',
                                    htmlContent: '<p>You selected an Index entry with code <strong>' + this.pairedCodeInContext[0] + '</strong>, but selected <strong>' + termOrCode + '</strong> from the Tabular.  If you post this code, the paired code <strong>' + this.pairedCodeInContext[1] + '</strong> will not be posted.</p>',
                                    confirm: function () {
                                        codeToPost = {
                                            code: termOrCode,
                                            codeType: codeType
                                        };
                                        codePostedData.codes = [
                                            codeToPost
                                        ];
                                        that.hub.trigger(Events.CodeBooksCodePosted, codePostedData);
                                    }
                                });
                            }
                        } else {
                            // check if second code exactly matches second code in pair
                            if(termOrCode.slice(0, this.pairedCodeInContext[1].length) === this.pairedCodeInContext[1]) {
                                this.codesToPost.push({
                                    code: termOrCode,
                                    codeType: codeType
                                });
                                codePostedData.codes = this.codesToPost;
                                this.hub.trigger(Events.CodeBooksCodePosted, codePostedData);
                            } else {
                                Modal.confirm({
                                    title: 'Are you sure?',
                                    htmlContent: '<p>You selected an Index entry with paired-code <strong>' + this.pairedCodeInContext[1] + '</strong>, but selected <strong>' + termOrCode + '</strong> from the Tabular.  This may be inconsistent with the other codes in the encounter.</p>',
                                    confirm: function () {
                                        that.codesToPost.push({
                                            code: termOrCode,
                                            codeType: codeType
                                        });
                                        codePostedData.codes = that.codesToPost;
                                        that.hub.trigger(Events.CodeBooksCodePosted, codePostedData);
                                    }
                                });
                            }
                        }
                    } else {
                        // no code pair, post
                        codeToPost = {
                            code: termOrCode,
                            codeType: codeType
                        };
                        codePostedData.codes = [
                            codeToPost
                        ];
                        this.hub.trigger(Events.CodeBooksCodePosted, codePostedData);
                    }
                }
            }
        };
        TabularView.prototype.handleEnter = /** */
        function (e, keymasterEvent) {
            switch(this.mode) {
                case TABULAR_MODE.NORMAL:
                    var $activeEl = $(document.activeElement);
                    if($activeEl.closest('.trucode').length && !$activeEl.hasClass('code')) {
                        // don't prevent on naturally handled elements or it will incorrectly prevent
                        $.event.fix(e).preventDefault();
                        // default-target will be selected by default via focusEntry but if a user clicks away
                        // and loses focus this will allow enter to continue to function
                        this.$content.find('.item-selected').find('.default-target:first,.seeAlsoLink:first').click();
                    }
                    break;
                case TABULAR_MODE.PCS:
                    this.moveArrow.apply(this, arguments);
                    break;
                default:
                    break;
            }
        };
        TabularView.prototype.handleKeyUp = /** */
        function (event) {
            if(this.mode === TABULAR_MODE.NORMAL && (event.which === 38 || event.which === 40)) {
                var $row = this.$content.find('.item-selected');
                if($row.length) {
                    $row.click();
                }
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[tabular:keyup] Clicking: ' + $row.find('.code').text());
                }
            }
        };
        TabularView.prototype.showTableHeadings = /** Show headings for tables (table of drugs, etc) */
        function ($target) {
            var $table = $target.find('.table-wrapper'), tableType;
            if($table.length > 0 && $table.find('.code').length > 0) {
                var map = {
                    'drugs-chemicals': this.templateDrug9Heading,
                    'drugs-chemicals-icd10': this.templateDrug10Heading,
                    'hypertension': this.templateHypertensionHeading,
                    'neoplasm': this.templateNeoplasmHeading
                };
                tableType = $table.attr('data-table-type');
                if(tableType === 'drugs-chemicals' && this.cachedBook.indexOf('ICD10') !== -1) {
                    tableType = 'drugs-chemicals-icd10';
                }
                if(map[tableType]) {
                    var html = map[tableType];
                    $target.before(html);
                }
            }
        };
        TabularView.prototype.showImage = /** */
        function (e) {
            e.stopPropagation();
            var $target = $(e.currentTarget), imgPath = config.imageCdnPath() + $target.attr('data-image-name'), $img = $('<img src="' + imgPath + '" />'), title = $target.attr('title'), caption = $target.attr('data-image-caption'), modalHTML = this.templateCPTModal({
                imgPath: imgPath,
                title: title,
                caption: caption
            });
            $img.imagesLoaded({
                progress: function (isBroken, $allImages, $loadedImages, $brokenImages) {
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[tabular:images] ok: ' + $loadedImages.length + ', bad: ' + $brokenImages.length);
                    }
                    Modal.show({
                        title: 'Images',
                        htmlContent: '<p>Loading...</p>',
                        close: this.tcSetFocus,
                        open: this.tcClearFocus
                    });
                },
                done: function ($images) {
                    Modal.show({
                        title: 'Images',
                        htmlContent: modalHTML,
                        close: this.tcSetFocus,
                        open: this.tcClearFocus
                    });
                },
                fail: function () {
                    Modal.show({
                        title: 'Problem loading image',
                        htmlContent: '<p>There was a problem loading this image.</p>',
                        close: this.tcSetFocus,
                        open: this.tcClearFocus
                    });
                }
            });
        };
        TabularView.prototype.focusEntry = //#endregion
        //#region Focus
        /**
        * @triggers Events.SetWidgetFocus
        */
        function ($target, cancelScroll, howToFocus) {
            var $c = this.$content.find('.pane-content'), scrollOptions, elToFocus, shouldScroll = false, $full;
            // place the selected indicators
            $target.attr('aria-selected', 'true').addClass('item-selected').siblings('.item-selected').removeAttr('aria-selected').removeClass('item-selected').each(function (idx, el) {
                var $el = $(this);
                if($el.hasClass('seven-char')) {
                    $el.find('.full,.trimmed').toggleClass('invisible');
                    $el.find('.full').insertBefore($el.find('.trimmed'));
                }
                return this;
            });
            // clean up table headings
            this.$content.find('#column-labels').remove();
            if(!cancelScroll) {
                // scroll to view
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[tabular:scroll] Scrolling to view');
                }
                scrollOptions = {
                    duration: 0
                }// scroll animation is buggy
                ;
                switch(howToFocus) {
                    case 'center':
                        shouldScroll = true;
                        scrollOptions.offset = -1 * (this.contentHeight / 2);
                        if(typeof DEBUG !== 'undefined' && DEBUG) {
                            log('[tabular:scroll] Center scroll ' + scrollOptions.offset);
                        }
                        break;
                    case 'bottom':
                        if($c.scrollTop() - $target[0].offsetTop + this.contentHeight - 10 < 0) {
                            shouldScroll = true;
                            scrollOptions.offset = -1 * (this.contentHeight - $target.height());
                            if(typeof DEBUG !== 'undefined' && DEBUG) {
                                log('[tabular:scroll] Bottom scroll : ' + scrollOptions.offset);
                            }
                        }
                        break;
                    default:
                        // if scrollTo offset not set, it will by default scroll the target to the top of the content area
                        if($target[0].offsetTop - $c.scrollTop() < 0) {
                            shouldScroll = true;
                        }
                        break;
                }
                if(shouldScroll) {
                    $c.stop().scrollTo($target, scrollOptions);
                }
                $c.imagesLoaded({
                    progress: function (isBroken, $allImages, $loadedImages, $brokenImages) {
                        if(typeof DEBUG !== 'undefined' && DEBUG) {
                            log('[tabular:images] ok: ' + $loadedImages.length + ', bad: ' + $brokenImages.length);
                        }
                    },
                    done: function ($images) {
                        if(shouldScroll) {
                            $c.stop().scrollTo($target, scrollOptions);
                        }
                    }
                });
            }
            this.showTableHeadings($target);
            if($target.hasClass('seven-char')) {
                $full = $target.find('.full').removeClass('invisible');
                $full.next('.trimmed').addClass('invisible').insertBefore($full);
            }
            if(this.hasFocus()) {
                this.focusCode($target);
            }
            // update context bar
            this.$heading.find('.context').html($target.find('.short-text').html());
        };
        TabularView.prototype.getFocusElement = /** */
        function () {
            return this.$content;
        };
        TabularView.prototype.hasFocus = /** */
        function () {
            return this.$content.hasClass(config.activePaneClass);
        };
        TabularView.prototype.focusCode = /** */
        function ($target) {
            // focus element, if all else fails blur whatever used to be in context instead. keymaster will pick up from there
            dom.blurAll();
            var $toFocus = $target.find('.default-target:first');
            if(!$toFocus.length) {
                $toFocus = $target.find('.seeAlsoLink:first').attr('tabindex', '0');
            }
            dom.focusWithoutWindowScroll($toFocus);
        };
        TabularView.prototype.onSetFocus = /** */
        function (event) {
            // unbind if this namespace already exists to avoid duplicate handlers
            this.$content.off('.research');
            if(event.scopeName === this.scopeName) {
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log({
                        msg: '[tabular:keyup] Attaching keyup handler',
                        el: this.$content
                    });
                }
                this.$content.on('keyup.research', this.handleKeyUp);
            }
            if(this.mode === TABULAR_MODE.PCS) {
                this.focusPCSHelper();
            }
        };
        TabularView.prototype.onClearFocus = /** */
        function (event) {
            this.$content.off('.research');
        };
        TabularView.prototype.updatePCSCodeBuilder = //#endregion
        //#region ICD10 specific
        /** Often times the code array is a reference and the objects will be identical on .set, force a change event if necessary */
        function (code, stayInPreviousColumn, movingForward, keyboardEvent, isHistoryEvent) {
            var that = this, model = this.model.set('pcsCodeBuilder', code), labels = [], cancelSlide = false, definitionChoice, colIndex, $rows, pcsCodeUpdateOptions, getResearchOptions;
            if(!isHistoryEvent) {
                this.addHistory({
                    code: code.join(''),
                    isPCS: true
                }, 'last');
            }
            // update research pane as necessary
            if(code.length >= 3) {
                getResearchOptions = {
                    book: 'ICD10PCS_PR',
                    code: code.join('')
                };
                this.hub.trigger(Events.ResearchCodeInContext, getResearchOptions);
            }
            // force change event in case operating on reference
            if(!model.changed.pcsCodeBuilder) {
                this.model.trigger("change");
                this.model.trigger("change:pcsCodeBuilder");
            }
            // render
            this.renderPCSColumns(code, stayInPreviousColumn, movingForward, keyboardEvent);
            // event for index
            this.$('.pcs .item-selected span').each(function (idx, el) {
                if(idx === 2) {
                    definitionChoice = _.find(that.pcsData.columns[1].choices, function (o) {
                        return o.char === code[2];
                    });
                    if(definitionChoice) {
                        labels.push(definitionChoice.label + ': ' + definitionChoice.definition);
                    } else {
                        labels.push($(el).text());
                    }
                } else {
                    labels.push($(el).text());
                }
            });
            pcsCodeUpdateOptions = {
                code: code.join(''),
                headings: this.pcsHeaders,
                labels: labels
            };
            this.hub.trigger(Events.CodeBooksPCSCodeChanged, pcsCodeUpdateOptions);
            // Auto-select column choice if only 1 is available
            if(!stayInPreviousColumn && movingForward && code.length < 7) {
                $rows = this.$('.pcs-column.active').find('.pcs-column-choices div div');
                if($rows.length === 2) {
                    $rows.eq(1).click();
                }
            }
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[tabular:pcsCodeBuilder] ' + code.join(''));
            }
        };
        TabularView.prototype.pcsClick = function (event) {
            var $target = (event.currentTarget);
            this.focusPCSHelper();
        };
        TabularView.prototype.focusPCSHelper = function () {
            dom.focusWithoutWindowScroll(this.$('.pcsHelper'));
        };
        TabularView.prototype.setupICD10Toggles = /**
        * When viewing ICD10 tabulars (not PCS) 7 character code parents can be collapsed/expanded. This function sets up the collapse/expand.
        */
        function () {
            var bookUpper = this.cachedBook.toUpperCase(), $i107char = this.$('.seven-char'), $focusedItem = this.$('.item-selected');
            // ICD10: identify 7 char code parents for toggles
            if(bookUpper && bookUpper.indexOf('ICD10') !== -1 && $i107char.length) {
                $i107char.each(function (idx, el) {
                    var $el = $(el), lvl = parseInt($el.attr('data-level'), 10), $parent = $el.prevAll('.type-mainentry:first'), parentLvl = parseInt($parent.attr('data-level'), 10);
                    if(lvl > parentLvl) {
                        if(!$parent.hasClass('seven-char-parent')) {
                            $parent.addClass('seven-char-parent');
                            $parent.find('.codes').before('<span title="Toggle display of seventh characters for this code" class="k-icon k-plus toggle-seven"></span>');
                        }
                    }
                    return this;
                });
            }
            // Expand parent if focused entry is a 7 character code
            if(!this.shouldAppend && $focusedItem.hasClass('seven-char')) {
                $focusedItem.prevAll('.seven-char-parent:first').find('.k-plus').click();
                this.focusEntry($focusedItem, false, 'center');
            }
        };
        TabularView.prototype.toggleSeventhCharCodeDisplay = function (e) {
            var $target = $(e.currentTarget), isNextNotASevenChar = false, $toToggle;
            $target = $target.toggleClass('k-plus k-minus').closest('.tabular-result');
            isNextNotASevenChar = !$target.next().hasClass('seven-char');
            $toToggle = isNextNotASevenChar ? $target.nextUntil('.seven-char').nextUntil(':not(.seven-char)') : $toToggle = $target.nextUntil(':not(.seven-char)');
            $toToggle.toggle().toggleClass('selectable');
        };
        TabularView.prototype.resizePCSColumns = function (e) {
            if(this.mode === TABULAR_MODE.PCS) {
                this.listenForPCSResize = false;
                var $pcs = this.$content.find('.pcs-outer'), pcsWidth = $pcs.width(), colWidth = (pcsWidth / 4).toString() + 'px', splitter = $pcs.find('.pcs-inner').data('kendoSplitter'), $panesToResize = $pcs.find('.pcs-pane');
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[tabular:resizePCS] Resizing pcs columns');
                }
                $pcs.find('.pcs-inner').width(pcsWidth * 1.75);
                $panesToResize.each(function (idx, el) {
                    splitter.size($panesToResize.eq(idx), colWidth);
                });
                if(this.isPCSMovedRight) {
                    this.movePCSRight(true);
                } else {
                    this.movePCSLeft(true);
                }
                this.listenForPCSResize = true;
            }
        };
        TabularView.prototype.getPCSCodeTableData = /** Entry point for event that starts pcs tabular display. E.g.: search; index code click */
        function (event) {
            var code = event.code, needPCSData = true, fetchOptions = {
            };
            code = (typeof code === 'object') ? code.join('').toUpperCase() : code.toUpperCase();
            this.tcSetFocus();
            this.isShowingNoResults = false;
            if(!code.length) {
                needPCSData = false;
            } else if(this.mode === TABULAR_MODE.PCS && this.model.get('pcsCodeBuilder')[0] === code.charAt(0)) {
                // check if already in tabular mode and the cached tabledata is useable
                needPCSData = false;
            }
            this.mode = TABULAR_MODE.PCS;
            this.cachedBook = 'ICD10PCS_PR';
            this.$heading.html(this.templateWrapper({
                book: TextBook[this.cachedBook] || this.cachedBook,
                hideResearch: this.hideResearch
            }));
            if(code.length) {
                if(needPCSData) {
                    fetchOptions.code = code;
                    fetchOptions.isHistoryEvent = event.isHistoryEvent;
                    if(event.date) {
                        fetchOptions.date = event.date;
                    } else if(this.targetDate.length) {
                        fetchOptions.date = this.targetDate;
                    }
                    this.fetchPCSData(fetchOptions);
                } else {
                    this.updatePCSCodeBuilder(code.split(''), undefined, undefined, undefined, event.isHistoryEvent);
                }
            }
        };
        TabularView.prototype.fetchPCSData = function (event) {
            var getTableOptions, that = this, $activeColumn = this.$('.pcs-column.active'), $columns = $activeColumn.closest('.pcs-inner').find('.pcs-column');
            getTableOptions = {
                code: event.code.charAt(0),
                date: this.targetDate
            };
            net.Net.tryAbort(this.currentReq);
            $columns.eq(1).find('.pane-body').html(this.templateLoading);
            this.currentReq = api.TC.current()._net.codebooksGetPCSTable(getTableOptions, function (data) {
                that.handlePCSData(data, event.code.split(''), event.isHistoryEvent);
            });
        };
        TabularView.prototype.handlePCSData = function (data, code, isHistoryEvent) {
            var that = this;
            this.pcsData = data;
            this.pcsHeaders = [
                'Section'
            ];
            _.each(data.columns, function (col) {
                that.pcsHeaders.push(col.header);
            });
            this.updatePCSCodeBuilder(code, undefined, undefined, undefined, isHistoryEvent);
        };
        TabularView.prototype.getFilteredPCSData = function () {
            var newPcsData = $.extend(true, {
            }, this.pcsData), code = this.model.get('pcsCodeBuilder'), codeLen = code.length;
            // simplify columns
            _.each(newPcsData.columns, function (col) {
                if(col.index > codeLen) {
                    col.choices = [];
                }
            });
            // reduce choices
            for(var i = 0, l = newPcsData.columns.length; i < l; i++) {
                var choicesLength = newPcsData.columns[i].choices.length;
                for(var j = 0; j < choicesLength; j++) {
                    if(!this.matchAnyPrefix(newPcsData.columns[i].choices[j].prefixes)) {
                        delete newPcsData.columns[i].choices[j];
                    } else {
                        delete newPcsData.columns[i].choices[j].prefixes;
                    }
                }
            }
            return newPcsData;
        };
        TabularView.prototype.matchAnyPrefix = function (prefixes) {
            var prefixLength = prefixes.length;
            for(var i = 0; i < prefixLength; i++) {
                if(this.matchPrefix(prefixes[i])) {
                    return true;
                }
            }
            return false;
        };
        TabularView.prototype.matchPrefix = function (prefix) {
            for(var i = 0; i < prefix.length; i++) {
                if(prefix.charAt(i) !== '*' && prefix.charAt(i) !== this.model.get('pcsCodeBuilder')[i]) {
                    return false;
                }
            }
            return true;
        };
        TabularView.prototype.renderPCSColumns = function (code, stayInPreviousColumn, movingForward, keyboardEvent) {
            var previousCode = this.model.previous('pcsCodeBuilder'), compareCodes = _.zip(code, previousCode), $pcs = this.$('.pcs-inner'), j = 0, columnIndexToStartRendering = 2, codeLen = // worst case
            code.length, data = this.getFilteredPCSData(), isFirstTimeSetup = this.$('.pcs').length === 0, cancelSlide = false, renderForwardOnly = false, $cols, $rows, columnData;
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[pcs] Rendering pcs columns...');
            }
            // Setup splitters if first time or determine how many columns to re-render
            if(isFirstTimeSetup) {
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[pcs] First time setup...');
                }
                $pcs = this.pcsColumnsFirstTimeSetup(code);
            } else {
                // analyze previous code value and new one to smartly render only the required # of columns
                for(; j < codeLen; j++) {
                    if(compareCodes[j][0] !== compareCodes[j][1]) {
                        columnIndexToStartRendering = j + 1;
                        if(typeof keyboardEvent !== 'undefined' && !keyboardEvent) {
                            columnIndexToStartRendering++;
                        }
                        if(j === 0) {
                            columnIndexToStartRendering++;
                        }// bring back to worst case, no need to render first 2x
                        
                        break;
                    }
                }
                // no differences, only render to blank out following columns
                if(j === codeLen) {
                    if(movingForward && j + 1 === 7) {
                        // don't re-render anything as keyboard event is enter or
                        // right or mouse click is in last column, no change is needed
                        columnIndexToStartRendering = 99;
                    } else if(keyboardEvent && !stayInPreviousColumn && codeLen === 6) {
                        // keyboard event for 7th column spacer
                        columnIndexToStartRendering = 99;
                    } else {
                        columnIndexToStartRendering = j + 1;
                        renderForwardOnly = true;
                    }
                }
            }
            // Remove active column class from all columns except last
            $cols = $pcs.find('.pcs-column');
            $cols.each(function (idx) {
                if(idx !== 6) {
                    $cols.eq(idx).removeClass('active').addClass('inactive');
                }
            });
            // Render columns
            if(isFirstTimeSetup || code[0] !== previousCode[0]) {
                this.renderPCSColumn(code, 1, $cols, null, data.section_title);
            }
            while(columnIndexToStartRendering <= 7) {
                columnData = (columnIndexToStartRendering >= 2) ? data.columns[columnIndexToStartRendering - 2] : null;
                this.renderPCSColumn(code, columnIndexToStartRendering, $cols, columnData, data.section_title, stayInPreviousColumn);
                columnIndexToStartRendering++;
            }
            if(renderForwardOnly && stayInPreviousColumn) {
                $cols.eq(j - 1).removeClass('inactive').addClass('active');
            }
            if(!stayInPreviousColumn && code.length === 7) {
                $cols.eq(6).removeClass('inactive').addClass('active');
            }
            this.setHistoryButtons();
            // make sure bottom padding is set
            if(isFirstTimeSetup) {
                this.$el.data('kendoSplitter').trigger('layoutChange');
                this.$el.find('.pcs-inner').data('kendoSplitter').trigger('resize');
            }
            // Determine which 4 columns should be visible
            if(codeLen === 3) {
                if(previousCode.length === 4) {
                    if(parseInt(this.$('.pcs-column.active').attr('data-col'), 10) === 4) {
                        this.movePCSRight(true);
                    } else {
                        this.movePCSLeft();
                    }
                } else if(movingForward) {
                    this.movePCSRight();
                }
            } else {
                if(codeLen < 3) {
                    this.movePCSLeft(true);
                } else {
                    this.movePCSRight(true);
                }
            }
            // Re-focus the input box for character navigation
            this.focusPCSHelper();
            this.hub.trigger(Events.CodeBooksDetailRenderingComplete);
        };
        TabularView.prototype.pcsColumnsFirstTimeSetup = function (code) {
            var that = this, renderedHTML = this.templateTabularPCSWrapper({
                data: this.getFilteredPCSData(),
                sections: this.sharedProperties.get('pcsSections'),
                code: code,
                hideResearch: this.hideResearch
            }), $paneContent = this.$content.find(this.contentSelector).empty().hide(), $pcs, $cols, colWidth, splitterConfig;
            $(renderedHTML).insertBefore($paneContent);
            $pcs = this.$('.pcs-inner');
            colWidth = ($pcs.width() / 4).toString() + 'px';
            this.disableScrollHandler();
            $cols = $pcs.width($pcs.closest('.pcs-outer').width() * 1.75).kendoSplitter({
                orientation: 'horizontal',
                panes: [
                    {
                        resizable: false,
                        size: colWidth
                    }, 
                    {
                        resizable: false,
                        size: colWidth
                    }, 
                    {
                        resizable: false,
                        size: colWidth
                    }, 
                    {
                        resizable: false,
                        size: colWidth
                    }, 
                    {
                        resizable: false,
                        size: colWidth
                    }, 
                    {
                        resizable: false,
                        size: colWidth
                    }, 
                    {
                        resizable: false,
                        size: colWidth
                    }
                ]
            }).find('.pcs-column');
            splitterConfig = {
                orientation: 'vertical',
                panes: [
                    {
                        resizable: false,
                        scrollable: false,
                        size: '20px'
                    }, 
                    {
                        resizable: false
                    }
                ]
            };
            $cols.each(function (idx, el) {
                if(idx === $cols.length - 1) {
                    splitterConfig.layoutChange = function (e) {
                        if(that.listenForPCSResize) {
                            that.hub.trigger(Events.CodeBooksResizeBottom, e);
                        }
                    };
                }
                $cols.eq(idx).kendoSplitter(splitterConfig);
            });
            return $pcs;
        };
        TabularView.prototype.renderPCSColumn = function (code, colNum, $columns, columnData, sectionTitle, stayInPreviousColumn) {
            dom.focusWithoutWindowScroll($columns.eq(colNum - 1).toggleClass(function (idx, cls, clsSwitch) {
                if(stayInPreviousColumn && (code.length === colNum || (code.length === 7 && colNum + 1 === 7))) {
                    return 'inactive active';
                } else if(!stayInPreviousColumn && (code.length + 1 === colNum)) {
                    return 'inactive active';
                }
                return '';
            }).find('.pane-head').html(this.templateTabularPCSColumnHead({
                colNum: colNum,
                sections: this.sharedProperties.get('pcsSections'),
                column: columnData
            })).end().find('.pane-body').html(this.templateTabularPCSColumnChoices({
                colNum: colNum,
                sections: this.sharedProperties.get('pcsSections'),
                sectionTitle: sectionTitle,
                column: columnData,
                code: code
            })).find('.item-selected a'));
        };
        TabularView.prototype.movePCSClick = function (event) {
            if($(event.currentTarget).hasClass('icon-left-small')) {
                this.movePCSLeft();
            } else {
                this.movePCSRight();
            }
        };
        TabularView.prototype.movePCSLeft = function (cancelSlide) {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[pcs] Move left');
            }
            this.$('.pcs-outer').stop().scrollTo(0, {
                axis: 'x',
                duration: cancelSlide ? 0 : this.scrollDuration
            });
            this.isPCSMovedRight = false;
            this.$('.pcs-column-head.pivot .icon-pivot').removeClass('icon-left-small reverse').addClass('icon-right-small');
        };
        TabularView.prototype.movePCSRight = function (cancelSlide) {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[pcs] Move right');
            }
            this.$('.pcs-outer').stop().scrollTo('max', {
                axis: 'x',
                duration: cancelSlide ? 0 : this.scrollDuration
            });
            this.isPCSMovedRight = true;
            this.$('.pcs-column-head.pivot .icon-pivot').removeClass('icon-right-small').addClass('icon-left-small reverse');
        };
        TabularView.prototype.cleanupPCSColumns = function () {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[pcs] Cleaning up PCS columns...');
            }
            this.pcsData = null;
            this.pcsHeaders = [];
            this.model.set({
                pcsCodeBuilder: []
            }, {
                silent: true
            });
            this.mode = TABULAR_MODE.NORMAL;
            this.$content.find(this.contentSelector).show().end().find('.pcs').remove();
        };
        TabularView.prototype.render = //#endregion
        //#region Rendering
        function (data) {
            if(typeof data === 'undefined') {
                this.clear();
            } else {
                this.cachedBook = data.data_book;
                var temporaryRecords = new RC.RowCollection().reset(data.book_view_records), bookUpper = this.cachedBook.toUpperCase(), templateRenderer, contentLogicFunc, renderedResultsHtml, bookType;
                this.setLoading(false);
                // received records?
                if(temporaryRecords.length > 0) {
                    // set results renderer and render only those records received
                    if(bookUpper.indexOf('CPT') !== -1) {
                        templateRenderer = this.templateTabularCPT;
                        this.displayType = 'tabular';
                    } else if(bookUpper.indexOf('HCPCS') !== -1) {
                        templateRenderer = this.templateTabularHCPCS;
                        this.displayType = 'tabular';
                    } else if(bookUpper.indexOf('_INDEX') !== -1) {
                        templateRenderer = this.templateIndex;
                        this.displayType = 'index';
                    } else if(bookUpper.indexOf('_TABULAR') !== -1) {
                        templateRenderer = this.templateTabular;
                        this.displayType = 'tabular';
                    }
                    renderedResultsHtml = templateRenderer.call(this, {
                        book: this.cachedBook,
                        records: temporaryRecords.toJSON(),
                        imgPath: config.imageCdnPath()
                    });
                    // fresh or append?
                    contentLogicFunc = (!this.shouldAppend) ? this.renderReplace : this.renderAppend;
                    contentLogicFunc.call(this, renderedResultsHtml, temporaryRecords);
                    this.setupICD10Toggles();
                    this.setHistoryButtons();
                    // we now have height, calculate load point
                    // THIS ALSO NEEDS UPDATED WHEN A LAYOUT MANAGER IS IMPLEMENTED AND THE HEIGHT CHANGES
                    this.calculatedLoadPoint = ((this.$content.find('.pane-content')[0].scrollHeight - this.contentHeight) / 2) * (this.loadMoreThreshold / 100);
                } else {
                    if(this.cachedSector === "Up") {
                        if(typeof DEBUG !== 'undefined' && DEBUG) {
                            log('[tabular] Reached top');
                        }
                        this.reachedTop = true;
                    }
                    if(this.cachedSector === "Down") {
                        if(typeof DEBUG !== 'undefined' && DEBUG) {
                            log('[tabular] Reached bottom');
                        }
                        this.reachedBottom = true;
                    }
                    this.currentlyLoadingMore = false;
                }
            }
            this.hub.trigger(Events.CodeBooksDetailRenderingComplete);
            return this;
        };
        TabularView.prototype.renderReplace = function (renderedResultsHtml, temporaryRecords, isHistoryEvent) {
            var $target;
            this.$heading.html(this.templateWrapper({
                book: TextBook[this.cachedBook] || this.cachedBook,
                hideResearch: this.hideResearch
            }));
            this.$content.find(this.contentSelector).html(renderedResultsHtml);
            // temporaryRecords will be null for crosswalk loading
            if(temporaryRecords) {
                // set last and first sequences for infinite loading
                this.lastSequence = temporaryRecords.last().get('data_sequence');
                this.firstSequence = temporaryRecords.first().get('data_sequence');
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[tabular:sequence] First seq: ' + this.firstSequence + ', Last seq: ' + this.lastSequence);
                }
            }
            // always click because this was possibly triggered by history navigation
            $target = this.$content.find('#tabular-' + this.cachedSequence).click();
            this.focusEntry($target, false, 'center');
            this.enableScrollHandler();
            this.setCurrentlyLoadingMore(false);
            this.reachedTop = false;
            this.reachedBottom = false;
        };
        TabularView.prototype.renderAppend = function (renderedResultsHtml, temporaryRecords) {
            var $c = this.$content.find('.pane-content'), offset = this.contentHeight / 2, scrollOptions = // ANIMATION ?
            {
                duration: 0,
                offset: -offset,
                onAfter: this.afterAppend
            }, beforeHeight, beforeScrollTop;
            // scroll animation is buggy
            // prepend or append?
            if(this.cachedSector === 'Down') {
                this.$content.find(this.contentSelector).append(renderedResultsHtml);
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[tabular:sequence] Last seq update: ' + this.lastSequence + ' -> ' + temporaryRecords.last().get('data_sequence'));
                }
                this.lastSequence = temporaryRecords.last().get('data_sequence');
                this.afterAppend();
            }
            if(this.cachedSector === 'Up') {
                this.disableScrollHandler();
                // keep the current scroll position
                beforeHeight = this.$content.find('.pane-content')[0].scrollHeight;
                beforeScrollTop = this.$content.find('.pane-content').scrollTop();
                this.$content.find(this.contentSelector).prepend(renderedResultsHtml);
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[tabular] Scrolling to view...');
                }
                $c.stop().scrollTo(this.$content.find('.pane-content')[0].scrollHeight - beforeHeight + beforeScrollTop, scrollOptions);
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[tabular:sequence] First seq update: ' + this.firstSequence + ' -> ' + temporaryRecords.first().get('data_sequence'));
                }
                this.firstSequence = temporaryRecords.first().get('data_sequence');
            }
            this.setCurrentlyLoadingMore(false);
        };
        TabularView.prototype.afterAppend = function () {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[tabular] After append...');
            }
            this.setCurrentlyLoadingMore(false);
            this.enableScrollHandler();
        };
        TabularView.prototype.clearWithoutLoading = function (event) {
            net.Net.tryAbort(this.currentReq);
            $.extend(event, {
                clearLoading: true
            });
            this.clear(event);
        };
        TabularView.prototype.clear = /**
        * @listens Events.EncoderSearch
        */
        function (event) {
            event = event;
            var doneLoading = true;
            this.pushSelectedItemToHistory();
            this.currentlyLoadingMore = false;
            this.$heading.html(this.templateWrapper({
                book: '&mdash;',
                hideResearch: this.hideResearch
            }));
            this.disableScrollHandler();
            this.$content.find(this.contentSelector).not('.pcs').empty();
            this.cleanupPCSColumns();
            if(event) {
                doneLoading = false;
                if(typeof event.clearLoading !== 'undefined' && event.clearLoading) {
                    doneLoading = true;
                }
            }
            this.setLoading(!doneLoading);
        };
        TabularView.prototype.setLoading = /** */
        function (notDone) {
            if(typeof notDone === 'undefined' || !notDone) {
                this.$heading.find('.tc-loading').remove();
            } else {
                if(this.$heading.find('.tc-loading').length === 0) {
                    this.$heading.find('.controls').append('<span class="k-loading k-icon tc-loading">Loading</span>');
                }
            }
        };
        TabularView.prototype.handleError = function (e) {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[tabular] There was a problem displaying tabular.');
            }
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log(e);
            }
            this.clear();
        };
        TabularView.prototype.loadMore = //#endregion
        //#region Scrolling
        /**
        * @triggers Events.EncoderGetTabular
        */
        function (e) {
            var scrollTop = $(e.currentTarget).scrollTop(), scrollHeight = this.$content.find('.pane-content')[0].scrollHeight, contentHeight = this.contentHeight, scrollBottom = // is 20 the height of an element or the arrows or other?
            scrollHeight - contentHeight - scrollTop - 20, canLoadMore = true, isApproachingBottom, calculatedProximity, sequenceToLoad, sectorToLoad, getTabularOptions;
            if(this.isFirstScroll) {
                this.isFirstScroll = false;
                if(typeof DEBUG !== 'undefined' && DEBUG && this.debugInfiniteScroll) {
                    log('[tabular] First scroll ' + scrollTop);
                }
            } else if(!this.currentlyLoadingMore) {
                isApproachingBottom = scrollBottom < scrollTop;
                calculatedProximity = (isApproachingBottom) ? scrollBottom : scrollTop;
                if(typeof DEBUG !== 'undefined' && DEBUG && this.debugInfiniteScroll) {
                    log('[tabular] Down? ' + isApproachingBottom + ', Proximity: ' + calculatedProximity + ', Load Point: ' + this.calculatedLoadPoint);
                }
                if(calculatedProximity < this.calculatedLoadPoint) {
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('Do load more!');
                    }
                    if(isApproachingBottom) {
                        sequenceToLoad = this.lastSequence;
                        sectorToLoad = 'Down';
                        if(this.reachedBottom) {
                            canLoadMore = false;
                        }
                    } else {
                        sequenceToLoad = this.firstSequence;
                        sectorToLoad = 'Up';
                        if(this.reachedTop) {
                            canLoadMore = false;
                        }
                    }
                    if(canLoadMore) {
                        this.currentlyLoadingMore = true;
                        getTabularOptions = {
                            book: this.cachedBook,
                            sequence: sequenceToLoad,
                            sector: sectorToLoad,
                            records: 25,
                            append: true,
                            date: this.targetDate
                        };
                        this.hub.trigger(Events.CodeBooksGetTabular, getTabularOptions);
                    } else {
                        if(typeof DEBUG !== 'undefined' && DEBUG) {
                            log('[tabular] Cannot load more. Top? ' + this.reachedTop + ' Bottom? ' + this.reachedBottom);
                        }
                    }
                }
            } else {
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[tabular] Cannot load more at this time. Already trying to load more...');
                }
            }
        };
        TabularView.prototype.disableScrollHandler = /**
        * will not be called by .events property because the scroll event is not being
        * placed on the root view element, $el, and because the DOM does not bubble scroll
        */
        function () {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[tabular] Disabling scroll event');
            }
            this.$content.find('.pane-content').unbind('scroll', this.throttleFunc);
        };
        TabularView.prototype.enableScrollHandler = /**
        * will not be called by .events property because the scroll event is not being
        * placed on the root view element, $el, and because the DOM does not bubble scroll
        */
        function () {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[tabular] Enabling scroll event');
            }
            this.isFirstScroll = true;
            this.$content.find('.pane-content').scroll(this.throttleFunc);
        };
        TabularView.prototype.setCurrentlyLoadingMore = function (val) {
            this.currentlyLoadingMore = (typeof val === 'boolean') ? val : false;
            this.setLoading(this.currentlyLoadingMore);
        };
        TabularView.prototype.getInstructionalNotes = //#endregion
        //#region Instructional Notes
        function (e) {
            e.stopPropagation();
            var $target = $(e.currentTarget).closest('.tabular-result'), code = $target.find('.primary-code').text(), codeType = $target.attr('data-book').replace('_TABULAR', '').replace('_INDEX', ''), giOptions;
            giOptions = {
                code: code,
                code_type: codeType
            };
            if(this.targetDate.length) {
                giOptions.date = this.targetDate;
            }
            net.Net.tryAbort(this.currentReq);
            this.currentReq = api.TC.current()._net.codebooksGetInstructionalNotes(giOptions, this.showInstructionalNotes, this.showInstructionalNotes);
        };
        TabularView.prototype.showInstructionalNotes = function (ajaxData, status) {
            var temporaryRecords = new RC.RowCollection(), html = '', book = ajaxData.instructional_notes_records.data_book, bookUpper = (book.length) ? book.toUpperCase() : '', templateRenderer, tabularHtml, $m;
            if(bookUpper.indexOf('CPT') !== -1) {
                templateRenderer = this.templateTabularCPT;
            } else {
                templateRenderer = this.templateTabular;
            }
            if(typeof status !== 'undefined' && status === 'error') {
                Modal.show({
                    title: 'Instructional Notes',
                    content: 'There was an error trying to load this instructional note.',
                    close: this.tcSetFocus,
                    open: this.tcClearFocus
                });
            } else {
                temporaryRecords.reset(ajaxData.instructional_notes_records.records);
                tabularHtml = templateRenderer.call(this, {
                    book: this.cachedBook,
                    records: temporaryRecords.toJSON(),
                    imgPath: config.imageCdnPath(),
                    inotePopup: true
                });
                html = this.templateInstructionalNote({
                    formatted: tabularHtml
                });
                $m = Modal.show({
                    title: 'Instructional Notes',
                    htmlContent: html,
                    close: this.tcSetFocus,
                    open: this.tcClearFocus
                });
                $m.on('click', 'a.code', this.instructionalNoteCodeClick);
            }
        };
        TabularView.prototype.instructionalNoteCodeClick = function (event) {
            Modal.get().off();
            Modal.close();
            this.selectItem(event);
        };
        TabularView.prototype.modifierClick = //#endregion
        //#region Modifiers
        function (event) {
            var $target = $(event.currentTarget), book = $target.attr('data-code-type'), code = $target.text();
            if(book.length) {
                book = book.replace('_TABULAR', '').replace('_INDEX', '');
            }
            var showModifierOptions;
            showModifierOptions = {
                book: book,
                code_to_scroll: code
            };
            this.hub.trigger(Events.CodeBooksListModifiers, showModifierOptions);
        };
        TabularView.prototype.getModifiers = /** */
        function (event) {
            var that = this, listModifiersOptions;
            listModifiersOptions = {
                full_details: true,
                book: event.book
            };
            if(this.targetDate.length) {
                listModifiersOptions.date = this.targetDate;
            }
            api.TC.current()._net.codebooksListModifiers(listModifiersOptions, function (data) {
                that.showModifiers(data, event.code_to_scroll);
            }, this.showModifiers);
        };
        TabularView.prototype.showModifiers = /** */
        function (data, code) {
            var renderedHTML = this.templateModifiers({
                modifiers: data
            }), $modal, modalOptions = {
                title: 'Modifiers',
                htmlContent: renderedHTML
            }, scrollToModifier = function scrollToModifier(e) {
                var $modal = $(e.sender.element);
                $modal.scrollTo($modal.find('.modifier-code-' + code));
            };
            if(code) {
                modalOptions.activate = scrollToModifier;
            }
            modalOptions.close = this.tcSetFocus;
            modalOptions.open = this.tcClearFocus;
            $modal = Modal.show(modalOptions);
        };
        TabularView.prototype.getCrosswalk = //#endregion
        //#region Crosswalk
        function (e) {
            $.extend(e, {
                all: true
            });
            var options = net.Net.mapToGetResearch(e), isHistoryEvent = (typeof e.isHistoryEvent !== 'undefined' && e.isHistoryEvent);
            net.Net.tryAbort(this.currentReq);
            this.currentReq = api.TC.current()._net.researchGetResearch(options, this.renderCrosswalk, this.renderCrosswalk);
            if(!isHistoryEvent) {
                this.addHistory(options);
            }
        };
        TabularView.prototype.renderCrosswalk = /** Would like to re-use render but this resultset/logic is too different */
        function (ajaxData, status) {
            try  {
                var rs = ajaxData.research_sections, temporaryRecords = new RSC.SectionCollection().reset(rs), crosswalk = temporaryRecords.where({
                    sectionType: 'CROSSWALK'
                }), renderedResultsHtml, crosswalkJson;
                // received records?
                if(crosswalk.length === 1) {
                    crosswalkJson = crosswalk[0].toJSON();
                    renderedResultsHtml = this.templateTabularCrosswalk({
                        data: crosswalkJson
                    });
                    // set cached vars to select the first item for replace/focusEntry
                    this.cachedBook = 'Crosswalk';
                    this.cachedSequence = crosswalkJson.items[0].id;
                    // always fresh, send null to avoid storing these records
                    this.renderReplace(renderedResultsHtml, null);
                    // can't infinite load crosswalk items
                    this.reachedTop = true;
                    this.reachedBottom = true;
                    this.currentlyLoadingMore = false;
                    // set the history buttons
                    this.setHistoryButtons();
                    // we don't load more, don't need a load point
                    this.calculatedLoadPoint = 0;
                    // we dont load more, we don't need these
                    this.lastSequence = 0;
                    this.firstSequence = 0;
                }
            } catch (e) {
                this.handleError(e);
            }
        };
        TabularView.prototype.onSplitterCreated = //#endregion
        //#region Splitter Layout Change
        /** */
        function () {
            var splitter = this.$el.data('kendoSplitter');
            splitter.bind('layoutChange', this.fixContentScrollHeight);
            this.fixContentScrollHeight();
        };
        TabularView.prototype.fixContentScrollHeight = function (e) {
            var that = this;
            this.contentHeight = this.$content.height() - 21;
            this.$content.find('.pane-content').each(function (idx, el) {
                var $el = $(el);
                if($el.hasClass('pcs')) {
                    $el.css('height', that.contentHeight + 10);
                } else {
                    $el.css('height', that.contentHeight);
                }
            });
        };
        return TabularView;
    })(Backbone.View);
    exports.TabularView = TabularView;    
    //#endregion
    })
;
define('text!controls/research/templates/research.html',[],function () { return '<% if (hasTabs) { %>\r\n<% var randomId = Math.random().toString().replace(\'0.\',\'\'); %>\r\n<div class="tabstrip research-pane" id="tabstrip-<%= randomId %>">\r\n    <ul>\r\n    </ul>\r\n</div>\r\n<% } else { %>\r\n<div class="research-pane"></div>\r\n<% } %>';});

define('text!controls/research/templates/research-pane/result.html',[],function () { return '<div class="research-content content <%= data.codeType.toLowerCase() %> coding-level-<%= codingLevel %><% if (hiddenSections.length > 0) { print(\' \' + hiddenSections); } %><% if (encounterType) { print(\' \' + encounterType); } %>">\r\n    <% _.each(sections, function(section) { %>\r\n    <div class="accordion-group <%= section.sectionType %><% if (section.itemCount) { print(\' selectable\'); } %>">\r\n        <div class="section-heading accordion-heading <% if (section.itemCount) { print(\'collapsible\'); } else { print(\'empty\'); } %>">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon <% if (section.itemCount) { print(\'k-minus\'); } else { print(\'k-plus\'); } %>"></span>\r\n                    <span class="section-title"><%= TextBook[section.sectionType] || section.sectionType %></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body<% if (section.itemCount === 0) { print(\' hide\'); } %>">\r\n            <div class="accordion-inner">\r\n                <ul class="<%= section.sectionType %>" data-section="<%= section.sectionType %>">\r\n        <% if (section.items) { %>\r\n            <% switch (section.sectionType) {\r\n                case \'CDR\': { %>\r\n                    <% _.each(section.items, function(item) { %>\r\n                        <dl>\r\n                            <dt><a class="reference" href="javascript:void(0)" data-article-id="<%= item.id %>"><%= item.title %></a>, <em><%= item.year %></em></dt>\r\n                            <dd>\r\n                                <span class="description<% if (item.text.length > 250) { print(\' hide\'); } %>"><%= item.text %></span>\r\n                                <span class="description overflow<% if (item.text.length <= 250) { print(\' hide\'); } %>"><%= _.str.prune(item.text, 250, \'<span class="overflow-text">...</span> <a href="javascript:void(0)" class="overflow-show">More</a>\') %></span>\r\n                            </dd>\r\n                        </dl>\r\n                    <% }); %>\r\n                <% }\r\n                break;\r\n                case \'CROSSWALK\':\r\n                case \'ANESTHESIA_CROSSWALK\': { %>\r\n                    <% _.forEach(section.items, function(item, i) { %>\r\n                        <li><a class="code" href="javascript:void(0)" data-code-type="<%= item.book %>"><%= item.code %></a> <%= item.medium_description %></li>\r\n                    <% }); %>\r\n                    <% if (section.hasMore) { %><a id="show-all-crosswalk" href="javascript:void(0)">View all <%= section.sectionType == \'ANESTHESIA_CROSSWALK\' ? \'anesthesia\' : \'\' %> crosswalk results</a><% } %>\r\n                <% }\r\n                break;\r\n                case \'CODING_ADVICE\': { %>\r\n                    <% _.each(section.items, function(item) { %>\r\n                        <li class="type-<%= item.coding_advice_type %><% if (item.is_beginner_level === true) { print(\' beginner\'); } %><% if (item.is_inpatient === false) { print(\' not-inpatient\'); } %><% if (item.is_outpatient === false) { print(\' not-outpatient\'); } %>"><%= item.text %> <em><%= item.source %></em></li>\r\n                    <% }); %>\r\n                <% }\r\n                break;\r\n                case \'CC_ICD9\':\r\n                case \'CC_ICD10\':\r\n                case \'CC_HCPCS\':\r\n                case \'CPT_ASSISTANT\':\r\n                case \'ICD9_GUIDELINES\':\r\n                case \'ICD10_GUIDELINES\':\r\n                case \'INTERVENTIONAL_RADIOLOGY\':\r\n                default: { %>\r\n                   <% _.each(section.items, function(item) { %>\r\n                    <li><a class="reference" href="javascript:void(0)" data-article-id="<%= item.id %>"><%= item.title %></a>, <em><%= item.issue_title %></em></li>\r\n                    <% }); %>\r\n                    <% if (section.best_count === 0 && section.hasMore) { %><em>No strong matches found.</em><% } %> \r\n                    <% if (section.hasMore) { %><a class="reference show-more" id="show-all-articles" href="javascript:void(0)">View all <%= section.best_count + section.other_count %> matching titles</a><% } %> \r\n                <% }\r\n                break;\r\n            } %>\r\n        <% } %>\r\n                </ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n    <% }); %>\r\n    <div class="accordion-group ADDITIONAL_REFERENCES<% if (books.length > 0) { print(\' selectable\'); } %>">\r\n        <div class="section-heading accordion-heading <% if (books.length > 0) { print(\'collapsible\'); } else { print(\'empty\'); } %>">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon <% if (books.length > 0) { print(\'k-minus\'); } else { print(\'k-plus\'); } %>"></span>\r\n                    <span class="section-title"><%= TextBook.ADDITIONAL_REFERENCES %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body<% if (books.length === 0) { print(\' hide\'); } %>">\r\n            <div class="accordion-inner">\r\n                <ul>\r\n                    <% _.each(books, function(item) { %>\r\n                        <% if (item.isResource) { %>\r\n                            <li id="resource-<%= item.id %>" class="type-<%= item.type %>"><a class="type-<%= item.type %> resource<%= item.isProtected ? \' protected\' : \'\' %>" href="javascript:void(0)" data-resource-id="<%= item.id %>" data-item-type="<%= item.type %>"><%= item.title %></a></li>\r\n                        <% } else { %>\r\n                            <li id="reference-<%= item.id %>" class="type-<%= item.type %>"><a class="type-<%= item.type %> reference<%= item.isProtected ? \' protected\' : \'\' %>" href="javascript:void(0)" data-book-id="<%= item.id %>" data-item-type="<%= item.type %>"><%= item.title %></a></li>\r\n                        <% } %>\r\n                    <% }); %>\r\n                </ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n</div>';});

define('text!controls/research/templates/research-pane/empty.html',[],function () { return '<div class="research-content content <%= codeType.toLowerCase() %><% if (hiddenSections.length > 0) { print(\' \' + hiddenSections); } %>">\r\n\r\n    <div class="accordion-group CC_ICD9">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title"><%= TextBook.CC_ICD9 %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <ul></ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group CC_ICD10">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title"><%= TextBook.CC_ICD10 %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <ul></ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group CC_HCPCS">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title"><%= TextBook.CC_HCPCS %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <ul></ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group ICD9_GUIDELINES">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title"><%= TextBook.ICD9_GUIDELINES %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <ul></ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group ICD10_GUIDELINES">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title"><%= TextBook.ICD10_GUIDELINES %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <ul></ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group CPT_ASSISTANT">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title"><%= TextBook.CPT_ASSISTANT %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <ul></ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group CDR">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title"><%= TextBook.CDR %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <ul></ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group INTERVENTIONAL_RADIOLOGY">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title"><%= TextBook.INTERVENTIONAL_RADIOLOGY %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <ul></ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group CROSSWALK">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title"><%= TextBook.CROSSWALK %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <ul></ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n        <div class="accordion-group ANESTHESIA_CROSSWALK">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title"><%= TextBook.ANESTHESIA_CROSSWALK %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <ul></ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group CODING_ADVICE">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title"><%= TextBook.CODING_ADVICE %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <ul></ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group ADDITIONAL_REFERENCES<% if (books.length > 0) { print(\' selectable\'); } %>">\r\n        <div class="section-heading accordion-heading <% if (books.length > 0) { print(\'collapsible\'); } else { print(\'empty\'); } %>">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon <% if (books.length > 0) { print(\'k-minus\'); } else { print(\'k-plus\'); } %>"></span>\r\n                    <span class="section-title"><%= TextBook.ADDITIONAL_REFERENCES %></span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body<% if (books.length === 0) { print(\' hide\'); } %>">\r\n            <div class="accordion-inner">\r\n                <ul>\r\n                    <% _.each(books, function(item) { %>\r\n                        <% if (item.isResource) { %>\r\n                            <li id="resource-<%= item.id %>" class="type-<%= item.type %>"><a class="type-<%= item.type %> resource<%= item.isProtected ? \' protected\' : \'\' %>" href="javascript:void(0)" data-resource-id="<%= item.id %>" data-item-type="<%= item.type %>"><%= item.title %></a></li>\r\n                        <% } else { %>\r\n                            <li id="reference-<%= item.id %>" class="type-<%= item.type %>"><a class="type-<%= item.type %> reference<%= item.isProtected ? \' protected\' : \'\' %>" href="javascript:void(0)" data-book-id="<%= item.id %>" data-item-type="<%= item.type %>"><%= item.title %></a></li>\r\n                        <% } %>\r\n                    <% }); %>\r\n                </ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n</div>';});

var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/models/research/researchPaneViewModel',["require", "exports", "Backbone", "jql"], function(require, exports, __Backbone__, __$__) {
    ///<reference path="../../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;

    var ResearchPaneViewModel = (function (_super) {
        __extends(ResearchPaneViewModel, _super);
        function ResearchPaneViewModel(options) {
            this.defaults = {
                codeSearched: null,
                codeType: (options && options.codeType) ? options.codeType.toUpperCase() : 'ICD9CM_DX',
                researchSections: (options && options.researchSections) ? options.researchSections : {
                },
                allResearch: (options && typeof options.allResearch === 'boolean') ? options.allResearch : false,
                handleResourceClick: (options && typeof options.handleResourceClick === 'boolean') ? options.handleResourceClick : true
            };
                _super.call(this, options);
        }
        ResearchPaneViewModel.prototype.initialize = function () {
            var defaultSectionConfig = {
                CC_ICD9: true,
                CC_ICD10: true,
                CC_HCPCS: true,
                ICD9_GUIDELINES: true,
                CPT_ASSISTANT: true,
                CDR: true,
                INTERVENTIONAL_RADIOLOGY: true,
                CROSSWALK: true,
                ANESTHESIA_CROSSWALK: true,
                CODING_ADVICE: true,
                ADDITIONAL_REFERENCES: true,
                ICD10_GUIDELINES: true
            };
            this.set('researchSections', $.extend(defaultSectionConfig, this.get('researchSections')));
        };
        return ResearchPaneViewModel;
    })(Backbone.Model);
    exports.ResearchPaneViewModel = ResearchPaneViewModel;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/references/models/book',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var Book = (function (_super) {
        __extends(Book, _super);
        function Book(options) {
            this.defaults = function () {
                return {
                    id: null,
                    title: null,
                    can_list: false,
                    type: 'default',
                    isResource: false,
                    isProtected: true
                };
            };
                _super.call(this, options);
        }
        Book.prototype.initialize = function () {
            // do nothing
                    };
        return Book;
    })(Backbone.Model);
    exports.Book = Book;    
})
;
define('lib/util',["require", "exports"], function(require, exports) {
    function alphanumCompare(a, b) {
        a = a.get('title');
        b = b.get('title');
        var re = /(^-?[0-9]+(\.?[0-9]*)[df]?e?[0-9]?$|^0x[0-9a-f]+$|[0-9]+)/gi, sre = /(^[ ]*|[ ]*$)/g, dre = /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}|^\w+, \w+ \d+, \d{4})/, hre = /^0x[0-9a-f]+$/i, ore = /^0/, i = function (s) {
            return ('' + s).toLowerCase() || '' + s;
        }, x = // convert all to strings strip whitespace
        i(a).replace(sre, '') || '', y = i(b).replace(sre, '') || '', xN = // chunk/tokenize
        x.replace(re, '\0$1\0').replace(/\0$/, '').replace(/^\0/, '').split('\0'), yN = y.replace(re, '\0$1\0').replace(/\0$/, '').replace(/^\0/, '').split('\0'), xMatch = // numeric, hex or date detection
        x.match(hre), yMatch = y.match(hre), xMatched = xMatch && xMatch.length ? xMatch[0] : null, yMatched = yMatch && yMatch.length ? yMatch[0] : null, xD = parseInt(xMatched) || (xN.length != 1 && x.match(dre) && Date.parse(x)), yD = parseInt(yMatched) || xD && y.match(dre) && Date.parse(y) || null, oFxNcL, oFyNcL;
        // first try and sort Hex codes or Dates
        if(yD) {
            if(xD < yD) {
                return -1;
            } else if(xD > yD) {
                return 1;
            }
        }
        // natural sorting through split numeric strings and default strings
        for(var cLoc = 0, numS = Math.max(xN.length, yN.length); cLoc < numS; cLoc++) {
            // find floats not starting with '0', string or 0 if not defined (Clint Priest)
            oFxNcL = !(xN[cLoc] || '').match(ore) && parseFloat(xN[cLoc]) || xN[cLoc] || 0;
            oFyNcL = !(yN[cLoc] || '').match(ore) && parseFloat(yN[cLoc]) || yN[cLoc] || 0;
            // handle numeric vs string comparison - number < string - (Kyle Adams)
            if(isNaN(oFxNcL) !== isNaN(oFyNcL)) {
                return (isNaN(oFxNcL)) ? 1 : -1;
            } else // rely on string comparison if different types - i.e. '02' < 2 != '02' < '2'
            if(typeof oFxNcL !== typeof oFyNcL) {
                oFxNcL += '';
                oFyNcL += '';
            }
            if(oFxNcL < oFyNcL) {
                return -1;
            }
            if(oFxNcL > oFyNcL) {
                return 1;
            }
        }
        return 0;
    }
    exports.alphanumCompare = alphanumCompare;
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/references/models/bookCollection',["require", "exports", "Backbone", "controls/references/models/book", "lib/util"], function(require, exports, __Backbone__, __B__, __util__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var B = __B__;

    var util = __util__;

    var BookCollection = (function (_super) {
        __extends(BookCollection, _super);
        function BookCollection() {
            _super.apply(this, arguments);

            this.model = B.Book;
            this.comparator = util.alphanumCompare;
        }
        return BookCollection;
    })(Backbone.Collection);
    exports.BookCollection = BookCollection;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/views/researchPane',["require", "exports", "Backbone", "underscore", "vendor/underscore/plugins/underscore.string", "jql", "vendor/jquery/plugins/jquery.scrollTo", "text!controls/research/templates/research-pane/result.html", "text!controls/research/templates/research-pane/empty.html", "controls/research/models/research/researchPaneViewModel", "controls/research/models/research/sectionCollection", "controls/references/models/book", "controls/references/models/bookCollection", "lib/api", "lib/dom", "lib/events", "lib/net", "lib/shortcuts", "lib/templates", "i18n!locale/nls/books"], function(require, exports, __Backbone__, _____, ___string__, __$__, __scrollTo__, __RT__, __RTE__, __RVM__, __RSC__, __B__, __BC__, __api__, __dom__, __Events__, __net__, __Shortcuts__, __Templates__, __TextBook__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/underscore/plugins/underscore.string.d.ts"/>
    
    var _string = ___string__;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../../../vendor/jquery/plugins/jquery.scrollTo.d.ts"/>
    
    var scrollTo = __scrollTo__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var RT = __RT__;

    var RTE = __RTE__;

    var RVM = __RVM__;

    var RSC = __RSC__;

    var B = __B__;

    var BC = __BC__;

    var api = __api__;

    var dom = __dom__;

    
    var Events = __Events__;

    var net = __net__;

    var Shortcuts = __Shortcuts__;

    var Templates = __Templates__;
    ///<reference path="../../../locale/nls/locales.d.ts"/>
    
    var TextBook = __TextBook__;

    var ResearchTabView = (function (_super) {
        __extends(ResearchTabView, _super);
        function ResearchTabView(options) {
            // Force include
            if(scrollTo || !scrollTo) {
            }
            if(_string || !_string) {
            }
            if(TextBook || !TextBook) {
            }
            this.hub = options.hub;
            this.globalHub = options.globalHub;
            this.encounterType = options.encounterType;
            this.model = new RVM.ResearchPaneViewModel(options);
            this.sections = new RSC.SectionCollection();
            this.contentContainerSelector = '.research-content';
            this.template = Templates.compile(Templates.tk_researchTab, RT);
            this.emptyTemplate = Templates.compile(Templates.tk_researchTabEmpty, RTE);
            this.events = {
                'click': 'tcSetFocus',
                'click code_ref,.code': 'handleCodeLink',
                'click .CROSSWALK #show-all-crosswalk': 'showAllCrosswalk',
                'click .section-heading.collapsible': 'toggleView',
                'click .overflow-show': 'showOverflow',
                'click .reference': 'handleReferenceLink',
                'click .resource': 'handleResourceLink'
            };
            this.scopeName = 'researchPane:research';
            this.shortcuts = {
                'up researchPane:research': 'moveArrow',
                'down researchPane:research': 'moveArrow',
                'space researchPane:research': 'toggleViewKey'
            };
            this.books = new BC.BookCollection();
                _super.call(this, options);
        }
        ResearchTabView.prototype.initialize = function () {
            this.tcInit();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.hub, Events.ResearchCodeInContext, this.searchForCode);
            this.listenTo(this.hub, Events.ResearchClear, this.clear);
            this.listenTo(this.hub, Events.CodeBooksSearch, this.clear);
            this.listenTo(this.hub, Events.ResearchChangeEncounterType, this.encounterTypeUpdate);
            this.listenTo(this.globalHub, Events.CodingLevelChange, this.codingLevelUpdate);
            this.getAdditionalReferences();
            this.setHiddenResearchSections();
        };
        ResearchTabView.prototype.render = function () {
            this.$el.closest('.k-scrollable').stop().scrollTo(0);
            if(this.sections.length) {
                this.$el.html(this.template({
                    sections: this.sections.toJSON(),
                    data: this.model.toJSON(),
                    codingLevel: api.TC.current().settings.codingLevel,
                    encounterType: this.encounterType,
                    TextBook: TextBook,
                    books: this.books.toJSON(),
                    hiddenSections: this.hiddenResearchSections
                }));
            } else {
                this.$el.html(this.emptyTemplate({
                    codeType: this.model.get('codeType'),
                    TextBook: TextBook,
                    books: this.books.toJSON(),
                    hiddenSections: this.hiddenResearchSections
                }));
            }
            this.checkIfCodingAdviceEmpty();
            this.hub.trigger(Events.ResearchCodeResearchComplete);
            return this;
        };
        ResearchTabView.prototype.encounterTypeUpdate = function (event) {
            this.encounterType = event.encounterType;
            this.$('.research-content').removeClass('inpatient outpatient').addClass(event.encounterType);
            this.checkIfCodingAdviceEmpty();
        };
        ResearchTabView.prototype.checkIfCodingAdviceEmpty = function () {
            this.hideCodingAdvice(false);
            var visibleLength = this.$('.research-content ul.CODING_ADVICE li:visible').length;
            if(visibleLength === 0) {
                this.hideCodingAdvice(true);
            }
        };
        ResearchTabView.prototype.hideCodingAdvice = function (hide) {
            var $adviceContainer = this.$('.research-content').find('> .CODING_ADVICE');
            if(hide) {
                $adviceContainer.find('.section-heading').addClass('empty').find('.toggle-icon').addClass('k-plus').removeClass('k-minus');
                $adviceContainer.find('.section-items').hide();
            } else {
                $adviceContainer.find('.section-heading').removeClass('empty').find('.toggle-icon').addClass('k-minus').removeClass('k-plus');
                $adviceContainer.find('.section-items').show();
            }
        };
        ResearchTabView.prototype.codingLevelUpdate = function (value) {
            this.$('.research-content').removeClass(function (idx, css) {
                var match = css.match(/coding-level-\S+/g || []);
                if(match) {
                    return match.join(' ');
                }
            }).addClass('coding-level-' + value);
            this.checkIfCodingAdviceEmpty();
        };
        ResearchTabView.prototype.getFocusElement = function () {
            return this.$el.closest('.research-pane-wrap') || this.$el.closest('.research-pane');
        };
        ResearchTabView.prototype.setHiddenResearchSections = function () {
            var hiddenSections = [];
            _.each(this.model.get('researchSections'), function (value, key) {
                if(!value) {
                    hiddenSections.push('hide-' + key);
                }
            });
            this.hiddenResearchSections = hiddenSections.length > 0 ? hiddenSections.join(' ') : '';
        };
        ResearchTabView.prototype.getAdditionalReferences = function () {
            this.setLoading(true);
            api.TC.current()._net.referencesListBooks(this.showAdditionalReferences, this.showAdditionalReferencesFailure);
        };
        ResearchTabView.prototype.showAdditionalReferences = function (data) {
            var i10references = [
                new B.Book({
                    id: 'PDF_I10_CODING_HANDBOOK',
                    can_list: false,
                    title: 'ICD-10 Coding Handbook',
                    type: 'pdf',
                    isResource: true,
                    isProtected: true
                }), 
                new B.Book({
                    id: 'PDF_I10_PCS_APPENDICES',
                    can_list: false,
                    title: 'ICD-10-PCS Appendices',
                    type: 'pdf',
                    isResource: true,
                    isProtected: true
                }), 
                new B.Book({
                    id: 'PDF_I10_PCS_REFERENCE_MANUAL',
                    can_list: false,
                    title: 'ICD-10-PCS Reference Manual',
                    type: 'pdf',
                    isResource: true,
                    isProtected: true
                })
            ];
            this.books.reset(data);
            this.books.add(i10references);
            this.setLoading(false);
            this.render();
        };
        ResearchTabView.prototype.showAdditionalReferencesFailure = function () {
        };
        ResearchTabView.prototype.handleReferenceLink = function (e) {
            e.preventDefault();
            var $currentTarget = $(e.currentTarget), book = $currentTarget.attr('data-book-id') || $currentTarget.closest('ul').attr('data-section'), codeType = this.model.get('codeType'), articleId = $currentTarget.attr('data-article-id'), articleTitle = $currentTarget.text(), referenceClickData;
            if(book && book.length) {
                book = book.toUpperCase();
            } else {
                book = null;
            }
            codeType = codeType.replace('_INDEX', '').replace('_TABULAR', '');
            if(typeof articleId !== 'string' && book !== 'CDR') {
                articleId = null;
                articleTitle = null;
            }
            referenceClickData = {
                code: this.model.get('codeSearched'),
                book: book,
                articleId: articleId,
                articleTitle: articleTitle,
                codeType: codeType
            };
            this.hub.trigger(Events.ResearchReferenceClick, referenceClickData);
        };
        ResearchTabView.prototype.handleResourceLink = function (e) {
            var $currentTarget = $(e.currentTarget), codeType = this.model.get('codeType'), resourceId = $currentTarget.attr('data-resource-id'), resourceType = $currentTarget.attr('data-item-type'), isProtected = $currentTarget.hasClass('protected'), resourceTitle = $currentTarget.text(), resourceClickData, getResourceOptions, url;
            codeType = codeType.replace('_INDEX', '').replace('_TABULAR', '');
            resourceClickData = {
                code: this.model.get('codeSearched'),
                codeType: codeType,
                resourceId: resourceId,
                resourceTitle: resourceTitle,
                resourceType: resourceType,
                protectedResource: isProtected
            };
            this.hub.trigger(Events.ResearchResourceClick, resourceClickData);
            if(this.model.get('handleResourceClick')) {
                getResourceOptions = {
                    id: resourceId
                };
                url = api.TC.current()._net.referencesGetResourceURL(getResourceOptions);
                window.open(url, 'resource_' + resourceId);
            }
        };
        ResearchTabView.prototype.showOverflow = function (e) {
            var $target = $(e.currentTarget);
            $target.closest('.overflow').prev('.description').removeClass('hide');
            $target.closest('.overflow').remove();
        };
        ResearchTabView.prototype.setLoading = /** */
        function (notDone) {
            if(typeof notDone === 'undefined' || !notDone) {
                this.$('.tc-loading:first').remove();
            } else {
                this.$(this.contentContainerSelector).prepend('<span class="k-loading k-icon tc-loading">Loading</span>');
            }
        };
        ResearchTabView.prototype.clear = /**
        * @listens Events.ResearchClear
        */
        function (event) {
            var codeType = (typeof event !== 'undefined') ? event.book || this.model.get('codeType') : this.model.get('codeType');
            codeType = codeType || 'ICD9CM_DX';
            if(typeof event === 'undefined' || typeof event.pane === 'undefined' || event.pane === 'research') {
                net.Net.tryAbort(this.currentReq);
                this.sections.reset();
                this.$el.html(this.emptyTemplate({
                    codeType: codeType.toUpperCase(),
                    TextBook: TextBook,
                    books: this.books.toJSON(),
                    hiddenSections: this.hiddenResearchSections
                }));
            }
        };
        ResearchTabView.prototype.toggleView = function (e, keymasterEvent) {
            e.preventDefault();
            $(e.target).closest('.accordion-heading').toggleClass('collapsed').find('.toggle-icon').toggleClass('k-plus k-minus');
            // ANIMATION
            var duration = (api.TC.current().settings.effects) ? 600 : 0;
            $(e.target).closest('.accordion-group').find('.section-items').slideToggle(duration).prev('.section-heading').find('.section-expander').focus();
        };
        ResearchTabView.prototype.searchForCode = /**
        * @listens Events.ResearchCodeInContext
        */
        function (event) {
            this.setLoading(true);
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[research] Searching for code `' + event.code + '` in `' + event.book + '`. Get all? ' + event.getAll);
            }
            this.model.set({
                codeSearched: event.code,
                codeType: event.book
            }, {
                silent: true
            });
            // setup default for all research but allow it to be overridden per-event trigger
            var getResearchData = {
                all: this.model.get('allResearch'),
                code: '',
                code_type: ''
            };
            $.extend(getResearchData, net.Net.mapToGetResearch(event));
            net.Net.tryAbort(this.currentReq);
            this.currentReq = api.TC.current()._net.researchGetResearch(getResearchData, this.searchForCodeComplete, this.handleError);
        };
        ResearchTabView.prototype.handleError = function () {
            // handle
                    };
        ResearchTabView.prototype.searchForCodeComplete = function (data) {
            this.setLoading(false);
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[research] Done searching for code');
            }
            this.sections.reset(data.research_sections);
            this.render();
        };
        ResearchTabView.prototype.handleCodeLink = /**
        * @triggers Events.EncoderGetTabular
        */
        function (e) {
            var $target = $(e.currentTarget), code = $target.text(), codeTypeToSearch = $target.attr('data-code-type') || this.model.get('codeType'), codeClickedOptions;
            codeClickedOptions = {
                codeType: codeTypeToSearch,
                code: code,
                pane: 'research'
            };
            this.hub.trigger(Events.ResearchCodeSelected, codeClickedOptions);
        };
        ResearchTabView.prototype.showAllCrosswalk = /**
        * @triggers Events.EncoderShowCrosswalk
        */
        function () {
            var options;
            options = {
                book: this.model.get('codeType'),
                code: this.model.get('codeSearched')
            };
            this.hub.trigger(Events.CodeBooksGetCrosswalk, options);
        };
        ResearchTabView.prototype.moveArrow = /** */
        function (e, keymasterEvent) {
            var jqE = $.event.fix(e);
            jqE.preventDefault();
            var $activeEl = this.$(':focus'), hasActiveEl = $activeEl.length > 0, $elToScrollTo;
            if(!hasActiveEl) {
                $activeEl = dom.focusWithoutWindowScroll(this.$('.selectable .section-expander:first'));
            }
            if(keymasterEvent) {
                switch(keymasterEvent.key) {
                    case 'up':
                        $elToScrollTo = $activeEl.closest('.accordion-group').prevAll('.selectable:first').find('.section-expander');
                        this.$el.closest('.pane-scrollable >.pane-content').scrollTo($elToScrollTo);
                        dom.focusWithoutWindowScroll($elToScrollTo);
                        break;
                    case 'down':
                        $elToScrollTo = $activeEl.closest('.accordion-group').nextAll('.selectable:first').find('.section-expander');
                        this.$el.closest('.pane-scrollable >.pane-content').scrollTo($elToScrollTo);
                        dom.focusWithoutWindowScroll($elToScrollTo);
                        break;
                    default:
                        break;
                }
            }
        };
        ResearchTabView.prototype.toggleViewKey = /** */
        function (e, keymasterEvent) {
            var jqE = $.event.fix(e);
            jqE.preventDefault();
            var $target = $(e.target);
            $target.closest('.section-heading').click();
        };
        ResearchTabView.prototype.onKeyboardFocus = /** */
        function (e) {
            dom.focusWithoutWindowScroll(this.$('.selectable .section-expander:first'));
        };
        return ResearchTabView;
    })(Backbone.View);
    exports.ResearchTabView = ResearchTabView;    
})
;
define('text!controls/research/templates/edits-pane/result.html',[],function () { return '<div class="edits-content content">\r\n    <% _.each(keys, function(key) { %>\r\n    <div class="accordion-group <%= key %>">\r\n        <div class="section-heading accordion-heading <% if (groups[key].length > 0) { print(\'collapsible\'); } else { print(\'empty\'); } %>">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon <% if (groups[key].length > 0) { print(\'k-minus\'); } else { print(\'k-plus\'); } %>"></span>\r\n                    <span class="section-title"><%= TextEdits[key] || key %></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body<% if (groups[key].length === 0) { print(\' hide\'); } %>">\r\n            <div class="accordion-inner">\r\n                <ul class="<%= key.toLowerCase() %>">\r\n                    <% _.each(groups[key], function(item) { %>\r\n                        <% if (item.type === \'MNE\') { %>\r\n                    <li class="type-<%= item.type %>"><%= item.intro %>\r\n                        <p><a class="details" href="javascript:void(0)">details...</a><span class="spacer"> | </span><a class="policy" data-article-id="<%= item.article_id %>" href="javascript:void(0)">policy...</a></p>\r\n                        <div class="details-content warning hide">\r\n                            <p><strong>Policy ID:</strong> <span><%= item.policy_id %></span></p>\r\n                            <p><strong>Policy Title:</strong> <span><%= item.policy_title %></span></p>\r\n                            <p><strong>Fiscal Intermediary/MAC:</strong> <span><%= item.fi_number %> &mdash; <%= item.fi_name %></span></p>\r\n                            <p><strong>Notes:</strong> <span><%= item.notes %></span></p>\r\n                            <p>\r\n                                <strong>Covered</strong> <em>(with frequency requirements)</em><strong>:</strong>\r\n                                <% _.each(item.diagnosis_groups, function(group) { %>\r\n                                    <% var clen = group.codes.length; %>\r\n                                    <% _.forEach(group.codes, function(gcode, i) { %>\r\n                                        <a class="code" href="javascript:void(0)" data-code-type="ICD9CM_DX"><%= gcode.start_code %></a><% if (clen > 1 && i < clen - 1) print(\', \'); %>\r\n                                    <% }); %>\r\n                                <% }); %>\r\n                            </p>\r\n                        </div>                        \r\n                    </li>\r\n                        <% } else { %>\r\n                    <li class="type-<%= item.type %>"><%= item.description %><% if (item.source_data) { %> <em class="source"><%= item.source_data %></em><% } %>                        \r\n                        <% if (item.details) { %>\r\n                        <p><a class="details" href="javascript:void(0)">details...</a></p>\r\n                        <div class="details-content warning hide<% if (key === \'RAC\') { print( \' notification\'); } %>"><%= item.details %></div>\r\n                        <% } %>\r\n                    </li>\r\n                        <% } %>\r\n                    <% }); %>\r\n                </ul>\r\n            </div>\r\n        </div>\r\n    </div>\r\n    <% }); %>\r\n</div>';});

define('text!controls/research/templates/edits-pane/empty.html',[],function () { return '<div class="edits-content content">\r\n\r\n    <div class="accordion-group">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title">Medicare Code Edits (MCE)</span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <p>No edits apply</p>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title">Outpatient Code Edits (OCE)</span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <p>No edits apply</p>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title">TruCode Edits</span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <p>No edits apply</p>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title">Medical Necessity Edits</span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <p>No edits apply</p>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div class="accordion-group">\r\n        <div class="section-heading accordion-heading empty">\r\n            <div class="accordion-toggle">\r\n                <a href="javascript:void(0)" class="section-expander">\r\n                    <span class="toggle-icon k-icon k-plus"></span>\r\n                    <span class="section-title">RAC Alert!</span>\r\n                    <span class="section-pin"></span>\r\n                </a>\r\n            </div>\r\n        </div>\r\n        <div class="section-items accordion-body hide">\r\n            <div class="accordion-inner">\r\n                <p>No edits apply</p>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n</div>';});

var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/models/edits/editGroup',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var EditGroup = (function (_super) {
        __extends(EditGroup, _super);
        function EditGroup(options) {
                _super.call(this, options);
        }
        return EditGroup;
    })(Backbone.Model);
    exports.EditGroup = EditGroup;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/models/edits/editGroupCollection',["require", "exports", "Backbone", "controls/research/models/edits/editGroup"], function(require, exports, __Backbone__, __EG__) {
    ///<reference path="../../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var EG = __EG__;

    var EditGroupCollection = (function (_super) {
        __extends(EditGroupCollection, _super);
        function EditGroupCollection() {
            _super.apply(this, arguments);

            this.model = EG.EditGroup;
        }
        return EditGroupCollection;
    })(Backbone.Collection);
    exports.EditGroupCollection = EditGroupCollection;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/models/edits/editsViewModel',["require", "exports", "Backbone", "controls/research/models/edits/editGroupCollection"], function(require, exports, __Backbone__, __EGC__) {
    ///<reference path="../../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var EGC = __EGC__;

    var EditsViewModel = (function (_super) {
        __extends(EditsViewModel, _super);
        function EditsViewModel(options) {
            this.defaults = function () {
                return {
                    editGroups: new EGC.EditGroupCollection()
                };
            };
                _super.call(this, options);
        }
        return EditsViewModel;
    })(Backbone.Model);
    exports.EditsViewModel = EditsViewModel;    
})
;
define('locale/nls/edits',{
    "root": {
        "MCE": "Medicare Code Edits (MCE)",
        "OCE": "Outpatient Code Edits (OCE)",
        "MNE": "Medical Necessity Edits",
        "TruCode": "TruCode Edits",
        "RAC": "RAC Alert!",

        "policy-type-2-3": "NCD: Possible medical necessity issue for procedure code {0}. Please review the NCD policy and details.",
        "policy-type-2": "NCD: The ICD-9-CM Diagnosis codes assigned are not on the list of nationally covered indications for procedure code {0}. Please review the NCD policy.",

        "policy-type-other-3": "LCD: Possible medical necessity issue for procedure code {0}. Please review the LCD policy and details.",
        "policy-type-other": "LCD: The ICD-9-CM Diagnosis codes assigned are not on the list of locally covered indications for procedure code {0}. Please review the LCD policy."
    }
    //, "es-es": true // uncomment this line for spanish translations
});
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/views/editsPane',["require", "exports", "Backbone", "underscore", "jql", "text!controls/research/templates/edits-pane/result.html", "text!controls/research/templates/edits-pane/empty.html", "controls/research/models/edits/editsViewModel", "lib/api", "lib/events", "lib/shortcuts", "lib/templates", "i18n!locale/nls/edits"], function(require, exports, __Backbone__, _____, __$__, __ET__, __ETE__, __EVM__, __api__, __Events__, __Shortcuts__, __Templates__, __TextEdits__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var ET = __ET__;

    var ETE = __ETE__;

    var EVM = __EVM__;

    
    
    var api = __api__;

    var Events = __Events__;

    var Shortcuts = __Shortcuts__;

    var Templates = __Templates__;
    ///<reference path="../../../locale/nls/locales.d.ts"/>
    
    var TextEdits = __TextEdits__;

    var EDITS_TYPE = {
        INPATIENT: 'INPATIENT',
        OUTPATIENT: 'OUTPATIENT',
        MNE: 'MNE',
        UNKNOWN: 'UNKNOWN'
    };
    var EditsPaneView = (function (_super) {
        __extends(EditsPaneView, _super);
        function EditsPaneView(options) {
            // Force include
            if(TextEdits || !TextEdits) {
            }
            this.hub = options.hub;
            this.model = new EVM.EditsViewModel();
            this.contentContainerSelector = '.edits-content';
            this.template = Templates.compile(Templates.tk_editsTab, ET);
            this.emptyTemplate = Templates.compile(Templates.tk_editsTabEmpty, ETE);
            this.events = {
                'click': 'tcSetFocus',
                'click a.details': 'showDetails',
                'click .section-heading.collapsible': 'toggleView',
                'click a.policy': 'handlePolicyClick',
                'click a.code': 'handleCodeClick'
            };
            this.scopeName = 'researchPane:edits';
            this.shortcuts = {
            };
                _super.call(this, options);
        }
        EditsPaneView.prototype.initialize = function () {
            this.tcInit();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.hub, Events.ResearchEditsSet, this.setEdits);
            this.listenTo(this.hub, Events.ResearchClear, this.clear);
        };
        EditsPaneView.prototype.handlePolicyClick = /** */
        function (event) {
            var $target = $(event.currentTarget), policyClickOptions;
            policyClickOptions = {
                articleId: $target.attr('data-article-id')
            };
            this.hub.trigger(Events.ResearchEditsPolicyClick, policyClickOptions);
        };
        EditsPaneView.prototype.handleCodeClick = /** */
        function (event) {
            var $target = $(event.currentTarget), codeClickOptions;
            codeClickOptions = {
                codeType: $target.attr('data-code-type'),
                code: $target.text(),
                pane: 'edits'
            };
            this.hub.trigger(Events.ResearchCodeSelected, codeClickOptions);
        };
        EditsPaneView.prototype.showDetails = /** */
        function (event) {
            var $target = $(event.currentTarget);
            $target.parent().next().toggleClass('hide');
        };
        EditsPaneView.prototype.setEdits = /** */
        function (event) {
            var groups = this.model.get('editGroups'), edits = event.edits, editsType = this.getEditsType(edits), that = this;
            switch(editsType) {
                case EDITS_TYPE.MNE:
                    edits = this.getMNEEdits(edits);
                    break;
                case EDITS_TYPE.INPATIENT:
                    edits = this.getInpatientEdits(edits);
                    break;
                case EDITS_TYPE.OUTPATIENT:
                    edits = this.getOutpatientEdits(edits);
                    break;
                case EDITS_TYPE.UNKNOWN:
                    break;
                default:
                    break;
            }
            _.each(edits, function (edit) {
                edit.type = edit.type || editsType;
                if(editsType === EDITS_TYPE.MNE) {
                    edit.type = editsType;
                    that.setMneNote(edit);
                }
                edit.category = event.category;
                edit.id = (editsType === EDITS_TYPE.MNE) ? edit.type + '-' + edit.category + '-' + edit.policy_id + '-' + edit.code + '-' + edit.sequence : edit.type + '-' + edit.category + '-' + edit.id + '-' + edit.content_type + '-' + edit.source_field + '-' + edit.position;
            });
            groups.remove(groups.where({
                category: event.category
            }));
            groups.add(edits);
            this.render();
        };
        EditsPaneView.prototype.getEditsType = function (edits) {
            if(edits.hcpcs_procedures) {
                return EDITS_TYPE.MNE;
            }
            if(edits.drg_calculation_results) {
                return EDITS_TYPE.INPATIENT;
            }
            if(edits.outpatient_calculation_results) {
                return EDITS_TYPE.OUTPATIENT;
            }
            return EDITS_TYPE.UNKNOWN;
        };
        EditsPaneView.prototype.setMneNote = /**
        * Set the MNE notes. Usually this logic/localizaton would be handled in the view template but given the complexity
        * and number of possibilities handling it here first promotes template readibility
        * @private
        */
        function (edit) {
            var noteKey = 'policy-type-';
            noteKey += (edit.policy_type === 2) ? '2' : 'other';
            if(edit.severity_status === 3) {
                noteKey += '-3';
            }
            var codeType = /^[0-9]/.test(edit.code.toString()) ? 'CPT4' : 'HCPCS';
            edit.intro = TextEdits[noteKey].replace('{0}', '<a class="code" href="javascript:void(0)" data-code-type="' + codeType + '">' + edit.code + '</a>');
        };
        EditsPaneView.prototype.render = function () {
            var groups = this.model.get('editGroups'), groupJSON = {
                'MCE': [],
                'OCE': [],
                'TruCode': [],
                'MNE': [],
                'RAC': []
            };
            if(groups && groups.length) {
                $.extend(groupJSON, _.groupBy(groups.toJSON(), function (editGroup) {
                    return editGroup.type;
                }));
                this.$el.html(this.template({
                    keys: _.keys(groupJSON),
                    groups: groupJSON,
                    TextEdits: TextEdits
                }));
            } else {
                this.$el.html(this.emptyTemplate());
            }
            this.$('a[data-code-type]').addClass('code');
            return this;
        };
        EditsPaneView.prototype.showOverflow = function (e) {
            var $target = $(e.currentTarget);
            $target.closest('.overflow').prev('.description').removeClass('hide');
            $target.closest('.overflow').remove();
        };
        EditsPaneView.prototype.setLoading = /** */
        function (notDone) {
            if(typeof notDone === 'undefined' || !notDone) {
                this.$('.tc-loading').remove();
            } else {
                this.$(this.contentContainerSelector).prepend('<span class="k-loading k-icon tc-loading">Loading</span>');
            }
        };
        EditsPaneView.prototype.clear = /**
        * listens Events.ResearchClear
        */
        function (event) {
            if(typeof event === 'undefined' || typeof event.pane === 'undefined' || event.pane === "edits") {
                this.model.get('editGroups').reset();
                this.$el.html(this.emptyTemplate());
            }
        };
        EditsPaneView.prototype.toggleView = function (e, keymasterEvent) {
            e.stopPropagation();
            $(e.target).closest('.accordion-heading').toggleClass('collapsed').find('.toggle-icon').toggleClass('k-plus k-minus');
            // ANIMATION
            var duration = (api.TC.current().settings.effects) ? 600 : 0;
            $(e.target).closest('.accordion-group').find('.section-items').slideToggle(duration);
        };
        EditsPaneView.prototype.handleError = function () {
            // handle
                    };
        EditsPaneView.prototype.getInpatientEdits = //#region Edits Parsers
        function (inpatientResponse) {
            var editContent = [];
            if(inpatientResponse && inpatientResponse.drg_calculation_results) {
                // find grouper edits
                if(inpatientResponse.drg_calculation_results.drg_calculation_result && inpatientResponse.drg_calculation_results.drg_calculation_result.length) {
                    // add grouper edits
                    for(var i = 0; i < inpatientResponse.drg_calculation_results.drg_calculation_result.length; i++) {
                        if(inpatientResponse.drg_calculation_results.drg_calculation_result[i].edits) {
                            editContent = editContent.concat(inpatientResponse.drg_calculation_results.drg_calculation_result[i].edits.edit);
                        }
                    }
                }
                // add trucode edits
                if(inpatientResponse.drg_calculation_results.edits && inpatientResponse.drg_calculation_results.edits.edit) {
                    editContent = editContent.concat(inpatientResponse.drg_calculation_results.edits.edit);
                }
            }
            return editContent;
        };
        EditsPaneView.prototype.getOutpatientEdits = function (outpatientResponse) {
            var editContentCollection = [], editsSection;
            if(outpatientResponse && outpatientResponse.outpatient_calculation_results) {
                // find grouper edits
                if(outpatientResponse.outpatient_calculation_results.asc_calculation_result) {
                    editsSection = outpatientResponse.outpatient_calculation_results.asc_calculation_result.edits;
                }
                if(outpatientResponse.outpatient_calculation_results.apc_calculation_result) {
                    editsSection = outpatientResponse.outpatient_calculation_results.apc_calculation_result.edits;
                }
                // add grouper edits
                if(editsSection && editsSection.edit) {
                    editContentCollection = editContentCollection.concat(editsSection.edit);
                }
                // add trucode edits
                if(outpatientResponse.outpatient_calculation_results.edits) {
                    editContentCollection = editContentCollection.concat(outpatientResponse.outpatient_calculation_results.edits.edit);
                }
            }
            return editContentCollection;
        };
        EditsPaneView.prototype.getMNEEdits = function (mneResponse) {
            var mneEdits = [];
            _.each(mneResponse.hcpcs_procedures, function (procedure) {
                _.each(procedure.policies, function (policy) {
                    policy.code = procedure.code;
                    policy.sequence = procedure.sequence;
                    mneEdits.push(policy);
                });
            });
            return mneEdits;
        };
        return EditsPaneView;
    })(Backbone.View);
    exports.EditsPaneView = EditsPaneView;    
    //#endregion
    })
;
define('text!controls/research/templates/icd10map-pane/empty.html',[],function () { return '<div class="icd10map-content content content-full pane-text pane-full-border">\r\n    <div class="heading">ICD-10 Code Mapping</div>\r\n    <p>Please select an ICD-9-CM code to see the equivalent ICD-10 code(s).</p>\r\n</div>';});

define('text!controls/research/templates/icd10map-pane/result.html',[],function () { return '<div class="icd10map-content content content-full pane-text pane-full-border">\r\n    <div class="heading">ICD-10 Code Mapping</div>\r\n    <div class="original-code">\r\n        <div class="icd9-code">ICD-9 CM Code</div>\r\n        <div class="code-wrap"><a class="code" href="javascript:void(0)" data-book="<%= data.icd9_code.code_type %>"><%= data.icd9_code.value %></a> <span class="description"><%= data.icd9_code.medium_description %></span></div>\r\n    </div>\r\n\r\n    <div class="scenario-wrapper">\r\n    <% var scenarioLength = data.scenarios.length; %>\r\n    <% if (scenarioLength > 1) { %>\r\n        <p class="alert notification">Please choose one of the scenarios below, following the instruction for that specific scenario.</p>\r\n    <% } %>\r\n    <% _.forEach(data.scenarios, function(scenario, h) { %>\r\n        <% var scenarioCodeListLength = scenario.codelists.length; %>\r\n        <div class="scenario">\r\n            <% if (scenarioLength > 1) { %>\r\n            <div class="scenario-title">Scenario <%= h + 1 %></div>\r\n                <% if (scenarioCodeListLength > 1) { %>\r\n            <p class="instruction">The single most appropriate <%= TextBook[\'MAP_\' + data.scenarios[0].code_type] || \'ICD-10-CM\' %> code from each of the lists should be selected.</p>\r\n                <% } else { %>\r\n            <p class="instruction">The single most appropriate <%= TextBook[\'MAP_\' + data.scenarios[0].code_type] || \'ICD-10-CM\' %> code should be selected.</p>\r\n                <% } %>\r\n            <% } %>\r\n            <div class="scenario-title"><%= TextBook[\'MAP_\' + scenario.code_type] || \'ICD-10-CM\' %> Code(s)</div>\r\n            <% if (scenarioLength === 1) { %>            \r\n                <% if (scenarioCodeListLength > 1) { %>\r\n                <p class="instruction">The single most appropriate <%= TextBook[\'MAP_\' + data.scenarios[0].code_type] || \'ICD-10-CM\' %> code from each of the lists should be selected.</p>\r\n                <% } else { %>\r\n                <p class="instruction">The single most appropriate <%= TextBook[\'MAP_\' + data.scenarios[0].code_type] || \'ICD-10-CM\' %> code should be selected.</p>\r\n                <% } %>\r\n            <% } %>\r\n            <% _.forEach(scenario.codelists, function(codelistWrapper, i) { %>\r\n                <% if (scenarioCodeListLength > 1) { %><span class="list-label">List <%= i + 1 %></span><% } %>\r\n                <% _.each(codelistWrapper.codelist, function(cl) { %>\r\n                    <div class="code-wrapper"><a class="code" href="javascript:void(0)" data-book="<%= cl.code_type %>"><%= cl.value %></a> <span><%= cl.medium_description %></span></div>\r\n                <% }); %>\r\n            <% }); %>\r\n        </div>\r\n    <% }); %>\r\n    </div>\r\n</div>';});

var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/views/icd10mapPane',["require", "exports", "Backbone", "underscore", "jql", "text!controls/research/templates/icd10map-pane/empty.html", "text!controls/research/templates/icd10map-pane/result.html", "text!controls/common/templates/loading-large.html", "lib/api", "lib/events", "lib/net", "lib/shortcuts", "lib/templates", "i18n!locale/nls/books"], function(require, exports, __Backbone__, _____, __$__, __ITE__, __IT__, __loadingTemplate__, __api__, __Events__, __net__, __Shortcuts__, __Templates__, __TextBook__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var ITE = __ITE__;

    var IT = __IT__;
    /// <reference path="../../common/templates/templates.d.ts" />
    
    var loadingTemplate = __loadingTemplate__;

    var api = __api__;

    var Events = __Events__;

    var net = __net__;

    var Shortcuts = __Shortcuts__;

    var Templates = __Templates__;
    ///<reference path="../../../locale/nls/locales.d.ts"/>
    
    var TextBook = __TextBook__;

    var ICD10MapPaneView = (function (_super) {
        __extends(ICD10MapPaneView, _super);
        function ICD10MapPaneView(options) {
            // Force include
            if(TextBook || !TextBook) {
            }
            this.hub = options.hub;
            this.contentContainerSelector = '.icd10map-content';
            this.template = Templates.compile('icd10mapTab', IT);
            this.emptyTemplate = Templates.compile('icd10mapTabEmpty', ITE);
            this.templateLoading = Templates.get(Templates.tk_loadingLarge, loadingTemplate);
            this.events = {
                'click': 'tcSetFocus',
                'click .code': 'codeClicked'
            };
            this.scopeName = 'researchPane:icd10map';
            this.shortcuts = {
            };
                _super.call(this, options);
        }
        ICD10MapPaneView.prototype.initialize = function () {
            this.tcInit();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.hub, Events.ResearchCodeInContext, this.searchForMapping);
            this.listenTo(this.hub, Events.ResearchClear, this.clear);
        };
        ICD10MapPaneView.prototype.codeClicked = /** */
        function (event) {
            var $target = $(event.currentTarget), eventOptions;
            eventOptions = {
                code: $target.text(),
                codeType: $target.attr('data-book'),
                pane: 'icd10map'
            };
            this.hub.trigger(Events.ResearchCodeSelected, eventOptions);
        };
        ICD10MapPaneView.prototype.searchForMapping = /** */
        function (event) {
            if(event.book.toUpperCase().indexOf('ICD9') !== -1) {
                var getMapOptions = net.Net.mapToGetResearch(event);
                this.setLoading(true);
                net.Net.tryAbort(this.currentReq);
                this.currentReq = api.TC.current()._net.researchGetICD10Mapping(getMapOptions, this.renderResults, this.clear);
            } else {
                this.clear();
            }
        };
        ICD10MapPaneView.prototype.renderResults = /** */
        function (data) {
            this.setLoading(false);
            this.$el.html(this.template({
                data: data,
                TextBook: TextBook
            }));
        };
        ICD10MapPaneView.prototype.render = /** */
        function () {
            this.$el.html(this.emptyTemplate());
            return this;
        };
        ICD10MapPaneView.prototype.setLoading = /** */
        function (notDone) {
            if(typeof notDone === 'undefined' || !notDone) {
                this.$('.tc-loading').remove();
            } else {
                this.$(this.contentContainerSelector).html(this.templateLoading);
            }
        };
        ICD10MapPaneView.prototype.clear = /**
        * @listens Events.ResearchClear
        */
        function (event) {
            if(typeof event === 'undefined' || typeof event.pane === 'undefined' || event.pane === "icd10map") {
                net.Net.tryAbort(this.currentReq);
                this.$el.html(this.emptyTemplate());
            }
        };
        ICD10MapPaneView.prototype.handleError = function () {
            // handle
                    };
        return ICD10MapPaneView;
    })(Backbone.View);
    exports.ICD10MapPaneView = ICD10MapPaneView;    
})
;
define('text!controls/research/templates/drg-analyze-pane/result.html',[],function () { return '<div class="drg-analyze-content content content-full pane-text pane-full-border">\r\n    <div class="heading">Suggested DRGs for <%= data.initial_drg %></div>\r\n    <% _.each(data.suggestions, function(suggestion) { %>\r\n    <div class="alternative">\r\n        <div class="drg-wrap">\r\n            <div class="drg"><%= suggestion.suggested_drg %></div>\r\n            <div class="description"><%= suggestion.drg_description %></div>\r\n            <div class="weight">(Wt: <%= suggestion.drg_weight %>)</div>\r\n        </div>\r\n        <% _.each(suggestion.requirements, function(requirement) { %>\r\n        <div class="requirement">\r\n            <strong>Requirement</strong>\r\n            <p><%= requirement.description %></p>\r\n            <% _.each(requirement.codelists, function(codelistWrapper) { %>\r\n                <% var len = (codelistWrapper.codelist && codelistWrapper.codelist.length) ? codelistWrapper.codelist.length : 0; %>\r\n                <% if (len > 0) { %>\r\n                    <strong>Codes</strong>\r\n                    <% if (codelistWrapper.display_name) { %><p><%= codelistWrapper.display_name %></p><% } %>\r\n                    <% _.forEach(codelistWrapper.codelist, function(code, i) { %>\r\n                        <% if (i === 9) { %>\r\n                            <a class="show-all" href="javascript:void(0)">Show all <%= len %> codes</a>\r\n                            <div class="overflow hide">\r\n                        <% } %>\r\n                        <div class="code-wrapper">\r\n                            <a class="code" href="javascript:void(0)" data-code-type="<%= code.code_type %>"><%= code.value %></a> <span><%= code.medium_description %></span>\r\n                        </div>\r\n                        <% if (i > 8 && i + 1 === len) { %>\r\n                            </div>\r\n                        <% } %>\r\n                    <% }); %>\r\n                <% } %>\r\n        <% }); %>\r\n        </div>\r\n        <% }); %>\r\n    </div>\r\n    <% }); %>\r\n</div>\r\n';});

define('text!controls/research/templates/drg-analyze-pane/empty.html',[],function () { return '<div class="drg-analyze-content content content-full pane-text pane-full-border">\r\n    <div class="warning notification">\r\n        <p>There are no likely alternatives to your current DRG.</p>\r\n    </div>\r\n</div>';});

var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/views/drgAnalyzePane',["require", "exports", "Backbone", "underscore", "jql", "text!controls/common/templates/loading-large.html", "text!controls/research/templates/drg-analyze-pane/result.html", "text!controls/research/templates/drg-analyze-pane/empty.html", "controls/research/models/edits/editsViewModel", "lib/api", "lib/events", "lib/net", "lib/shortcuts", "lib/templates", "i18n!locale/nls/edits"], function(require, exports, __Backbone__, _____, __$__, __loadingTemplate__, __DAT__, __DATN__, __EVM__, __api__, __Events__, __net__, __Shortcuts__, __Templates__, __TextEdits__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    /// <reference path="../../common/templates/templates.d.ts" />
    
    var loadingTemplate = __loadingTemplate__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var DAT = __DAT__;

    var DATN = __DATN__;

    var EVM = __EVM__;

    
    
    var api = __api__;

    var Events = __Events__;

    var net = __net__;

    var Shortcuts = __Shortcuts__;

    var Templates = __Templates__;
    ///<reference path="../../../locale/nls/locales.d.ts"/>
    
    var TextEdits = __TextEdits__;

    var DRGAnalyzePaneView = (function (_super) {
        __extends(DRGAnalyzePaneView, _super);
        function DRGAnalyzePaneView(options) {
            // Force include
            if(TextEdits || !TextEdits) {
            }
            this.hub = options.hub;
            this.model = new EVM.EditsViewModel();
            this.contentContainerSelector = '.content';
            this.template = Templates.compile(Templates.tk_drgAnalysisTab, DAT);
            this.emptyTemplate = Templates.compile(Templates.tk_drgAnalysisTabNone, DATN);
            this.templateLoading = Templates.get(Templates.tk_loadingLarge, loadingTemplate);
            this.events = {
                'click': 'tcSetFocus',
                'click .show-all': 'showOverflow',
                'click a.code': 'handleCodeClick'
            };
            this.scopeName = 'researchPane:drgAnalysis';
            this.shortcuts = {
            };
                _super.call(this, options);
        }
        DRGAnalyzePaneView.prototype.initialize = function () {
            this.tcInit();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.hub, Events.ResearchAnalyzeDRG, this.analyze);
            this.listenTo(this.hub, Events.ResearchClear, this.clear);
        };
        DRGAnalyzePaneView.prototype.handleCodeClick = /** */
        function (event) {
            var $target = $(event.currentTarget), codeClickOptions;
            codeClickOptions = {
                codeType: $target.attr('data-code-type'),
                code: $target.text(),
                pane: 'drgAnalysis'
            };
            this.hub.trigger(Events.ResearchCodeSelected, codeClickOptions);
        };
        DRGAnalyzePaneView.prototype.showOverflow = function (event) {
            var $target = $(event.currentTarget);
            $target.next().removeClass().children(':first').unwrap();
            $target.remove();
        };
        DRGAnalyzePaneView.prototype.analyze = function (event) {
            this.setLoading(true);
            net.Net.tryAbort(this.currentReq);
            this.currentReq = api.TC.current()._net.drgAnalyze(event, this.render, this.handleError);
        };
        DRGAnalyzePaneView.prototype.setLoading = /** */
        function (notDone) {
            if(typeof notDone === 'undefined' || !notDone) {
                this.$('.tc-loading').remove();
            } else {
                this.$(this.contentContainerSelector).html(this.templateLoading);
            }
        };
        DRGAnalyzePaneView.prototype.clear = /**
        * @listens Events.ResearchClear
        */
        function (event) {
            if(typeof event === 'undefined' || typeof event.pane === 'undefined' || event.pane === "drgAnalysis") {
                net.Net.tryAbort(this.currentReq);
                this.$el.html(this.emptyTemplate());
            }
        };
        DRGAnalyzePaneView.prototype.render = /** */
        function (data) {
            if(data && data.suggestions.length > 0) {
                this.$el.html(this.template({
                    data: data
                }));
            } else {
                this.$el.html(this.emptyTemplate());
            }
            return this;
        };
        DRGAnalyzePaneView.prototype.handleError = function () {
            this.setLoading(false);
            this.$el.html(this.emptyTemplate());
        };
        return DRGAnalyzePaneView;
    })(Backbone.View);
    exports.DRGAnalyzePaneView = DRGAnalyzePaneView;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/models/researchViewModel',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var ResearchViewModel = (function (_super) {
        __extends(ResearchViewModel, _super);
        function ResearchViewModel(options) {
            this.defaults = {
                activePane: options.activePane || 'research',
                visiblePanes: [
                    'drgAnalysis', 
                    'icd10map', 
                    'research', 
                    'edits'
                ]
            };
                _super.call(this, options);
        }
        ResearchViewModel.prototype.initialize = function () {
            if(this.get('visiblePanes').length === 0) {
                this.set('visiblePanes', [
                    'drgAnalysis', 
                    'icd10map', 
                    'research', 
                    'edits'
                ]);
            }
        };
        return ResearchViewModel;
    })(Backbone.Model);
    exports.ResearchViewModel = ResearchViewModel;    
})
;
define('kendoui/kendo.tabstrip',["kendoui/kendo.jquery","kendoui/kendo.core","kendoui/kendo.data","kendoui/kendo.fx"],function(e,t){var n=t.ui,r=t.keys,i=e.map,a=e.each,s=e.trim,o=e.extend,l=t.template,d=n.Widget,c=/^(a|div)$/i,u=".kendoTabStrip",f="img",p="href",m="prev",h="k-link",v="k-last",g="click",k="error",b=":empty",C="k-image",_="k-first",x="select",A="activate",E="k-content",G="contentUrl",w="mouseenter",S="mouseleave",y="contentLoad",T="k-state-disabled",U="k-state-default",F="k-state-active",H="k-state-focused",q="k-state-hover",I="k-tab-on-top",R=".k-item:not(."+T+")",D=".k-tabstrip-items > "+R+":not(."+F+")",N={content:l("<div class='k-content'#= contentAttributes(data) # role='tabpanel'>#= content(item) #</div>"),itemWrapper:l("<#= tag(item) # class='k-link'#= contentUrl(item) ##= textAttributes(item) #>"+"#= image(item) ##= sprite(item) ##= text(item) #"+"</#= tag(item) #>"),item:l("<li class='#= wrapperCssClass(group, item) #' role='tab' #=item.active ? \"aria-selected='true'\" : ''#>"+"#= itemWrapper(data) #"+"</li>"),image:l("<img class='k-image' alt='' src='#= imageUrl #' />"),sprite:l("<span class='k-sprite #= spriteCssClass #'></span>"),empty:l("")},B={wrapperCssClass:function(e,t){var n="k-item",r=t.index;if(t.enabled===false){n+=" k-state-disabled"}else{n+=" k-state-default"}if(r===0){n+=" k-first"}if(r==e.length-1){n+=" k-last"}return n},textAttributes:function(e){return e.url?" href='"+e.url+"'":""},text:function(e){return e.encoded===false?e.text:t.htmlEncode(e.text)},tag:function(e){return e.url?"a":"span"},contentAttributes:function(e){return e.active!==true?" style='display:none' aria-hidden='true' aria-expanded='false'":""},content:function(e){return e.content?e.content:e.contentUrl?"":"&nbsp;"},contentUrl:function(e){return e.contentUrl?t.attr("content-url")+'="'+e.contentUrl+'"':""}};function O(t){t.children(f).addClass(C);t.children("a").addClass(h).children(f).addClass(C);t.filter(":not([disabled]):not([class*=k-state-disabled])").addClass(U);t.filter("li[disabled]").addClass(T).removeAttr("disabled");t.filter(":not([class*=k-state])").children("a").filter(":focus").parent().addClass(F+" "+I);t.attr("role","tab");t.filter("."+F).attr("aria-selected",true);t.each(function(){var t=e(this);if(!t.children("."+h).length){t.contents().filter(function(){return!this.nodeName.match(c)&&!(this.nodeType==3&&!s(this.nodeValue))}).wrapAll("<a class='"+h+"'/>")}})}function j(e){var t=e.children(".k-item");t.filter(".k-first:not(:first-child)").removeClass(_);t.filter(".k-last:not(:last-child)").removeClass(v);t.filter(":first-child").addClass(_);t.filter(":last-child").addClass(v)}var W=d.extend({init:function(n,r){var i=this;d.fn.init.call(i,n,r);i._animations(i.options);if(i.element.is("ul")){i.wrapper=i.element.wrapAll("<div />").parent()}else{i.wrapper=i.element}r=i.options;i._isRtl=t.support.isRtl(i.wrapper);i._tabindex();i._updateClasses();i._dataSource();if(r.dataSource){i.dataSource.fetch()}if(i.options.contentUrls){i.wrapper.find(".k-tabstrip-items > .k-item").each(function(t,n){e(n).find(">."+h).data(G,i.options.contentUrls[t])})}i.wrapper.on(w+u+" "+S+u,D,i._toggleHover).on("keydown"+u,e.proxy(i._keydown,i)).on("focus"+u,e.proxy(i._active,i)).on("blur"+u,function(){i._current(null)});i.wrapper.children(".k-tabstrip-items").on(g+u,".k-state-disabled .k-link",false).on(g+u," > "+R,function(t){if(i._click(e(t.currentTarget))){t.preventDefault()}});var a=i.tabGroup.children("li."+F),s=i.contentHolder(a.index());if(s.length>0&&s[0].childNodes.length===0){i.activateTab(a.eq(0))}i.element.attr("role","tablist");if(i.element[0].id){i._ariaId=i.element[0].id+"_ts_active"}t.notify(i)},_active:function(){var e=this.tabGroup.children().filter("."+F);e=e[0]?e:this._endItem("first");if(e[0]){this._current(e)}},_endItem:function(e){return this.tabGroup.children(R)[e]()},_item:function(e,t){var n;if(t===m){n="last"}else{n="first"}if(!e){return this._endItem(n)}e=e[t]();if(!e[0]){e=this._endItem(n)}if(e.hasClass(T)){e=this._item(e,t)}return e},_current:function(e){var t=this,n=t._focused,r=t._ariaId;if(e===undefined){return n}if(n){if(n[0].id===r){n.removeAttr("id")}n.removeClass(H)}if(e){if(!e.hasClass(F)){e.addClass(H)}t.element.removeAttr("aria-activedescendant");r=e[0].id||r;if(r){e.attr("id",r);t.element.attr("aria-activedescendant",r)}}t._focused=e},_keydown:function(e){var t=this,n=e.keyCode,i=t._current(),a=t._isRtl,s;if(e.target!=e.currentTarget){return}if(n==r.DOWN||n==r.RIGHT){s=a?m:"next"}else if(n==r.UP||n==r.LEFT){s=a?"next":m}else if(n==r.ENTER||n==r.SPACEBAR){t._click(i);e.preventDefault()}else if(n==r.HOME){t._click(t._endItem("first"));e.preventDefault();return}else if(n==r.END){t._click(t._endItem("last"));e.preventDefault();return}if(s){t._click(t._item(i,s));e.preventDefault()}},_dataSource:function(){var n=this;if(n.dataSource&&n._refreshHandler){n.dataSource.unbind("change",n._refreshHandler)}else{n._refreshHandler=e.proxy(n.refresh,n)}n.dataSource=t.data.DataSource.create(n.options.dataSource).bind("change",n._refreshHandler)},setDataSource:function(e){this.options.dataSource=e;this._dataSource();e.fetch()},_animations:function(e){if(e&&"animation"in e&&!e.animation){e.animation={open:{effects:{}},close:{effects:{}}}}},refresh:function(e){var n=this,r=n.options,i=t.getter(r.dataTextField),a=t.getter(r.dataContentField),s=t.getter(r.dataContentUrlField),o=t.getter(r.dataImageUrlField),l=t.getter(r.dataUrlField),d=t.getter(r.dataSpriteCssClass),c,u=[],f,p,m=n.dataSource.view(),h;e=e||{};p=e.action;if(p){m=e.items}for(c=0,h=m.length;c<h;c++){f={text:i(m[c])};if(r.dataContentField){f.content=a(m[c])}if(r.dataContentUrlField){f.contentUrl=s(m[c])}if(r.dataUrlField){f.url=l(m[c])}if(r.dataImageUrlField){f.imageUrl=o(m[c])}if(r.dataSpriteCssClass){f.spriteCssClass=d(m[c])}u[c]=f}if(e.action=="add"){if(e.index<n.tabGroup.children().length){n.insertBefore(u,n.tabGroup.children().eq(e.index))}else{n.append(u)}}else if(e.action=="remove"){for(c=0;c<m.length;c++){n.remove(e.index)}}else if(e.action=="itemchange"){c=n.dataSource.view().indexOf(m[0]);if(e.field===r.dataTextField){n.tabGroup.children().eq(c).find(".k-link").text(m[0].get(e.field))}}else{n.trigger("dataBinding");n.remove("li");n.append(u);n.trigger("dataBound")}},value:function(t){var n=this;if(t!==undefined){if(t!=n.value()){n.tabGroup.children().each(function(){if(e.trim(e(this).text())==t){n.select(this)}})}}else{return n.select().text()}},items:function(){return this.tabGroup[0].children},setOptions:function(e){var t=this.options.animation;this._animations(e);e.animation=o(true,t,e.animation);d.fn.setOptions.call(this,e)},events:[x,A,k,y,"change","dataBinding","dataBound"],options:{name:"TabStrip",dataTextField:"",dataContentField:"",dataImageUrlField:"",dataUrlField:"",dataSpriteCssClass:"",dataContentUrlField:"",animation:{open:{effects:"expand:vertical fadeIn",duration:200},close:{duration:200}},collapsible:false},destroy:function(){var e=this;d.fn.destroy.call(e);if(e._refreshHandler){e.dataSource.unbind("change",e._refreshHandler)}e.wrapper.off(u);t.destroy(e.wrapper)},select:function(t){var n=this;if(arguments.length===0){return n.tabGroup.children("li."+F)}if(!isNaN(t)){t=n.tabGroup.children().get(t)}t=n.tabGroup.find(t);e(t).each(function(t,r){r=e(r);if(!r.hasClass(F)&&!n.trigger(x,{item:r[0],contentElement:n.contentHolder(r.index())[0]})){n.activateTab(r)}});return n},enable:function(e,t){this._toggleDisabled(e,t!==false);return this},disable:function(e){this._toggleDisabled(e,false);return this},reload:function(t){t=this.tabGroup.find(t);var n=this;t.each(function(){var t=e(this),r=t.find("."+h).data(G),i=n.contentHolder(t.index());if(r){n.ajaxRequest(t,i,null,r)}});return n},append:function(e){var t=this,n=t._create(e);a(n.tabs,function(e){t.tabGroup.append(this);t.wrapper.append(n.contents[e])});j(t.tabGroup);t._updateContentElements();return t},insertBefore:function(t,n){var r=this,i=r._create(t),s=e(r.contentElement(n.index()));a(i.tabs,function(e){n.before(this);s.before(i.contents[e])});j(r.tabGroup);r._updateContentElements();return r},insertAfter:function(t,n){var r=this,i=r._create(t),s=e(r.contentElement(n.index()));a(i.tabs,function(e){n.after(this);s.after(i.contents[e])});j(r.tabGroup);r._updateContentElements();return r},remove:function(t){var n=this,r=typeof t,i=e();if(r==="string"){t=n.tabGroup.find(t)}else if(r==="number"){t=n.tabGroup.children().eq(t)}t.each(function(){i.push(n.contentElement(e(this).index()))});t.remove();i.remove();n._updateContentElements();return n},_create:function(t){var n=e.isPlainObject(t),r=this,a,s;if(n||e.isArray(t)){t=e.isArray(t)?t:[t];a=i(t,function(t,n){return e(W.renderItem({group:r.tabGroup,item:o(t,{index:n})}))});s=i(t,function(t,n){if(t.content||t.contentUrl){return e(W.renderContent({item:o(t,{index:n})}))}})}else{a=e(t);s=e("<div class='"+E+"'/>");O(a)}return{tabs:a,contents:s}},_toggleDisabled:function(t,n){t=this.tabGroup.find(t);t.each(function(){e(this).toggleClass(U,n).toggleClass(T,!n)})},_updateClasses:function(){var t=this,n,r,i;t.wrapper.addClass("k-widget k-header k-tabstrip");t.tabGroup=t.wrapper.children("ul").addClass("k-tabstrip-items k-reset");if(!t.tabGroup[0]){t.tabGroup=e("<ul class='k-tabstrip-items k-reset'/>").appendTo(t.wrapper)}n=t.tabGroup.find("li").addClass("k-item");if(n.length){r=n.filter("."+F).index();i=r>=0?r:undefined;t.tabGroup.contents().filter(function(){return this.nodeType==3&&!s(this.nodeValue)}).remove()}if(r>=0){n.eq(r).addClass(I)}t.contentElements=t.wrapper.children("div");t.contentElements.addClass(E).eq(i).addClass(F).css({display:"block"});if(n.length){O(n);j(t.tabGroup);t._updateContentElements()}},_updateContentElements:function(){var n=this,r=n.options.contentUrls||[],i=n.element.attr("id"),a=n.wrapper.children("div");n.tabGroup.find(".k-item").each(function(t){var s=a.eq(t),o=i+"-"+(t+1);this.setAttribute("aria-controls",o);if(!s.length&&r[t]){e("<div id='"+o+"' class='"+E+"'/>").appendTo(n.wrapper)}else{s.attr("id",o)}s.attr("role","tabpanel");s.filter(":not(."+F+")").attr("aria-hidden",true).attr("aria-expanded",false);s.filter("."+F).attr("aria-expanded",true)});n.contentElements=n.contentAnimators=n.wrapper.children("div");if(t.kineticScrollNeeded&&t.mobile.ui.Scroller){t.touchScroller(n.contentElements);n.contentElements=n.contentElements.children(".km-scroll-container")}},_toggleHover:function(t){e(t.currentTarget).toggleClass(q,t.type==w)},_click:function(e){var t=this,n=e.find("."+h),r=n.attr(p),i=t.options.collapsible,a=t.contentHolder(e.index()),s,o;if(e.closest(".k-widget")[0]!=t.wrapper[0]){return}if(e.is("."+T+(!i?",."+F:""))){return true}o=n.data(G)||r&&(r.charAt(r.length-1)=="#"||r.indexOf("#"+t.element[0].id+"-")!=-1);s=!r||o;if(t.tabGroup.children("[data-animating]").length){return s}if(t.trigger(x,{item:e[0],contentElement:a[0]})){return true}if(s===false){return}if(i&&e.is("."+F)){t.deactivateTab(e);return true}if(t.activateTab(e)){s=true}return s},deactivateTab:function(e){var n=this,r=n.options.animation,i=r.open,a=o({},r.close),s=a&&"effects"in a;e=n.tabGroup.find(e);a=o(s?a:o({reverse:true},i),{hide:true});if(t.size(i.effects)){e.kendoAddClass(U,{duration:i.duration});e.kendoRemoveClass(F,{duration:i.duration})}else{e.addClass(U);e.removeClass(F)}e.removeAttr("aria-selected");n.contentAnimators.filter("."+F).kendoStop(true,true).kendoAnimate(a).removeClass(F).attr("aria-hidden",true)},activateTab:function(e){e=this.tabGroup.find(e);var n=this,r=n.options.animation,i=r.open,a=o({},r.close),s=a&&"effects"in a,l=e.parent().children(),d=l.filter("."+F),c=l.index(e);a=o(s?a:o({reverse:true},i),{hide:true});if(t.size(i.effects)){d.kendoRemoveClass(F,{duration:a.duration});e.kendoRemoveClass(q,{duration:a.duration})}else{d.removeClass(F);e.removeClass(q)}var u=n.contentAnimators;if(e.data("in-request")){n.xhr.abort();e.removeAttr("data-in-request")}if(u.length===0){d.removeClass(I);e.addClass(I).css("z-index");e.addClass(F);n._current(e);n.trigger("change");return false}var f=u.filter("."+F),p=n.contentHolder(c),m=p.closest(".k-content");if(p.length===0){f.removeClass(F).attr("aria-hidden",true).kendoStop(true,true).kendoAnimate(a);return false}e.attr("data-animating",true);var v=(e.children("."+h).data(G)||false)&&p.is(b),g=function(){d.removeClass(I);e.addClass(I).css("z-index");if(t.size(i.effects)){d.kendoAddClass(U,{duration:i.duration});e.kendoAddClass(F,{duration:i.duration})}else{d.addClass(U);e.addClass(F)}d.removeAttr("aria-selected");e.attr("aria-selected",true);n._current(e);m.addClass(F).removeAttr("aria-hidden").kendoStop(true,true).attr("aria-expanded",true).kendoAnimate(o({init:function(){n.trigger(A,{item:e[0],contentElement:p[0]})}},i,{complete:function(){e.removeAttr("data-animating")}}))},k=function(){if(!v){g();n.trigger("change")}else{e.removeAttr("data-animating");n.ajaxRequest(e,p,function(){e.attr("data-animating",true);g();n.trigger("change")})}};f.removeClass(F);f.attr("aria-hidden",true);f.attr("aria-expanded",false);if(f.length){f.kendoStop(true,true).kendoAnimate(o({complete:k},a))}else{k()}return true},contentElement:function(e){if(isNaN(e-0)){return undefined}var n=this.contentElements&&this.contentElements[0]&&!t.kineticScrollNeeded?this.contentElements:this.contentAnimators,r=new RegExp("-"+(e+1)+"$");if(n){for(var i=0,a=n.length;i<a;i++){if(r.test(n.closest(".k-content")[i].id)){return n[i]}}}return undefined},contentHolder:function(n){var r=e(this.contentElement(n)),i=r.children(".km-scroll-container");return t.support.touch&&i[0]?i:r},ajaxRequest:function(t,n,r,i){t=this.tabGroup.find(t);if(t.find(".k-loading").length){return}var a=this,s=t.find("."+h),o={},l=null,d=setTimeout(function(){l=e("<span class='k-icon k-loading'/>").prependTo(s)},100);i=i||s.data(G)||s.attr(p);t.attr("data-in-request",true);a.xhr=e.ajax({type:"GET",cache:false,url:i,dataType:"html",data:o,error:function(e,t){if(a.trigger("error",{xhr:e,status:t})){this.complete()}},complete:function(){t.removeAttr("data-in-request");clearTimeout(d);if(l!==null){l.remove()}},success:function(e){try{n.html(e)}catch(s){var o=window.console;if(o&&o.error){o.error(s.name+": "+s.message+" in "+i)}this.error(this.xhr,"error")}if(r){r.call(a,n)}a.trigger(y,{item:t[0],contentElement:n[0]})}})}});o(W,{renderItem:function(e){e=o({tabStrip:{},group:{}},e);var t=N.empty,n=e.item;return N.item(o(e,{image:n.imageUrl?N.image:t,sprite:n.spriteCssClass?N.sprite:t,itemWrapper:N.itemWrapper},B))},renderContent:function(e){return N.content(o(e,B))}});t.ui.plugin(W)});
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/research/views/research',["require", "exports", "Backbone", "underscore", "jql", "text!controls/research/templates/research.html", "controls/research/views/researchPane", "controls/research/views/editsPane", "controls/research/views/icd10mapPane", "controls/research/views/drgAnalyzePane", "controls/research/models/researchViewModel", "kendoui/kendo.core", "kendoui/kendo.tabstrip", "lib/api", "lib/templates", "lib/events"], function(require, exports, __Backbone__, _____, __$__, __RPT__, __RV__, __EV__, __I10V__, __DAV__, __RPVM__, __KC__, __KT__, __api__, __Templates__, __Events__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var RPT = __RPT__;

    var RV = __RV__;

    var EV = __EV__;

    var I10V = __I10V__;

    var DAV = __DAV__;

    var RPVM = __RPVM__;
    ///<reference path="../../../vendor/kendoui/kendoui.d.ts"/>
    
    var KC = __KC__;

    var KT = __KT__;

    var api = __api__;

    
    var Templates = __Templates__;

    var Events = __Events__;

    
    var ResearchView = (function (_super) {
        __extends(ResearchView, _super);
        function ResearchView(options) {
            // Force include
            if(KC || !KC) {
            }
            if(KT || !KT) {
            }
            this.template = Templates.compile(Templates.tk_research, RPT);
            this.model = new RPVM.ResearchViewModel(options);
            this.childRefs = [];
            this.codeType = (options && options.codeType) ? options.codeType : null;
            this.researchSections = (options && options.researchSections) ? options.researchSections : {
            };
            this.allResearch = (options && typeof options.allResearch === 'boolean') ? options.allResearch : false;
            this.encounterType = (options && options.encounterType) ? options.encounterType : null;
            this.handleResourceClick = (options && typeof options.handleResourceClick === 'boolean') ? options.handleResourceClick : true;
            this.visible = true;
            this.isEmbedded = (options && typeof options.embedded === 'boolean') ? options.embedded : false;
                _super.call(this, options);
        }
        ResearchView.prototype.initialize = function (options) {
            this.hub = options.hub || Events.Get()// can be embedded in codebooks, try to inherit event bus
            ;
            this.globalHub = options.globalHub || Events.GetGlobal();
            this.tcInit();
            _.bindAll(this);
            this.listenTo(this.hub, Events.ResearchTabToggle, this.toggleTab);
            this.listenTo(this.hub, Events.ResearchTabSelect, this.selectTab);
        };
        ResearchView.prototype.onClose = function () {
            for(var i = 0; i < this.childRefs.length; i++) {
                this.childRefs[i].tcClose();
            }
        };
        ResearchView.prototype.selectTab = function (event) {
            var tabs = this.$('.tabstrip').data('kendoTabStrip'), tab = this.$('.tabstrip .' + event.name).closest('.k-item');
            if(tabs && tab) {
                tabs.select(tab);
            }
        };
        ResearchView.prototype.toggleTab = function (event) {
            var tab = this.$('.tabstrip .' + event.name).closest('.k-item');
            if(tab) {
                if(typeof event.action === 'string') {
                    if(event.action === 'hide') {
                        tab.hide();
                    } else if(event.action === 'show') {
                        tab.show();
                    }
                } else {
                    tab.toggle();
                }
            }
        };
        ResearchView.prototype.render = function () {
            var tabstripRef, tabToSelect, panes = this.model.get('visiblePanes'), paneLength = panes ? panes.length : 0, paneText = {
                research: 'Research<span class="research" />',
                drgAnalysis: 'DRG Analysis<span class="drgAnalysis" />',
                edits: 'Edits<span class="edits" />',
                icd10map: 'ICD-10<span class="icd10map" />'
            }, $tabstrip, $tabstripList, $tempWrapper;
            this.$el.html(this.template({
                hasTabs: paneLength > 1
            }));
            if(paneLength > 1) {
                $tabstrip = this.$('.tabstrip');
                $tabstripList = $tabstrip.find('ul');
                for(var i = 0; i < paneLength; i++) {
                    $tabstripList.append('<li>' + paneText[panes[i]] || panes[i] + '<span class="' + panes[i] + '" /></li>');
                    $tempWrapper = $('<div />').appendTo($tabstrip);
                    this.renderView(panes[i], $tempWrapper);
                }
                tabstripRef = this.createTabs();
                tabToSelect = this.$('.tabstrip .' + this.model.get('activePane')).closest('.k-item');
                tabstripRef.select(tabToSelect);
            } else {
                this.renderView(panes[0], this.$el.find('.research-pane').get(0));
            }
            if(!this.isEmbedded) {
                this.checkStyleVersions();
            }
            return this;
        };
        ResearchView.prototype.renderView = function (type, el) {
            switch(type) {
                case 'research':
                    this.childRefs.push(new RV.ResearchTabView({
                        el: el,
                        codeType: this.codeType,
                        researchSections: this.researchSections,
                        allResearch: this.allResearch,
                        encounterType: this.encounterType,
                        handleResourceClick: this.handleResourceClick,
                        hub: this.hub,
                        globalHub: this.globalHub
                    }).render());
                    break;
                case 'drgAnalysis':
                    this.childRefs.push(new DAV.DRGAnalyzePaneView({
                        el: el,
                        hub: this.hub
                    }).render());
                    break;
                case 'edits':
                    this.childRefs.push(new EV.EditsPaneView({
                        el: el,
                        encounterType: this.encounterType,
                        hub: this.hub
                    }).render());
                    break;
                case 'icd10map':
                    this.childRefs.push(new I10V.ICD10MapPaneView({
                        el: el,
                        hub: this.hub
                    }).render());
                    break;
                default:
                    break;
            }
        };
        ResearchView.prototype.createTabs = function () {
            var settings = {
            };
            if(!api.TC.current().settings.effects) {
                settings.animation = false;
            }
            return this.$('.tabstrip').kendoTabStrip(settings).data("kendoTabStrip");
        };
        ResearchView.prototype.onSplitterCreated = /** Only executed when embedded within the CodeBooks control */
        function () {
            var splitter = this.$el.closest('.k-splitter').data('kendoSplitter');
            splitter.bind('layoutChange', this.fixScrollHeight);
            this.fixScrollHeight();
        };
        ResearchView.prototype.fixScrollHeight = /** */
        function () {
            var $scrollableResearch = this.$el.closest('.research-mid-wrap.pane-scrollable');
            if($scrollableResearch.length > 0) {
                this.contentHeight = $scrollableResearch.height() - 39;
                $scrollableResearch.find('.pane-content').css('height', this.contentHeight);
            }
        };
        return ResearchView;
    })(Backbone.View);
    exports.ResearchView = ResearchView;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/models/sharedModel',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var SharedModel = (function (_super) {
        __extends(SharedModel, _super);
        function SharedModel(options) {
            this.defaults = function () {
                return {
                    pcsSections: {
                        columns: null
                    }
                };
            };
                _super.call(this, options);
        }
        return SharedModel;
    })(Backbone.Model);
    exports.SharedModel = SharedModel;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/codebooks/views/codebooks',["require", "exports", "Backbone", "underscore", "jql", "text!controls/codebooks/templates/codebooks.html", "controls/codebooks/views/searchbar", "controls/codebooks/views/index", "controls/codebooks/views/tabular", "controls/research/views/research", "controls/codebooks/models/sharedModel", "kendoui/kendo.core", "kendoui/kendo.splitter", "lib/api", "lib/templates", "lib/events", "lib/shortcuts", "lib/config", "lib/dom"], function(require, exports, __Backbone__, _____, __$__, __encoderTemplate__, __SBV__, __IV__, __TV__, __RPV__, __SM__, __KC__, __KS__, __api__, __Templates__, __Events__, __Shortcuts__, __cfg__, __dom__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var encoderTemplate = __encoderTemplate__;

    var SBV = __SBV__;

    var IV = __IV__;

    var TV = __TV__;

    var RPV = __RPV__;

    var SM = __SM__;
    ///<reference path="../../../vendor/kendoui/kendoui.d.ts"/>
    
    var KC = __KC__;

    var KS = __KS__;

    var api = __api__;

    
    var Templates = __Templates__;

    
    var Events = __Events__;

    var Shortcuts = __Shortcuts__;

    var cfg = __cfg__;

    var dom = __dom__;

    var EncoderView = (function (_super) {
        __extends(EncoderView, _super);
        function EncoderView(options) {
            // Force include
            if(KC || !KC) {
            }
            if(KS || !KS) {
            }
            this.searchbarSelector = '.searchbar';
            this.indexHeaderSelector = '.index-header';
            this.indexSelector = '.index-results';
            this.tabularWrapSelector = '.tabular-wrap';
            this.tabularHeaderSelector = '.tabular-header';
            this.tabularSelector = '.tabular-results';
            this.researchPaneSelector = '.research-pane-wrap';
            this.pcsListSectionFailureCount = 0;
            this.childRefs = [];
            this.events = {
                'click': 'tcSetActiveWidget'
            };
            this.shortcuts = {
                'ctrl+up': 'movePaneFocus',
                'ctrl+down': 'movePaneFocus'
            };
            this.sharedProperties = new SM.SharedModel();
            this.targetDate = (options && options.bookdate) ? options.bookdate : '';
            this.book = (options && options.book) ? options.book.toUpperCase() : null;
            this.searchQuery = (options && options.searchQuery) ? options.searchQuery : null;
            this.searchOption = (options && options.searchOption) ? options.searchOption : '';
            this.bookFilters = (options && options.bookFilters) ? options.bookFilters : null;
            this.visible = true;
            this.hideResearch = (options && typeof options.hideResearch !== 'undefined') ? options.hideResearch : false;
            this.template = Templates.compile(Templates.tk_codebooksWrapper, encoderTemplate);
            // cache options for mixing into research pane during render
            if(typeof options === 'object') {
                delete options.visiblePanes;
            }
            this.cachedOptionsForResearch = options;
                _super.call(this, options);
        }
        EncoderView.prototype.initialize = function (options) {
            this.hub = Events.Get();
            this.tcInit();
            this.tcSetActiveWidget();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.hub, Events.CodeBooksClear, this.clearResearch);
            this.listenTo(this.hub, Events.CodeBooksChangeBookdate, this.clear);
            this.listenTo(this.hub, Events.ClearWidgetAreaFocus, this.blurSplitters);
            this.listenTo(this.hub, Events.CodeBooksResize, this.resize);
            this.getPCSSections();
        };
        EncoderView.prototype.movePaneFocus = function (e, keymasterEvent) {
            $.event.fix(e).preventDefault();
            if(!this.$el.hasClass('active-widget')) {
                return;
            }
            // search       -> index        -> spl horz -> (? tabular controls) -> tabular      -> spl vert -> research
            // 10           -> 20           -> (s)25    -> (?)                  -> 30           -> (s)35    -> 40
            // search       -> index        -> spl horz -> (? tabular controls) -> tabular
            // 100          -> 200          -> (s)250   -> (?)                  -> 300
                        var kb = 'keyboard', $activePane = this.$('.' + cfg.activePaneClass), isSplitbar = $activePane && $activePane.hasClass('k-splitbar'), paneIndex;
            if(isSplitbar) {
                paneIndex = $activePane.hasClass('k-splitbar-vertical') ? 25 : 35;
            } else {
                paneIndex = parseInt($activePane.attr('data-pane-index'), 10)// NaN is OK and will be picked up by default case
                ;
            }
            this.hub.trigger(Events.ClearWidgetAreaFocus);
            this.$('.' + cfg.activePaneClass).removeClass(cfg.activePaneClass);
            dom.blurAll();
            if(typeof paneIndex === 'number' && keymasterEvent.key === 'ctrl+up') {
                paneIndex *= -1;
            }
            if(this.hideResearch) {
                paneIndex *= 10;
            }
            switch(paneIndex) {
                case -25:
                case 10:
                case -250:
                case 100:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -> index');
                    }
                    this.childRefs[1].tcSetFocus(kb);
                    break;
                case -30:
                case 20:
                case -300:
                case 200:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -> splitter horiz');
                    }
                    dom.focusWithoutWindowScroll(this.$('.index-wrap').next('.k-splitbar').addClass(cfg.activePaneClass)).click();
                    break;
                case -35:
                case 25:
                case -100:
                case 250:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -> tabular');
                    }
                    this.childRefs[2].tcSetFocus(kb);
                    break;
                case -40:
                case 30:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -> splitter vert');
                    }
                    dom.focusWithoutWindowScroll(this.$('.results-wrap').next('.k-splitbar').addClass(cfg.activePaneClass)).click();
                    break;
                case -10:
                case 35:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -> research');
                    }
                    this.childRefs[3].childRefs[0].tcSetFocus(kb);
                    break;
                case -20:
                case 40:
                case -200:
                case 300:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -^ searchbar');
                    }
                    this.childRefs[0].tcSetFocus(kb);
                    break;
                default:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -^ searchbar');
                    }
                    this.childRefs[0].tcSetFocus(kb);
                    break;
            }
        };
        EncoderView.prototype.onClose = function () {
            for(var i = 0; i < this.childRefs.length; i++) {
                this.childRefs[i].tcClose();
            }
        };
        EncoderView.prototype.clear = function () {
            this.hub.trigger(Events.CodeBooksClear);
        };
        EncoderView.prototype.clearResearch = function () {
            var rpClearOptions;
            rpClearOptions = {
                pane: 'research'
            };
            this.hub.trigger(Events.ResearchClear, rpClearOptions);
        };
        EncoderView.prototype.render = function () {
            var rpOptions;
            this.$el.html(this.template({
                hideResearch: this.hideResearch
            }));
            this.childRefs.push(new SBV.SearchbarView({
                el: this.$(this.searchbarSelector),
                targetDate: this.targetDate,
                book: this.book,
                searchQuery: this.searchQuery,
                searchOption: this.searchOption,
                hub: this.hub,
                sharedProperties: this.sharedProperties,
                bookFilters: this.bookFilters,
                hideResearch: this.hideResearch
            }).render());
            this.childRefs.push(new IV.IndexView({
                el: this.$(this.indexSelector),
                $heading: this.$(this.indexHeaderSelector),
                hub: this.hub,
                sharedProperties: this.sharedProperties,
                hideResearch: this.hideResearch
            }).render());
            this.childRefs.push(new TV.TabularView({
                el: this.$(this.tabularWrapSelector),
                $content: this.$(this.tabularSelector),
                $heading: this.$(this.tabularHeaderSelector),
                targetDate: this.targetDate,
                hub: this.hub,
                sharedProperties: this.sharedProperties,
                hideResearch: this.hideResearch
            }).render());
            if(!this.hideResearch) {
                rpOptions = $.extend(this.cachedOptionsForResearch, {
                    el: this.$(this.researchPaneSelector),
                    visiblePanes: [
                        'research'
                    ],
                    hub: this.hub,
                    sharedProperties: this.sharedProperties,
                    embedded: true
                });
                this.childRefs.push(new RPV.ResearchView(rpOptions).render());
            }
            this.createSplitter();
            _.each(this.childRefs, function (child) {
                if(child.onSplitterCreated) {
                    child.onSplitterCreated();
                }
            });
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                this.debugHistory = this.childRefs[2].debugHistory;
            }
            this.checkStyleVersions();
            return this;
        };
        EncoderView.prototype.createSplitter = function () {
            var $el = this.$('.codebooks-wrap'), that = this, rSize = this.hideResearch ? '100%' : '70%', rMin = this.hideResearch ? '100%' : '25%', rMax = this.hideResearch ? '100%' : '75%', resultPanes = [
                // results
                {
                    collapsible: false,
                    resizable: !this.hideResearch,
                    size: rSize,
                    min: rMin,
                    max: rMax,
                    scrollable: false
                }
            ];
            if(!this.hideResearch) {
                resultPanes.push({
                    collapsible: false,
                    resizable: true,
                    scrollable: false
                });
            }
            $el.height($el.parent().parent().height());
            $el.kendoSplitter({
                orientation: 'vertical',
                panes: [
                    // searchbar
                    {
                        collapsible: false,
                        resizable: false,
                        size: '82px',
                        scrollable: false
                    }, 
                    // others
                    {
                        collapsible: false,
                        resizable: false,
                        scrollable: false
                    }
                ]
            });
            $el = this.$('.bottom-wrap');
            $el.kendoSplitter({
                orientation: 'horizontal',
                panes: resultPanes
            });
            $el = this.$('.results-wrap');
            $el.kendoSplitter({
                orientation: 'vertical',
                panes: [
                    // index
                    {
                        collapsible: false,
                        resizable: true,
                        size: '30%',
                        min: '10%',
                        max: '90%',
                        scrollable: false
                    }, 
                    // tabular
                    {
                        collapsible: false,
                        resizable: true,
                        scrollable: false
                    }
                ]
            });
            $el = this.$('.index-wrap');
            $el.kendoSplitter({
                orientation: 'vertical',
                panes: [
                    // index heading
                    {
                        collapsible: false,
                        resizable: false,
                        size: '36px',
                        scrollable: false
                    }, 
                    // index results
                    {
                        collapsible: false,
                        resizable: false,
                        scrollable: false
                    }
                ]
            });
            $el = this.$('.tabular-wrap');
            $el.kendoSplitter({
                orientation: 'vertical',
                panes: [
                    // tabular heading
                    {
                        collapsible: false,
                        resizable: false,
                        size: '78px',
                        scrollable: false
                    }, 
                    // tabular
                    {
                        collapsible: false,
                        resizable: false,
                        scrollable: false
                    }
                ]
            });
            $el = this.$('.research-wrap');
            $el.kendoSplitter({
                orientation: 'vertical',
                panes: [
                    // research heading
                    {
                        collapsible: false,
                        resizable: false,
                        size: '36px',
                        scrollable: false
                    }, 
                    // research
                    {
                        collapsible: false,
                        resizable: false,
                        scrollable: false
                    }
                ]
            });
            this.$('.k-splitbar-draggable-horizontal, .k-splitbar-draggable-vertical').focus(function () {
                $(this).find('.k-resize-handle').addClass('active-border');
            }).blur(function () {
                $(this).find('.k-resize-handle').removeClass('active-border');
            });
        };
        EncoderView.prototype.resize = function () {
            var $el = this.$el;
            this.$('.codebooks-wrap').height($el.height());
            this.$('.codebooks-wrap').data('kendoSplitter').trigger('resize');
        };
        EncoderView.prototype.getPCSSections = function () {
            var listSectionsOptions;
            listSectionsOptions = {
            };
            if(this.targetDate.length > 0) {
                listSectionsOptions.date = this.targetDate;
            }
            api.TC.current()._net.codebooksListPCSSections(listSectionsOptions, this.setPCSSections, this.handlePCSSectionsFail);
            //Net.codebooks.listPCSSections(listSectionsOptions, this.setPCSSections, this.handlePCSSectionsFail);
                    };
        EncoderView.prototype.setPCSSections = function (data) {
            this.sharedProperties.set('pcsSections', data);
        };
        EncoderView.prototype.handlePCSSectionsFail = function () {
            var that = this;
            if(++this.pcsListSectionFailureCount <= 3) {
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[tabular:pcsSectionListFailure] Count: ' + this.pcsListSectionFailureCount);
                }
                setTimeout(function () {
                    that.getPCSSections();
                }, 3000);
            }
        };
        EncoderView.prototype.blurSplitters = function () {
            this.$('.index-wrap').next('.k-splitbar').removeClass(cfg.activePaneClass).blur();
            this.$('.results-wrap').next('.k-splitbar').removeClass(cfg.activePaneClass).blur();
        };
        return EncoderView;
    })(Backbone.View);
    exports.EncoderView = EncoderView;    
})
;
define('text!controls/references/templates/references.html',[],function () { return '<div class="k-content references searching">\r\n    <div class="references-wrap splitter-wrap">\r\n        <div class="searchbar" data-pane-index="10"></div>\r\n        <div class="bottom-wrap">\r\n            <div class="list-wrap">\r\n                <div class="list-browse"></div>\r\n                <div class="list-title"></div>\r\n                <div class="list-content pane-scrollable" data-pane-index="20">\r\n                    <div class="pane-content pane-text pane-slim-e pane-slim-n"></div>\r\n                </div>\r\n            </div>\r\n            <div>\r\n                <div class="detail-outer-wrap">\r\n                    <!-- splitter -->\r\n                    <div class="detail-wrap">\r\n                        <div class="detail-title"></div>\r\n                        <div class="detail-content pane-scrollable" data-pane-index="30"></div>\r\n                        <div class="detail-highlight"></div>\r\n                        <div class="detail-notes-title"></div>\r\n                        <div class="detail-notes pane-scrollable"></div>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n</div>\r\n\r\n<iframe name="references_print_frame" width="0" height="0" frameborder="0" src="<%= printTemplate + \'?v=3.1.0.363\' %>"></iframe>';});

define('text!controls/common/templates/loading-small.html',[],function () { return '<span class="k-loading k-icon tc-loading">Loading</span>';});

define('text!controls/references/templates/searchbar/searchbar.html',[],function () { return '<% var randomId = Math.random().toString().replace(\'0.\',\'\'); %>\r\n<div class="pane-content form-inline">\r\n    <label for="search-box-<%= randomId %>" class="pad-right">Search for</label>\r\n    <input class="search-box k-input" id="search-box-<%= randomId %>" type="text" placeholder="search terms or code..." />\r\n    <span class="pad-right pad-left">in</span>\r\n    <select class="book-list">\r\n        <% _.each(books, function(item) { %>\r\n        <option value="<%= item.id %>"><%= item.title %></option>\r\n        <% }); %>\r\n    </select>\r\n    <button type="submit" class="search-btn k-button pad-left"<% if (books.length === 0) print(\' disabled="disabled"\'); %>>Search</button>\r\n\r\n    <% if (books.length === 0) { %>\r\n    <span class="k-loading k-icon tc-loading">Loading</span>\r\n    <% } %>\r\n</div>';});

define('text!controls/references/templates/searchbar/books-error.html',[],function () { return '<span class="alert alert-error books-error">Trouble listing books. <a href="javascript:void(0)" class="books-retry">Try again.</a></span>';});

var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/references/views/searchbar',["require", "exports", "Backbone", "underscore", "jql", "text!controls/common/templates/loading-small.html", "text!controls/references/templates/searchbar/searchbar.html", "text!controls/references/templates/searchbar/books-error.html", "kendoui/kendo.dropdownlist", "lib/api", "lib/dom", "lib/templates", "lib/events", "lib/shortcuts", "controls/references/models/bookCollection"], function(require, exports, __Backbone__, _____, __$__, __loadingTemplate__, __searchbarTemplate__, __bookErrorTemplate__, __KDDL__, __api__, __dom__, __Templates__, __Events__, __Shortcuts__, __BC__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    /// <reference path="../../common/templates/templates.d.ts" />
    
    var loadingTemplate = __loadingTemplate__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var searchbarTemplate = __searchbarTemplate__;

    var bookErrorTemplate = __bookErrorTemplate__;
    ///<reference path="../../../vendor/kendoui/kendoui.d.ts"/>
    
    var KDDL = __KDDL__;

    var api = __api__;

    
    var dom = __dom__;

    var Templates = __Templates__;

    
    var Events = __Events__;

    var Shortcuts = __Shortcuts__;

    var BC = __BC__;

    var SearchbarView = (function (_super) {
        __extends(SearchbarView, _super);
        function SearchbarView(options) {
            // Force include
            if(KDDL || !KDDL) {
            }
            this.hub = options.hub;
            this.template = Templates.compile(Templates.tk_referencesSearchbar, searchbarTemplate);
            this.templateBooksError = Templates.get(Templates.tk_referencesBooksError, bookErrorTemplate);
            this.templateLoading = Templates.get(Templates.tk_loadingSmall, loadingTemplate);
            this.events = {
                'click': 'tcSetFocus',
                'keydown': 'keypressHandler',
                'click .search-btn': 'searchOnEvent',
                'click .books-retry': 'getBooks',
                'click .search-box': 'selectAllSearchbox',
                'focusout .search-box': 'searchBlur'
            };
            this.scopeName = 'references:searchbar';
            this.shortcuts = {
            };
            this.termSelector = '.search-box';
            this.bookSelector = '.book-list option:selected';
            this.books = new BC.BookCollection();
            this.tryLocalStorage();
            this.currentBookId = this.initialBook = (options && options.book) ? options.book : this.getBookDefault();
            this.currentTerm = '';
            this.bookFilters = options.bookFilters || null;
                _super.call(this, options);
        }
        SearchbarView.prototype.initialize = function (options) {
            this.tcInit();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.books, 'reset', this.render);
            this.listenTo(this.hub, Events.ReferencesSearch, this.mockSearch);
            this.listenTo(this.hub, Events.ReferencesClear, this.clear);
            this.listenTo(this.hub, Events.ReferencesSelectBook, this.onSelectBook);
            this.getBooks();
        };
        SearchbarView.prototype.tryLocalStorage = function () {
            // Feature detect + local reference
                        var fail, uid;
            try  {
                uid = new Date();
                (this.storage = window.localStorage).setItem(uid, uid);
                fail = this.storage.getItem(uid) !== uid.toString();
                this.storage.removeItem(uid);
                if(fail) {
                    this.storage = false;
                }
            } catch (e) {
            }
        };
        SearchbarView.prototype.bookChanging = function (e) {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('book changing to: ' + this.$(this.bookSelector).val());
            }
            if(this.storage) {
                this.storage.setItem('references-lastBook', this.$(this.bookSelector).val());
            }
        };
        SearchbarView.prototype.getBookDefault = function () {
            if(this.storage) {
                return this.storage.getItem('references-lastBook') || '';
            } else {
                return '';
            }
        };
        SearchbarView.prototype.onKeyboardFocus = function () {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[sb] onKeyboardFocus called');
            }
            this.selectAllSearchbox();
        };
        SearchbarView.prototype.onClearFocus = function () {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[sb] onClearFocus called');
            }
        };
        SearchbarView.prototype.selectAllSearchbox = function (e) {
            var $sbox = this.$(this.termSelector);
            if(!$sbox.hasClass('focused')) {
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log('[sb] Selecting searchbar contents');
                }
                this.$(this.termSelector).select();
            }
            $sbox.addClass('focused');
        };
        SearchbarView.prototype.searchBlur = function (e) {
            this.$(this.termSelector).removeClass('focused');
        };
        SearchbarView.prototype.clear = /** */
        function () {
            this.$(this.termSelector).val('');
        };
        SearchbarView.prototype.getBooks = /** */
        function () {
            this.removeBooksFailure();
            this.setLoading(true);
            api.TC.current()._net.referencesListBooks(this.setBooks, this.showBooksFailure);
        };
        SearchbarView.prototype.setBooks = /** */
        function (data) {
            var bookEventOptions;
            this.books.reset(data);
            this.setLoading(false);
            bookEventOptions = {
                books: this.books
            };
            this.hub.trigger(Events.ReferencesListBooksComplete, bookEventOptions);
        };
        SearchbarView.prototype.showBooksFailure = /** */
        function () {
            this.setLoading(false);
            this.$('.search-btn').attr('disabled', 'disabled');
            this.$('.pane-content').append(this.templateBooksError);
            this.hub.trigger(Events.ReferencesListBooksFailure);
        };
        SearchbarView.prototype.removeBooksFailure = /** */
        function () {
            this.$('.books-error').remove();
        };
        SearchbarView.prototype.setLoading = /** */
        function (notDone) {
            if(typeof notDone === 'undefined' || !notDone) {
                this.$('.tc-loading').remove();
                this.$('.search-btn').removeAttr('disabled');
            } else {
                this.$('.pane-content').append(this.templateLoading);
            }
        };
        SearchbarView.prototype.keypressHandler = function (event) {
            if(event.which === 13) {
                event.preventDefault();
                this.searchOnEvent(event);
                return;
            }
            this.bookChanging();
        };
        SearchbarView.prototype.searchOnEvent = /**
        * @triggers Events.ReferencesSearch
        */
        function (e) {
            var searchEventData;
            searchEventData = {
                term: this.$(this.termSelector).val(),
                bookId: this.$(this.bookSelector).val(),
                bookName: this.$(this.bookSelector).text()
            };
            if($.trim(searchEventData.term) !== '') {
                this.hub.trigger(Events.ReferencesSearch, searchEventData);
                this.$el.closest('.references').addClass('searching').removeClass('browsing');
            }
        };
        SearchbarView.prototype.mockSearch = /** */
        function (event) {
            var ddl;
            this.currentTerm = event.term;
            this.currentBookId = event.bookId.toUpperCase();
            this.blurAndSetListFocus();
            if(event.mockUser) {
                this.selectBook(this.currentBookId);
            }
        };
        SearchbarView.prototype.blurAndSetListFocus = /** */
        function () {
            dom.blurAll();
            this.hub.trigger(Events.ReferencesFocusList);
        };
        SearchbarView.prototype.render = function () {
            var jsonBooks = this.books.toJSON(), animationConfig = {
                close: {
                    duration: 0
                }
            };
            if(!api.TC.current().settings.effects) {
                animationConfig = false;
            }
            this.$el.html(this.template({
                books: jsonBooks
            }));
            this.$('select.book-list').val(this.currentBookId || this.initialBook).kendoDropDownList({
                animation: animationConfig,
                change: this.bookChanging,
                dataBound: this.booksSetComplete,
                height: 500
            });
            this.$(this.termSelector).val(this.currentTerm);
            return this;
        };
        SearchbarView.prototype.booksSetComplete = function (e) {
            var ddl = this.$('select.book-list').data('kendoDropDownList');
            if(this.bookFilters) {
                if(e.sender.dataSource.data().length) {
                    ddl.unbind('dataBound');
                    e.sender.dataSource.filter(this.bookFilters);
                }
            } else {
                ddl.unbind('dataBound');
            }
        };
        SearchbarView.prototype.handleError = function (e) {
        };
        SearchbarView.prototype.onSelectBook = /** */
        function (event) {
            this.selectBook(event.bookId);
        };
        SearchbarView.prototype.selectBook = function (bookId) {
            if(bookId && bookId.length) {
                bookId = bookId.toUpperCase();
            }
            var ddl = this.$('select.book-list').data('kendoDropDownList');
            if(ddl) {
                ddl.select(function (item) {
                    return item.value === bookId;
                });
                this.bookChanging();
            }
        };
        return SearchbarView;
    })(Backbone.View);
    exports.SearchbarView = SearchbarView;    
})
;
define('text!controls/references/templates/list/browse.html',[],function () { return '<div class="pane-content">\r\n    <div class="button-holder">\r\n        <select class="book-list ddl-menu">\r\n            <option value="-1">Browse...</option>\r\n    <% if (canListBooks.length > 0) { %>\r\n        <% _.each(canListBooks, function(item) { %>\r\n            <option value="<%= item.id %>">Browse <%= item.title %></option>\r\n        <% }); %>\r\n    <% } %>\r\n        </select>\r\n    </div>\r\n</div>';});

define('text!controls/references/templates/list/search.html',[],function () { return '<div class="pane-content pane-slim-n pane-slim-e pane-text search" style="height: <%= resultsHeight %>">\r\n<% _.each(results, function(group) { %>\r\n\r\n    <!-- CDR only supports code searching -->\r\n\r\n    <% switch (group.book) {\r\n        case \'DRUGS\': { %>\r\n            <div class="accordion-group">\r\n                <div class="section-heading accordion-heading<% if (group.results.length > 0) { print(\' collapsible\'); } else { print(\' empty\'); } %>">\r\n                    <div class="accordion-toggle">\r\n                        <a href="javascript:void(0)" class="section-expander">\r\n                            <span class="toggle-icon k-icon k-minus"></span>\r\n                            <span class="section-title"><%= group.name || TextBook[group.book] || group.book %></span>\r\n                        </a>\r\n                    </div>\r\n                </div>\r\n                <div class="section-items accordion-body">\r\n                    <div class="accordion-inner">\r\n                    <% if (group.results.length === 0) { %>\r\n                        <div class="not-found"><em>The terms you entered could not be found.</em></div>\r\n                    <% } %>\r\n                    <% _.each(group.results, function(articleGroup) { %>\r\n                        <ul data-book="<%= group.book %>"<% if (group.type === \'indication\') { print(\' class="indication-group"\'); } else { print(\' class="results-\' + articleGroup.name.toLowerCase() + \'"\'); } %>>\r\n                        <% if (group.type === \'indication\') { %>\r\n                            <li class="indication"><span class="k-icon k-plus"></span><span class="indication-group-name"><%= articleGroup.name %></span>\r\n                                <ul>\r\n                            <% _.forEach(articleGroup.articles, function(article, i) { %>\r\n                                    <li id="indication-<%= article.article_id %>" class="indication-child<% if (i === 0) { print(\' first\'); } %><% if (i === articleGroup.articles.length - 1) { print(\' last\'); } %>" data-article-id="<%= article.article_id %>"><a href="javascript:void(0)"><%= article.article_title.replace(/(\\w)([\\\\\\/])(\\w)/g, "$1 $2 $3") %></a></li>\r\n                            <% }); %>\r\n                                </ul>\r\n                            </li>\r\n                        <% } else { %>\r\n                            <% _.each(articleGroup.articles, function(article) { %>\r\n                            <li id="article-<%= article.article_id %>" data-book="<%= group.book %>" data-article-id="<%= article.article_id %>" title="<%= articleGroup.name %> Result">\r\n                                <a href="javascript:void(0)"><%= article.article_title.replace(/(\\w)([\\\\\\/])(\\w)/g, "$1 $2 $3") %></a></em>\r\n                            </li>\r\n                            <% }); %>\r\n                        <% } %>\r\n                        </ul>\r\n                    <% }); %>\r\n                    </div>\r\n                </div>\r\n            </div>   \r\n        <% }\r\n        break;\r\n        case \'DICTIONARY\': { %>\r\n            <% if (group.results.length === 0) { %>\r\n                <div class="not-found"><em>The terms you entered could not be found.</em></div>\r\n            <% } %>\r\n            <% _.each(group.results, function(articleGroup) { %>\r\n                <ul data-book="<%= group.book %>" class="results-<%= articleGroup.name.toLowerCase() %>">\r\n                <% _.each(articleGroup.articles, function(article) { %>\r\n                    <li id="article-<%= article.article_id %>" data-book="<%= group.book %>" id="article-<%= article.article_id %>" data-article-id="<%= article.article_id %>" title="<%= articleGroup.name %> Result">\r\n                        <a href="javascript:void(0)"><%= article.article_title.replace(/(\\w)([\\\\\\/])(\\w)/g, "$1 $2 $3") %></a></em>\r\n                    </li>\r\n                <% }); %>\r\n                </ul>\r\n            <% }); %>\r\n        <% }\r\n        break;\r\n        case \'INTERVENTIONAL_RADIOLOGY\': { %>\r\n            <% if (group.type === \'code\') { %>\r\n            <div class="accordion-group">\r\n                <div class="section-heading accordion-heading<% if (group.results.length > 0) { print(\' collapsible\'); } else { print(\' empty\'); } %>">\r\n                    <div class="accordion-toggle">\r\n                        <a href="javascript:void(0)" class="section-expander">\r\n                            <span class="toggle-icon k-icon k-minus"></span>\r\n                            <span class="section-title"><%= TextBook[group.name] || TextBook[group.book] || group.name || group.book %></span>\r\n                        </a>\r\n                    </div>\r\n                </div>\r\n                <div class="section-items accordion-body">\r\n                    <div class="accordion-inner">\r\n            <% } %>\r\n\r\n                    <% if (group.results.length === 0) { %>\r\n                        <% if (group.type === \'code\') { %>\r\n                        <div class="not-found"><em>The code you entered could not be found.</em></div>\r\n                        <% } else { %>\r\n                        <div class="not-found"><em>The terms you entered could not be found.</em></div>\r\n                        <% } %>\r\n                    <% } %>\r\n                    <% _.each(group.results, function(articleGroup) { %>\r\n                        <ul data-book="<%= group.book %>" class="results-<%= articleGroup.name.toLowerCase() %>">\r\n                        <% _.each(articleGroup.articles, function(article) { %>\r\n                            <li id="article-<%= article.article_id %>" data-issue-title="<%= article.details.issue_title %>" data-book="<%= group.book %>" data-issue-year="<%= article.details.issue_year %>" data-article-id="<%= article.article_id %>" title="<%= articleGroup.name %> Result">\r\n                                <a href="javascript:void(0)"><%= article.article_title.replace(/(\\w)([\\\\\\/])(\\w)/g, "$1 $2 $3") %></a>, <em><%= article.details.issue_year %></em>\r\n                            </li>\r\n                        <% }); %>\r\n                        </ul>\r\n                    <% }); %>\r\n\r\n            <% if (group.type === \'code\') { %>\r\n                    </div>\r\n                </div>\r\n            </div>       \r\n            <% } %>\r\n    \r\n        <% }\r\n        break;\r\n        default: { %>\r\n            <% if (group.type === \'code\') { %>\r\n            <div class="accordion-group">\r\n                <div class="section-heading accordion-heading<% if (group.results.length > 0) { print(\' collapsible\'); } else { print(\' empty\'); } %>">\r\n                    <div class="accordion-toggle">\r\n                        <a href="javascript:void(0)" class="section-expander">\r\n                            <span class="toggle-icon k-icon k-minus"></span>\r\n                            <span class="section-title"><%= TextBook[group.name] || TextBook[group.book] || group.name || group.book %></span>\r\n                        </a>\r\n                    </div>\r\n                </div>\r\n                <div class="section-items accordion-body">\r\n                    <div class="accordion-inner">\r\n            <% } %>\r\n\r\n                    <% if (group.results.length === 0) { %>\r\n                        <% if (group.type === \'code\') { %>\r\n                        <div class="not-found"><em>The code you entered could not be found.</em></div>\r\n                        <% } else { %>\r\n                            <% if (group.book === \'CDR\') { %>\r\n                            <div class="not-found"><em>This reference cannot be searched by term. Please enter a full or partial CPT code.</em></div>\r\n                            <% } else { %>\r\n                            <div class="not-found"><em>The terms you entered could not be found.</em></div>\r\n                            <% } %>\r\n                        <% } %>\r\n                    <% } %>\r\n                    <% _.each(group.results, function(articleGroup) { %>\r\n                        <ul data-book="<%= group.book %>" class="results-<%= articleGroup.name.toLowerCase() %>">\r\n                        <% _.each(articleGroup.articles, function(article) { %>\r\n                            <li id="article-<%= article.article_id %>" data-issue-title="<%= article.details.issue_title %>" data-book="<%= group.book %>" data-issue-year="<%= article.details.issue_year %>" data-article-id="<%= article.article_id %>" title="<%= articleGroup.name %> Result">\r\n                                <a href="javascript:void(0)"><%= article.article_title.replace(/(\\w)([\\\\\\/])(\\w)/g, "$1 $2 $3") %></a>, <em><%= article.details.issue_title %></em>\r\n                            </li>\r\n                        <% }); %>\r\n                        </ul>\r\n                    <% }); %>\r\n\r\n            <% if (group.type === \'code\') { %>\r\n                    </div>\r\n                </div>\r\n            </div>       \r\n            <% } %>\r\n    \r\n        <% }\r\n        break;\r\n    } %>\r\n<% }); %>\r\n</div>';});

define('text!controls/references/templates/list/title.html',[],function () { return '<div class="pane-content pane-slim-s pane-slim-e">\r\n    <div class="heading-slim"><span><% if (type === \'browse\') { %>Browse <%= bookTitle %><% } else { %>Search Results<% } %></span></div>\r\n</div>';});

define('text!controls/references/templates/list/tree.html',[],function () { return '<div class="pane-content pane-slim-n pane-slim-e pane-text tree" style="height: <%= resultsHeight %>">\r\n    <div class="tree k-content">\r\n        <ul class="treeview">\r\n        <% if (data) { %>\r\n            <% _.each(data.Years, function(year) { %>\r\n            <li data-book="<%= data.Book %>" data-year="<%= year %>"><%= year %>\r\n                <ul>\r\n                    <li><span class="k-loading k-icon tc-loading"></span></li>\r\n                </ul>\r\n            </li>\r\n            <% }); %>\r\n        <% } %>\r\n        </ul>\r\n    </div>\r\n</div>';});

var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/references/models/searchResult',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var SearchResult = (function (_super) {
        __extends(SearchResult, _super);
        function SearchResult(options) {
            this.defaults = {
                name: '',
                type: '',
                book: '',
                results: []
            };
                _super.call(this, options);
        }
        SearchResult.prototype.initialize = function () {
            // do nothing
                    };
        return SearchResult;
    })(Backbone.Model);
    exports.SearchResult = SearchResult;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/references/models/searchResultCollection',["require", "exports", "Backbone", "controls/references/models/searchResult"], function(require, exports, __Backbone__, __SR__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var SR = __SR__;

    var SearchResultCollection = (function (_super) {
        __extends(SearchResultCollection, _super);
        function SearchResultCollection(models, options) {
            this.model = SR.SearchResult;
                _super.call(this, models, options);
        }
        SearchResultCollection.prototype.initialize = function () {
            // do nothing
                    };
        return SearchResultCollection;
    })(Backbone.Collection);
    exports.SearchResultCollection = SearchResultCollection;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/references/models/browse',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var Browse = (function (_super) {
        __extends(Browse, _super);
        function Browse(options) {
            this.defaults = function () {
                return {
                    Book: null,
                    Years: null,
                    Issues: null,
                    Articles: null
                };
            };
                _super.call(this, options);
        }
        Browse.prototype.initialize = function () {
            // do nothing
                    };
        return Browse;
    })(Backbone.Model);
    exports.Browse = Browse;    
})
;
define('kendoui/kendo.treeview',["kendoui/kendo.jquery","kendoui/kendo.core","kendoui/kendo.draganddrop","kendoui/kendo.userevents","kendoui/kendo.data","kendoui/kendo.fx"],function(e,t){var i=t.ui,n=t.data,r=e.extend,a=t.template,s=e.isArray,d=i.Widget,o=n.HierarchicalDataSource,l=e.proxy,c=t.keys,f=".kendoTreeView",u="select",h="navigate",p="expand",g="change",m="error",k="checked",v="collapse",_="dragstart",b="drag",x="drop",C="dragend",y="dataBound",w="click",T="visibility",S="undefined",N="k-state-hover",I="k-treeview",B=":visible",H=".k-item",U="string",D="aria-selected",A="aria-disabled",O,V,L,E,q={text:"dataTextField",url:"dataUrlField",spriteCssClass:"dataSpriteCssClassField",imageUrl:"dataImageUrlField"},F=function(e){return typeof HTMLElement==="object"?e instanceof HTMLElement:e&&typeof e==="object"&&e.nodeType===1&&typeof e.nodeName===U};function M(e){return function(t){var i=t.children(".k-animation-container");if(!i.length){i=t}return i.children(e)}}function R(e){return t.template(e,{useWithBlock:false})}V=M(".k-group");L=M(".k-group,.k-content");E=function(e){return e.children("div").children(".k-icon")};function j(e){return e.children("div").find(".k-checkbox:first :checkbox")}function G(e){return function(t,i){i=i.closest(H);var n=i.parent(),r;if(n.parent().is("li")){r=n.parent()}return this._dataSourceMove(t,n,r,function(t,n){return this._insert(t.data(),n,i.index()+e)})}}function P(t){var i=t.children("div"),n=t.children("ul"),r=i.children(".k-icon"),a=t.children(":checkbox"),s=i.children(".k-in"),d,o;if(t.hasClass("k-treeview")){return}if(!i.length){i=e("<div />").prependTo(t)}if(!r.length&&n.length){r=e("<span class='k-icon' />").prependTo(i)}else if(!n.length||!n.children().length){r.remove();n.remove()}if(a.length){e("<span class='k-checkbox' />").appendTo(i).append(a)}if(!s.length&&i.length){s=e("<span class='k-in' />").appendTo(i)[0];d=i[0].nextSibling;s=i.find(".k-in")[0];while(d&&d.nodeName.toLowerCase()!="ul"){o=d;d=d.nextSibling;if(o.nodeType==3){o.nodeValue=e.trim(o.nodeValue)}s.appendChild(o)}}}O=d.extend({init:function(e,i){var n=this,r,a=false,o=i&&!!i.dataSource,l;if(s(i)){r=true;i={dataSource:i}}if(i&&typeof i.loadOnDemand==S&&s(i.dataSource)){i.loadOnDemand=false}d.prototype.init.call(n,e,i);e=n.element;i=n.options;l=e.is("ul")&&e||e.hasClass(I)&&e.children("ul");a=!o&&l.length;if(a){i.dataSource.list=l}n._animation();n._accessors();n._templates();if(!e.hasClass(I)){n._wrapper();if(l){n.root=e;n._group(n.wrapper)}}else{n.wrapper=e;n.root=e.children("ul").eq(0)}n._tabindex();if(!n.wrapper.filter("[role=tree]").length){n.wrapper.attr("role","tree")}n._dataSource(a);n._attachEvents();n._dragging();if(!a){if(i.autoBind){n._progress(true);n.dataSource.fetch()}}else{n._attachUids()}if(i.checkboxes&&i.checkboxes.checkChildren){n.updateIndeterminate()}if(n.element[0].id){n._ariaId=t.format("{0}_tv_active",n.element[0].id)}},_attachEvents:function(){var t=this,i=".k-in:not(.k-state-selected,.k-state-disabled)",n="mouseenter";t.wrapper.on(n+f,".k-in.k-state-selected",function(e){e.preventDefault()}).on(n+f,i,function(){e(this).addClass(N)}).on("mouseleave"+f,i,function(){e(this).removeClass(N)}).on(w+f,i,l(t._click,t)).on("dblclick"+f,".k-in:not(.k-state-disabled)",l(t._toggleButtonClick,t)).on(w+f,".k-plus,.k-minus",l(t._toggleButtonClick,t)).on("keydown"+f,l(t._keydown,t)).on("focus"+f,l(t._focus,t)).on("blur"+f,l(t._blur,t)).on("mousedown"+f,".k-in,.k-checkbox :checkbox,.k-plus,.k-minus",l(t._mousedown,t)).on("change"+f,".k-checkbox :checkbox",l(t._checkboxChange,t)).on("click"+f,".k-checkbox :checkbox",l(t._checkboxClick,t)).on("click"+f,".k-request-retry",l(t._retryRequest,t)).on("click"+f,function(i){if(!e(i.target).is(":focusable")){t.focus()}})},_checkboxClick:function(t){var i=e(t.target);if(i.data("indeterminate")){i.data("indeterminate",false).prop("indeterminate",false).prop(k,true);this._checkboxChange(t)}},_attachUids:function(i,n){var r=this,a,s=t.attr("uid");i=i||r.root;n=n||r.dataSource;a=n.view();i.children("li").each(function(t,i){i=e(i).attr(s,a[t].uid);i.attr("role","treeitem");r._attachUids(i.children("ul"),a[t].children)})},_animation:function(){var e=this.options,t=e.animation;if(t===false){t={expand:{effects:{}},collapse:{hide:true,effects:{}}}}else if(!t.collapse||!("effects"in t.collapse)){t.collapse=r({reverse:true},t.expand)}r(t.collapse,{hide:true});e.animation=t},_dragging:function(){var e=this.options.dragAndDrop;var t=this.dragging;if(e&&!t){this.dragging=new W(this)}else if(!e&&t){t.destroy();this.dragging=null}},_templates:function(){var e=this,i=e.options,n=l(e._fieldAccessor,e);if(i.template&&typeof i.template==U){i.template=a(i.template)}else if(!i.template){i.template=R("# var text = "+n("text")+"(data.item); #"+"# if (typeof data.item.encoded != 'undefined' && data.item.encoded === false) {#"+"#= text #"+"# } else { #"+"#: text #"+"# } #")}e._checkboxes();e.templates={wrapperCssClass:function(e,t){var i="k-item",n=t.index;if(e.firstLevel&&n===0){i+=" k-first"}if(n==e.length-1){i+=" k-last"}return i},cssClass:function(e,t){var i="",n=t.index,r=e.length-1;if(e.firstLevel&&n===0){i+="k-top "}if(n===0&&n!=r){i+="k-top"}else if(n==r){i+="k-bot"}else{i+="k-mid"}return i},textClass:function(e){var t="k-in";if(e.enabled===false){t+=" k-state-disabled"}if(e.selected===true){t+=" k-state-selected"}return t},toggleButtonClass:function(e){var t="k-icon";if(e.expanded!==true){t+=" k-plus"}else{t+=" k-minus"}if(e.enabled===false){t+="-disabled"}return t},groupAttributes:function(e){return e.expanded!==true?" style='display:none'":""},groupCssClass:function(e){var t="k-group";if(e.firstLevel){t+=" k-treeview-lines"}return t},dragClue:R("<div class='k-header k-drag-clue'>"+"<span class='k-icon k-drag-status' />"+"#= data.treeview.template(data) #"+"</div>"),group:R("<ul class='#= data.r.groupCssClass(data.group) #'#= data.r.groupAttributes(data.group) # role='group'>"+"#= data.renderItems(data) #"+"</ul>"),itemContent:R("# var imageUrl = "+n("imageUrl")+"(data.item); #"+"# var spriteCssClass = "+n("spriteCssClass")+"(data.item); #"+"# if (imageUrl) { #"+"<img class='k-image' alt='' src='#= imageUrl #'>"+"# } #"+"# if (spriteCssClass) { #"+"<span class='k-sprite #= spriteCssClass #' />"+"# } #"+"#= data.treeview.template(data) #"),itemElement:R("# var item = data.item, r = data.r; #"+"# var url = "+n("url")+"(item); #"+"<div class='#= r.cssClass(data.group, item) #'>"+"# if (item.hasChildren) { #"+"<span class='#= r.toggleButtonClass(item) #' role='presentation' />"+"# } #"+"# if (data.treeview.checkboxes) { #"+"<span class='k-checkbox' role='presentation'>"+"#= data.treeview.checkboxes.template(data) #"+"</span>"+"# } #"+"# var tag = url ? 'a' : 'span'; #"+"# var textAttr = url ? ' href=\\'' + url + '\\'' : ''; #"+"<#=tag#  class='#= r.textClass(item) #'#= textAttr #>"+"#= r.itemContent(data) #"+"</#=tag#>"+"</div>"),item:R("# var item = data.item, r = data.r; #"+"<li role='treeitem' class='#= r.wrapperCssClass(data.group, item) #'"+" "+t.attr("uid")+"='#= item.uid #'"+"#=item.selected ? \"aria-selected='true'\" : ''#"+"#=item.enabled === false ? \"aria-disabled='true'\" : ''#"+">"+"#= r.itemElement(data) #"+"</li>"),loading:R("<div class='k-icon k-loading' /> Loading..."),retry:R("Request failed. "+"<button class='k-button k-request-retry'>Retry</button>")}},items:function(){return this.element.find(".k-item")},setDataSource:function(e){this.options.dataSource=e;this._dataSource();this.dataSource.fetch()},_bindDataSource:function(){this._refreshHandler=l(this.refresh,this);this._errorHandler=l(this._error,this);this.dataSource.bind(g,this._refreshHandler);this.dataSource.bind(m,this._errorHandler)},_unbindDataSource:function(){var e=this.dataSource;if(e){e.unbind(g,this._refreshHandler);e.unbind(m,this._errorHandler)}},_dataSource:function(e){var t=this,i=t.options,n=i.dataSource;function r(e){for(var t=0;t<e.length;t++){e[t]._initChildren();e[t].children.fetch();r(e[t].children.view())}}n=s(n)?{data:n}:n;t._unbindDataSource();if(!n.fields){n.fields=[{field:"text"},{field:"url"},{field:"spriteCssClass"},{field:"imageUrl"}]}t.dataSource=n=o.create(n);if(e){n.fetch();r(n.view())}t._bindDataSource()},events:[_,b,x,C,y,p,v,u,g,h],options:{name:"TreeView",dataSource:{},animation:{expand:{effects:"expand:vertical",duration:200},collapse:{duration:100}},dragAndDrop:false,checkboxes:false,autoBind:true,loadOnDemand:true,template:"",dataTextField:null},_accessors:function(){var e=this,i=e.options,n,r,a,d=e.element;for(n in q){r=i[q[n]];a=d.attr(t.attr(n+"-field"));if(!r&&a){r=a}if(!r){r=n}if(!s(r)){r=[r]}i[q[n]]=r}},_fieldAccessor:function(i){var n=this.options[q[i]],r=n.length,a="(function(item) {";if(r===0){a+="return item['"+i+"'];"}else{a+="var levels = ["+e.map(n,function(e){return"function(d){ return "+t.expr(e)+"}"}).join(",")+"];";a+="return levels[Math.min(item.level(), "+r+"-1)](item)"}a+="})";return a},setOptions:function(e){d.fn.setOptions.call(this,e);this._animation();this._dragging();this._templates()},_trigger:function(e,t){return this.trigger(e,{node:t.closest(H)[0]})},_setChecked:function(t,i){if(!t||!e.isFunction(t.view)){return}for(var n=0,r=t.view();n<r.length;n++){r[n][k]=i;if(r[n].children){this._setChecked(r[n].children,i)}}},_setIndeterminate:function(e){var t=V(e),i,n,r=true,a;if(!t.length){return}i=j(t.children());n=i.length;if(!n){return}else if(n>1){for(a=1;a<n;a++){if(i[a].checked!=i[a-1].checked||i[a].indeterminate||i[a-1].indeterminate){r=false;break}}}else{r=!i[0].indeterminate}j(e).data("indeterminate",!r).prop("indeterminate",!r).prop(k,r&&i[0].checked)},updateIndeterminate:function(e){e=e||this.wrapper;var t=V(e).children(),i;if(t.length){for(i=0;i<t.length;i++){this.updateIndeterminate(t.eq(i))}this._setIndeterminate(e)}},_bubbleIndeterminate:function(e){var t=this.parent(e),i;if(t.length){this._setIndeterminate(t);i=t.children("div").find(".k-checkbox :checkbox");if(i.prop("indeterminate")===false){this.dataItem(t).set(k,i.prop(k))}else{this.dataItem(t).checked=false}this._bubbleIndeterminate(t)}},_checkboxChange:function(t){var i=e(t.target),n=i.prop(k),r=i.closest(H);this.dataItem(r).set(k,n)},_toggleButtonClick:function(t){this.toggle(e(t.target).closest(H))},_mousedown:function(t){var i=e(t.currentTarget).closest(H);this._clickTarget=i;this.current(i)},_focusable:function(e){return e&&e.length&&e.is(":visible")&&!e.find(".k-in:first").hasClass("k-state-disabled")},_focus:function(){var i=this.select(),n=this._clickTarget;if(t.support.touch){return}if(n&&n.length){i=n}if(!this._focusable(i)){i=this.current()}if(!this._focusable(i)){i=this._nextVisible(e())}this.current(i)},focus:function(){var e=this.wrapper,t=e[0],i=[],n=[],r=document.documentElement,a;do{t=t.parentNode;if(t.scrollHeight>t.clientHeight){i.push(t);n.push(t.scrollTop)}}while(t!=r);e.focus();for(a=0;a<i.length;a++){i[a].scrollTop=n[a]}},_blur:function(){this.current().find(".k-in:first").removeClass("k-state-focused")},_enabled:function(e){return!e.children("div").children(".k-in").hasClass("k-state-disabled")},parent:function(t){var i=/\bk-treeview\b/,n=/\bk-item\b/,r,a;if(typeof t==U){t=this.element.find(t)}if(!F(t)){t=t[0]}a=n.test(t.className);do{t=t.parentNode;if(n.test(t.className)){if(a){r=t}else{a=true}}}while(!i.test(t.className)&&!r);return e(r)},_nextVisible:function(e){var t=this,i=t._expanded(e),n;function r(e){while(e.length&&!e.next().length){e=t.parent(e)}if(e.next().length){return e.next()}else{return e}}if(!e.length||!e.is(":visible")){n=t.root.children().eq(0)}else if(i){n=V(e).children().first();if(!n.length){n=r(e)}}else{n=r(e)}if(!t._enabled(n)){n=t._nextVisible(n)}return n},_previousVisible:function(e){var t=this,i,n;if(!e.length||e.prev().length){if(e.length){n=e.prev()}else{n=t.root.children().last()}while(t._expanded(n)){i=V(n).children().last();if(!i.length){break}n=i}}else{n=t.parent(e)||e}if(!t._enabled(n)){n=t._previousVisible(n)}return n},_keydown:function(i){var n=this,r=i.keyCode,a,s=n.current(),d=n._expanded(s),o=s.find(".k-checkbox:first :checkbox"),l=t.support.isRtl(n.element);if(i.target!=i.currentTarget){return}if(!l&&r==c.RIGHT||l&&r==c.LEFT){if(d){a=n._nextVisible(s)}else{n.expand(s)}}else if(!l&&r==c.LEFT||l&&r==c.RIGHT){if(d){n.collapse(s)}else{a=n.parent(s);if(!n._enabled(a)){a=undefined}}}else if(r==c.DOWN){a=n._nextVisible(s)}else if(r==c.UP){a=n._previousVisible(s)}else if(r==c.HOME){a=n._nextVisible(e())}else if(r==c.END){a=n._previousVisible(e())}else if(r==c.ENTER){if(!s.find(".k-in:first").hasClass("k-state-selected")){if(!n._trigger(u,s)){n.select(s)}}}else if(r==c.SPACEBAR&&o.length){o.prop(k,!o.prop(k)).data("indeterminate",false).prop("indeterminate",false);n._checkboxChange({target:o});a=s}if(a){i.preventDefault();if(s[0]!=a[0]){n._trigger(h,a);n.current(a)}}},_click:function(t){var i=this,n=e(t.currentTarget),r=L(n.closest(H)),a=n.attr("href"),s;if(a){s=a=="#"||a.indexOf("#"+this.element.id+"-")>=0}else{s=r.length&&!r.children().length}if(s){t.preventDefault()}if(!n.hasClass(".k-state-selected")&&!i._trigger(u,n)){i.select(n)}},_wrapper:function(){var e=this,t=e.element,i,n,r="k-widget k-treeview";if(t.is("ul")){i=t.wrap("<div />").parent();n=t}else{i=t;n=i.children("ul").eq(0)}e.wrapper=i.addClass(r);e.root=n},_group:function(e){var t=this,i=e.hasClass(I),n={firstLevel:i,expanded:i||t._expanded(e)},r=e.children("ul");r.addClass(t.templates.groupCssClass(n)).css("display",n.expanded?"":"none");t._nodes(r,n)},_nodes:function(t,i){var n=this,a=t.children("li"),s;i=r({length:a.length},i);a.each(function(t,r){r=e(r);s={index:t,expanded:n._expanded(r)};P(r);n._updateNodeClasses(r,i,s);n._group(r)})},_checkboxes:function(){var e=this.options,t=e.checkboxes,i;if(t||e.checkboxTemplate){if(e.checkboxTemplate){i=e.checkboxTemplate}else{i="<input type='checkbox' #= (item.enabled === false) ? 'disabled' : '' # #= item.checked ? 'checked' : '' #";if(t.name){i+=" name='"+t.name+"'"}i+=" />"}t=r({template:i},e.checkboxes);if(typeof t.template==U){t.template=a(t.template)}e.checkboxes=t}},_updateNodeClasses:function(e,t,i){var n=e.children("div"),r=e.children("ul"),a=this.templates;if(e.hasClass("k-treeview")){return}i=i||{};i.expanded=typeof i.expanded!=S?i.expanded:this._expanded(e);i.index=typeof i.index!=S?i.index:e.index();i.enabled=typeof i.enabled!=S?i.enabled:!n.children(".k-in").hasClass("k-state-disabled");t=t||{};t.firstLevel=typeof t.firstLevel!=S?t.firstLevel:e.parent().parent().hasClass(I);t.length=typeof t.length!=S?t.length:e.parent().children().length;e.removeClass("k-first k-last").addClass(a.wrapperCssClass(t,i));n.removeClass("k-top k-mid k-bot").addClass(a.cssClass(t,i));n.children(".k-in").removeClass("k-in k-state-default k-state-disabled").addClass(a.textClass(i));if(r.length||e.attr("data-hasChildren")=="true"){n.children(".k-icon").removeClass("k-plus k-minus k-plus-disabled k-minus-disabled").addClass(a.toggleButtonClass(i));r.addClass("k-group")}},_processNodes:function(t,i){var n=this;n.element.find(t).each(function(t,r){i.call(n,t,e(r).closest(H))})},dataItem:function(i){var n=e(i).closest(H).attr(t.attr("uid")),r=this.dataSource;return r&&r.getByUid(n)},_insertNode:function(t,i,n,r,a){var s=this,d=V(n),o=d.children().length+1,l,c={firstLevel:n.hasClass(I),expanded:!a,length:o},f,u,h,p="",g=function(e,t){e.appendTo(t)};for(u=0;u<t.length;u++){h=t[u];h.index=i+u;p+=s._renderItem({group:c,item:h})}f=e(p);if(!f.length){return}if(!d.length){d=e(s._renderGroup({group:c})).appendTo(n)}r(f,d);if(n.hasClass("k-item")){P(n);s._updateNodeClasses(n)}s._updateNodeClasses(f.prev().first());s._updateNodeClasses(f.next().last());for(u=0;u<t.length;u++){h=t[u];if(h.hasChildren){l=h.children.data();if(l.length){s._insertNode(l,h.index,f.eq(u),g,!s._expanded(f.eq(u)))}}}return f},_updateNode:function(t,i){var n=this,r,a,s,d,o,l={treeview:n.options,item:s},c=false;function f(){c=true}function u(e,t){e.find(".k-checkbox :checkbox").prop(k,t).data("indeterminate",false).prop("indeterminate",false)}if(t=="selected"){s=i[0];a=n.findByUid(s.uid).find(".k-in:first").removeClass("k-state-hover").toggleClass("k-state-selected",s[t]).end();if(s[t]){n.current(a);a.attr(D,true)}else{a.attr(D,false)}}else{if(e.inArray(t,n.options.dataTextField)>=0){c=true}else{l.item=i[0];l.item.bind("get",f);n.templates.itemContent(l);l.item.unbind("set",f)}for(r=0;r<i.length;r++){l.item=s=i[r];if(t=="spriteCssClass"||t=="imageUrl"||c){n.findByUid(s.uid).find(">div>.k-in").html(n.templates.itemContent(l))}if(t==k){a=n.findByUid(s.uid);d=s[t];u(a.children("div"),d);if(n.options.checkboxes.checkChildren){u(a.children(".k-group"),d);n._setChecked(s.children,d);n._bubbleIndeterminate(a)}}else if(t=="expanded"){n._toggle(n.findByUid(s.uid),s,s[t])}else if(t=="enabled"){a=n.findByUid(s.uid);a.find(".k-checkbox :checkbox").prop("disabled",!s[t]);o=!L(a).is(B);a.removeAttr(A);if(!s[t]){if(s.selected){s.set("selected",false)}if(s.expanded){s.set("expanded",false)}o=true;a.removeAttr(D).attr(A,true)}n._updateNodeClasses(a,{},{enabled:s[t],expanded:!o})}}}},refresh:function(e){var t=this,i=t.wrapper,n=e.node,r=e.action,a=e.items,s=e.index,d=t.options,o=d.loadOnDemand,l=d.checkboxes&&d.checkboxes.checkChildren,c;function f(e,i){var n=V(i),r=n.children(),a=!t._expanded(i);if(typeof s==S){s=r.length}t._insertNode(e,s,i,function(e,t){if(s==r.length){e.appendTo(t)}else{e.insertBefore(r.eq(s))}},a);if(t._expanded(i)){t._updateNodeClasses(i);V(i).css("display","block")}}if(e.field){return t._updateNode(e.field,a)}if(n){i=t.findByUid(n.uid);t._progress(i,false)}if(l&&r!="remove"&&n&&n.checked){for(c=0;c<a.length;c++){a[c].checked=true}}if(r=="add"){f(a,i)}else if(r=="remove"){t._remove(t.findByUid(a[0].uid),false)}else{if(n){V(i).empty();if(!a.length){P(i)}else{f(a,i)}}else{t.root=t.wrapper.html(t._renderGroup({items:a,group:{firstLevel:true,expanded:true}})).children("ul")}}for(c=0;c<a.length;c++){if(!o||a[c].expanded){a[c].load()}}t.trigger(y,{node:n?i:undefined})},_error:function(e){var t=this,i=e.node&&t.findByUid(e.node.uid);if(i){this._progress(i,false);this._expanded(i,false);E(i).addClass("k-i-refresh");e.node.loaded(false)}else{this._progress(false);this.element.html(this.templates.retry)}},_retryRequest:function(e){e.preventDefault();this.dataSource.fetch()},expand:function(e){this._processNodes(e,function(e,t){this.toggle(t,true)})},collapse:function(e){this._processNodes(e,function(e,t){this.toggle(t,false)})},enable:function(e,t){t=arguments.length==2?!!t:true;this._processNodes(e,function(e,i){this.dataItem(i).set("enabled",t)})},current:function(t){var i=this,n=i._current,r=i.element,a=i._ariaId;if(arguments.length>0&&t&&t.length){if(n){if(n[0].id===a){n.removeAttr("id")}n.find(".k-in:first").removeClass("k-state-focused")}n=i._current=e(t,r).closest(H);n.find(".k-in:first").addClass("k-state-focused");a=n[0].id||a;if(a){i.wrapper.removeAttr("aria-activedescendant");n.attr("id",a);i.wrapper.attr("aria-activedescendant",a)}return}if(!n){n=i._nextVisible(e())}return n},select:function(t){var i=this,n=i.element;if(!arguments.length){return n.find(".k-state-selected").closest(H)}t=e(t,n).closest(H);n.find(".k-state-selected").each(function(){var e=i.dataItem(this);e.set("selected",false);delete e.selected});if(t.length){i.dataItem(t).set("selected",true)}i.trigger(g)},_toggle:function(e,t,i){var n=this,a=n.options,s=L(e),d=i?"expand":"collapse",o=a.animation[d],l;if(s.data("animating")){return}if(!n._trigger(d,e)){n._expanded(e,i);l=t&&t.loaded();if(l&&s.children().length>0){n._updateNodeClasses(e,{},{expanded:i});if(s.css("display")==(i?"block":"none")){return}if(!i){s.css("height",s.height()).css("height")}s.kendoStop(true,true).kendoAnimate(r({reset:true},o,{complete:function(){if(i){s.css("height","")}}}))}else if(i){if(a.loadOnDemand){n._progress(e,true)}s.remove();t.load()}}},toggle:function(t,i){t=e(t);if(!E(t).is(".k-minus,.k-plus,.k-minus-disabled,.k-plus-disabled")){return}if(arguments.length==1){i=!this._expanded(t)}this._expanded(t,i)},destroy:function(){var e=this;d.fn.destroy.call(e);e.element.off(f);e._unbindDataSource();if(e.dragging){e.dragging.destroy()}t.destroy(e.element)},_expanded:function(e,i){var n=t.attr("expanded"),r=this.dataItem(e);if(arguments.length==1){return e.attr(n)==="true"||r&&r.expanded}if(L(e).data("animating")){return}if(r){r.set("expanded",i);i=r.expanded}if(i){e.attr(n,"true");e.attr("aria-expanded","true")}else{e.removeAttr(n);e.attr("aria-expanded","false")}},_progress:function(e,t){var i=this.element;if(arguments.length==1){t=e;if(t){i.html(this.templates.loading)}else{i.empty()}}else{E(e).toggleClass("k-loading",t).removeClass("k-i-refresh")}},text:function(e,t){var i=this.dataItem(e),n=this.options[q.text],r=i.level(),a=n.length,s=n[Math.min(r,a-1)];if(t){i.set(s,t)}else{return i[s]}},_objectOrSelf:function(t){return e(t).closest("[data-role=treeview]").data("kendoTreeView")||this},_dataSourceMove:function(e,t,i,n){var r,a=this._objectOrSelf(i||t),s=a.dataSource;if(i&&i[0]!=a.element[0]){r=a.dataItem(i);if(!r.loaded()){a._progress(i,true);r.load()}if(i!=this.root){s=r.children;if(!s||!(s instanceof o)){r._initChildren();r.loaded(true);s=r.children}}}e=this._toObservableData(e);return n.call(this,s,e)},_toObservableData:function(i){var n=i,r,a;if(i instanceof window.jQuery||F(i)){r=this._objectOrSelf(i).dataSource,a=e(i).attr(t.attr("uid"));n=r.getByUid(a);if(n){n=r.remove(n)}}return n},_insert:function(e,i,n){if(!(i instanceof t.data.ObservableArray)){if(!s(i)){i=[i]}}else{i=i.toJSON()}var r=e.parent();if(r){r.hasChildren=true;r._initChildren()}e.splice.apply(e,[n,0].concat(i));return this.findByUid(e[n].uid)},insertAfter:G(1),insertBefore:G(0),append:function(t,i,n){var r=this,a=r.root;n=n||e.noop;if(i){a=V(i)}return r._dataSourceMove(t,a,i,function(e,t){var a;function s(){if(i){r._expanded(i,true)}var n=e.data(),a=Math.max(n.length,0);return r._insert(n,t,a)}if(!e.data()){e.one(g,function(){n(s())});return null}else{a=s();n(a);return a}})},_remove:function(t,i){var n=this,r,a,s;t=e(t,n.element);r=t.parent().parent();a=t.prev();s=t.next();t[i?"detach":"remove"]();if(r.hasClass("k-item")){P(r);n._updateNodeClasses(r)}n._updateNodeClasses(a);n._updateNodeClasses(s);return t},remove:function(e){var t=this.dataItem(e);if(t){this.dataSource.remove(t)}},detach:function(e){return this._remove(e,true)},findByText:function(t){return e(this.element).find(".k-in").filter(function(i,n){return e(n).text()==t}).closest(H)},findByUid:function(e){return this.element.find(".k-item["+t.attr("uid")+"="+e+"]")},_renderItem:function(e){if(!e.group){e.group={}}e.treeview=this.options;e.r=this.templates;return this.templates.item(e)},_renderGroup:function(e){var t=this;e.renderItems=function(e){var i="",n=0,r=e.items,a=r?r.length:0,s=e.group;s.length=a;for(;n<a;n++){e.group=s;e.item=r[n];e.item.index=n;i+=t._renderItem(e)}return i};e.r=t.templates;return t.templates.group(e)}});function W(e){var n=this;n.treeview=e;n.hovered=e.element;n._draggable=new i.Draggable(e.element,{filter:"div:not(.k-state-disabled) .k-in",hint:function(t){return e.templates.dragClue({item:e.dataItem(t),treeview:e.options})},cursorOffset:{left:10,top:t.support.touch||t.support.msPointers||t.support.pointers?-40/t.support.zoomLevel():10},dragstart:l(n.dragstart,n),dragcancel:l(n.dragcancel,n),drag:l(n.drag,n),dragend:l(n.dragend,n)})}W.prototype={_removeTouchHover:function(){var e=this;if(t.support.touch&&e.hovered){e.hovered.find("."+N).removeClass(N);e.hovered=false}},_hintStatus:function(t){var i=this._draggable.hint.find(".k-drag-status")[0];if(t){i.className="k-icon k-drag-status "+t}else{return e.trim(i.className.replace(/k-(icon|drag-status)/g,""))}},dragstart:function(t){var i=this,n=i.treeview,r=i.sourceNode=t.currentTarget.closest(H);if(n.trigger(_,{sourceNode:r[0]})){t.preventDefault()}i.dropHint=e("<div class='k-drop-hint' />").css(T,"hidden").appendTo(n.element)},drag:function(i){var n=this,r=n.treeview,a=n.sourceNode,s=n.dropTarget=e(t.eventTarget(i)),d,o=s.closest(".k-treeview"),l,c,f,u,h,p,g,m,k;if(!o.length){d="k-denied";n._removeTouchHover()}else if(e.contains(a[0],s[0])){d="k-denied"}else{d="k-insert-middle";l=s.closest(".k-top,.k-mid,.k-bot");if(l.length){f=l.outerHeight();u=t.getOffset(l).top;h=s.closest(".k-in");p=f/(h.length>0?4:2);g=i.y.location<u+p;m=u+f-p<i.y.location;n._removeTouchHover();k=h.length&&!g&&!m;n.hovered=k?o:false;n.dropHint.css(T,k?"hidden":"visible");h.toggleClass(N,k);if(k){d="k-add"}else{c=l.position();c.top+=g?0:f;n.dropHint.css(c)[g?"prependTo":"appendTo"](s.closest(H).children("div:first"));if(g&&l.hasClass("k-top")){d="k-insert-top"}if(m&&l.hasClass("k-bot")){d="k-insert-bottom"}}}else if(s[0]!=n.dropHint[0]){if(o[0]!=r.element[0]){d="k-add"}else{d="k-denied"}}}r.trigger(b,{sourceNode:a[0],dropTarget:s[0],pageY:i.y.location,pageX:i.x.location,statusClass:d.substring(2),setStatusClass:function(e){d=e}});if(d.indexOf("k-insert")!==0){n.dropHint.css(T,"hidden")}n._hintStatus(d)},dragcancel:function(){this.dropHint.remove()},dragend:function(){var e=this,t=e.treeview,i="over",n=e.sourceNode,r,a=e.dropHint,s=e.dropTarget,d,o;if(a.css(T)=="visible"){i=a.prevAll(".k-in").length>0?"after":"before";r=a.closest(H)}else if(s){r=s.closest(H);if(!r.length){r=s.closest(".k-treeview")}}d={sourceNode:n[0],destinationNode:r[0],valid:e._hintStatus()!="k-denied",setValid:function(e){this.valid=e},dropTarget:s[0],dropPosition:i};o=t.trigger(x,d);a.remove();e._removeTouchHover();if(!d.valid||o){e._draggable.dropped=d.valid;return}e._draggable.dropped=true;function l(e){t.trigger(C,{sourceNode:e&&e[0],destinationNode:r[0],dropPosition:i})}if(i=="over"){t.append(n,r,l)}else{if(i=="before"){n=t.insertBefore(n,r)}else if(i=="after"){n=t.insertAfter(n,r)}l(n)}},destroy:function(){this._draggable.destroy()}};i.plugin(O)});
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/references/views/list',["require", "exports", "Backbone", "underscore", "jql", "vendor/jquery/plugins/jquery.scrollTo", "text!controls/common/templates/loading-large.html", "text!controls/references/templates/list/browse.html", "text!controls/references/templates/list/search.html", "text!controls/references/templates/list/title.html", "text!controls/references/templates/list/tree.html", "lib/api", "lib/templates", "lib/net", "lib/events", "lib/shortcuts", "controls/references/models/searchResultCollection", "controls/references/models/browse", "kendoui/kendo.core", "kendoui/kendo.treeview", "kendoui/kendo.dropdownlist", "i18n!locale/nls/books"], function(require, exports, __Backbone__, _____, __$__, __scrollTo__, __loadingTemplate__, __browseTemplate__, __searchTemplate__, __titleTemplate__, __treeTemplate__, __api__, __Templates__, __net__, __Events__, __Shortcuts__, __SRC__, __B__, __KC__, __KT__, __KDDL__, __TextBook__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../../../vendor/jquery/plugins/jquery.scrollTo.d.ts"/>
    
    var scrollTo = __scrollTo__;
    /// <reference path="../../common/templates/templates.d.ts" />
    
    var loadingTemplate = __loadingTemplate__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var browseTemplate = __browseTemplate__;

    var searchTemplate = __searchTemplate__;

    var titleTemplate = __titleTemplate__;

    var treeTemplate = __treeTemplate__;

    var api = __api__;

    
    
    var Templates = __Templates__;

    var net = __net__;

    var Events = __Events__;

    var Shortcuts = __Shortcuts__;

    var SRC = __SRC__;

    
    var B = __B__;
    ///<reference path="../../../vendor/kendoui/kendoui.d.ts"/>
    
    var KC = __KC__;

    var KT = __KT__;

    var KDDL = __KDDL__;
    ///<reference path="../../../locale/nls/locales.d.ts"/>
    
    var TextBook = __TextBook__;

    var LIST_MODE = {
        TREE: 'tree',
        SEARCH: 'search'
    };
    var ListView = (function (_super) {
        __extends(ListView, _super);
        function ListView(options) {
            // Force include
            if(scrollTo || !scrollTo) {
            }
            if(KC || !KC) {
            }
            if(KT || !KT) {
            }
            if(KDDL || !KDDL) {
            }
            this.hub = options.hub;
            this.templateSearch = Templates.compile(Templates.tk_referencesListSearchResults, searchTemplate);
            this.templateTitle = Templates.compile(Templates.tk_referencesListTitle, titleTemplate);
            this.templateTree = Templates.compile(Templates.tk_referencesListTree, treeTemplate);
            this.templateBrowse = Templates.compile(Templates.tk_referencesBrowse, browseTemplate);
            this.templateLoading = Templates.get(Templates.tk_loadingLarge, loadingTemplate);
            this.contentSelector = options.contentSelector;
            this.titleSelector = options.titleSelector;
            this.browseSelector = options.browseSelector;
            this.cachedBook = '';
            this.cachedTerm = '';
            this.cachedArticleID = '';
            this.books = null;
            this.browse = null;
            this.cachedTreeView = null;
            this.scrollDuration = 0;
            this.isFirstRender = true;
            this.bookFilters = options.bookFilters || null;
            this.mode = LIST_MODE.SEARCH;
            this.events = {
                'click': 'tcSetFocus',
                'click .section-heading.collapsible': 'toggleView',
                'click .search li': 'selectItem'
            };
            this.scopeName = 'references:list';
            this.shortcuts = {
                'enter references:list': 'selectItemEnter',
                'up references:list': 'moveArrow',
                'down references:list': 'moveArrow',
                'left references:list': 'moveArrow',
                'right references:list': 'moveArrow'
            };
                _super.call(this, options);
        }
        ListView.prototype.initialize = /** */
        function (options) {
            this.tcInit();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.hub, Events.ReferencesFocusList, this.tcSetFocus);
            this.listenTo(this.hub, Events.ReferencesSearch, this.search);
            this.listenTo(this.hub, Events.ReferencesSearch, this.renderBrowseBooks);
            this.listenTo(this.hub, Events.ReferencesListBooksComplete, this.cacheBooks);
            this.listenTo(this.hub, Events.ReferencesBrowseBook, this.expandBrowseTree);
            this.listenTo(this.hub, Events.ReferencesBrowseBook, this.updateBrowseBookDropdown);
            this.listenTo(this.hub, Events.ReferencesGetArticle, this.mockSelect);
            this.listenTo(this.hub, Events.ReferencesClear, this.clear);
            this.listenTo(this.hub, Events.ReferencesListBooksFailure, this.clear);
            this.listenTo(this.hub, Events.ReferencesBrowseBook, this.trySelectFirstYear);
        };
        ListView.prototype.clear = /** */
        function () {
            net.Net.tryAbort(this.currentReq);
            if(this.$(this.contentSelector).find('.tree').length === 0) {
                this.$(this.contentSelector).find('.pane-content').html('');
            }
        };
        ListView.prototype.browseBookChanging = /** */
        function (event) {
            var ddl = this.$('select.book-list').data('kendoDropDownList'), dataItem, bookId = '-1', bookText, browseOptions;
            this.tcSetFocus();
            if(ddl) {
                dataItem = ddl.dataItem();
                bookId = dataItem.value;
                bookText = dataItem.text.replace('Browse ', '');
            }
            if(bookId !== '-1') {
                browseOptions = {
                    bookId: bookId,
                    bookText: bookText
                };
                this.hub.trigger(Events.ReferencesBrowseBook, browseOptions);
                this.$el.closest('.references').addClass('browsing').removeClass('searching');
                this.onKeyboardFocus();
            }
        };
        ListView.prototype.updateBrowseBookDropdown = /** */
        function (event) {
            var ddl = this.$(this.browseSelector).find('select.book-list').data('kendoDropDownList');
            if(ddl) {
                ddl.select(function (item) {
                    return item.value === event.bookId;
                });
            }
            this.$el.closest('.references').addClass('browsing').removeClass('searching');
        };
        ListView.prototype.expandBrowseTree = /** */
        function (event) {
            var listYearsOptions, that = this, $year;
            this.cachedBook = event.bookId;
            listYearsOptions = {
                book: event.bookId
            };
            net.Net.tryAbort(this.currentReq);
            this.currentReq = api.TC.current()._net.referencesListYears(listYearsOptions, this.showYears, this.handleError);
            if(event.issueYear) {
                this.hub.once(Events.ReferencesBrowseYearsComplete, function () {
                    $year = that.$('.k-item[data-year="' + event.issueYear + '"]');
                    $year.find('.k-plus').click();
                });
                if(event.issueTitle) {
                    this.hub.once(Events.ReferencesBrowseIssuesComplete, function () {
                        $year.find('.k-item .k-in').each(function () {
                            if($(this).text() === event.issueTitle) {
                                $(this).prev('.k-plus').click();
                                return false;
                            }
                        });
                    });
                    if(event.articleId) {
                        this.hub.once(Events.ReferencesBrowseArticlesComplete, function () {
                            var $article = that.$('#id-' + event.articleId).closest('li.k-item');
                            that.focusEntry($article, true);
                            that.cachedTreeView.select($article);
                        });
                    }
                }
            }
        };
        ListView.prototype.showYears = /** */
        function (data) {
            this.browse = new B.Browse().set(data, {
                parse: true
            });
            this.render('browse');
        };
        ListView.prototype.cacheBooks = /** */
        function (event) {
            this.books = event.books;
            this.renderBrowseBooks();
        };
        ListView.prototype.setLoading = /** */
        function (notDone) {
            if(typeof notDone === 'undefined' || !notDone) {
                this.$('.tc-loading').remove();
            } else {
                this.$(this.contentSelector).find('.pane-content').html(this.templateLoading);
            }
        };
        ListView.prototype.getFocusElement = /** */
        function () {
            return this.$(this.contentSelector);
        };
        ListView.prototype.moveArrow = /** */
        function (e, keymasterEvent) {
            if(this.mode === LIST_MODE.SEARCH) {
                var jqE = $.event.fix(e);
                jqE.preventDefault();
                var $originalSelectedRow = this.$('.k-state-focused').length > 0 ? this.$('.k-state-focused') : this.$('.item-selected'), $selectedRow = $originalSelectedRow, isIndication = $selectedRow.hasClass('indication'), isIndicationChild = $selectedRow.hasClass('indication-child'), isIndicationGroup = $selectedRow.hasClass('indication-group-name'), expandedRow = false, collapsedRow = false;
                if(isIndicationGroup) {
                    $selectedRow = $selectedRow.closest('.indication');
                }
                // navigate
                switch(keymasterEvent.key) {
                    case 'up':
                        $selectedRow = $selectedRow.prevAll('li:first');
                        if($selectedRow.length === 0) {
                            if(isIndication || isIndicationGroup) {
                                $selectedRow = $originalSelectedRow.closest('ul.indication-group').prev();
                                if($selectedRow.find('.k-minus').length) {
                                    // expanded, find the last item
                                    $selectedRow = $selectedRow.find('li.indication').find('li:last');
                                } else {
                                    // not expanded, select the group
                                    $selectedRow = $selectedRow.find('li.indication');
                                }
                            } else if(isIndicationChild) {
                                $selectedRow = $originalSelectedRow.hasClass('first') ? $originalSelectedRow.closest('li.indication').find('.indication-group-name') : $originalSelectedRow.closest('ul.indication-group').prev().find('li.indication').find('li:last');
                            } else {
                                $selectedRow = $originalSelectedRow.parent().prevAll('ul:last,ol:last').find('li:last');
                            }
                        }
                        if($selectedRow.length === 0) {
                            $selectedRow = $originalSelectedRow.closest('.accordion-group').prevAll('.accordion-group:last').find('li:last');
                        }
                        break;
                    case 'down':
                        $selectedRow = $selectedRow.nextAll('li:first');
                        if($selectedRow.length === 0) {
                            if(isIndication || isIndicationGroup) {
                                $selectedRow = $originalSelectedRow.closest('ul.indication-group');
                                if($selectedRow.find('.k-minus').length) {
                                    // expanded, find the first item
                                    $selectedRow = $selectedRow.find('li.indication-child:first');
                                } else {
                                    // not expanded, select the group
                                    $selectedRow = $selectedRow.next().find('.indication-group-name');
                                }
                            } else if(isIndicationChild) {
                                $selectedRow = $originalSelectedRow.hasClass('last') ? $originalSelectedRow.closest('ul.indication-group').next().find('.indication-group-name') : $selectedRow.next();
                            } else {
                                $selectedRow = $originalSelectedRow.parent().nextAll('ul:first,ol:first').find('li:first');
                            }
                        }
                        if($selectedRow.length === 0) {
                            $selectedRow = $originalSelectedRow.closest('.accordion-group').nextAll('.accordion-group:first').find('li:first');
                        }
                        break;
                    case 'left':
                        if(isIndication || isIndicationGroup) {
                            if(isIndicationGroup) {
                                $selectedRow = $selectedRow.closest('.indication');
                            }
                            if($selectedRow.find('.k-minus').length) {
                                $selectedRow.click();
                                collapsedRow = true;
                            }
                        }
                        break;
                    case 'right':
                        if(isIndication || isIndicationGroup) {
                            if($selectedRow.find('.k-minus').length) {
                                // already expanded
                                return;
                            }
                            if(isIndicationGroup) {
                                $selectedRow = $selectedRow.closest('.indication');
                            }
                            if($selectedRow.find('.k-plus').length) {
                                $selectedRow.click();
                                expandedRow = true;
                                $selectedRow = $selectedRow.find('.indication-group-name');
                            }
                        }
                        break;
                    default:
                        break;
                }
                if($selectedRow.hasClass('indication') && !isIndicationChild && !expandedRow && !collapsedRow) {
                    if($selectedRow.find('.k-minus').length) {
                        $selectedRow = $selectedRow.find('li:first');
                    }
                }
                if($selectedRow.length === 1) {
                    this.focusEntry($selectedRow);
                }
            }
        };
        ListView.prototype.selectItemEnter = /** */
        function (e, keymasterEvent) {
            var jqE = $.event.fix(e);
            jqE.preventDefault();
            if(this.mode === LIST_MODE.SEARCH) {
                var $focused = this.$('.k-state-focused').click();
                if($focused.hasClass('indication')) {
                    $focused.find('.indication-group-name').addClass('k-state-focused');
                } else if($focused.hasClass('indication-group-name')) {
                    $focused.addClass('k-state-focused');
                }
            } else {
                var $focused = this.$('.k-state-focused').length ? this.$('.k-state-focused') : this.$('.k-state-selected');
                $focused.prev('.k-icon').click();
            }
        };
        ListView.prototype.selectItem = /** */
        function (event) {
            var $target = $(event.currentTarget), ignoreTarget = $(event.target).is('a,ul,li.indication-child'), getArticleOptions;
            if(typeof $target.attr('data-article-id') === 'string') {
                this.focusEntry($target, false, true);
                getArticleOptions = {
                    id: $target.attr('data-article-id'),
                    book: $target.parent().attr('data-book') || $target.attr('data-book')
                };
                if(this.books && this.books.where({
                    can_list: true,
                    id: $target.attr('data-book')
                }).length > 0) {
                    getArticleOptions.issueYear = $target.attr('data-issue-year');
                    getArticleOptions.issueTitle = $target.attr('data-issue-title');
                }
                this.hub.trigger(Events.ReferencesGetArticle, getArticleOptions);
            } else if($target.hasClass('indication') && !ignoreTarget) {
                $target.find('ul').toggle();
                $target.find('.k-plus,.k-minus').toggleClass('k-plus k-minus');
            }
        };
        ListView.prototype.focusEntry = /** */
        function ($target, shouldSkipSelected, select) {
            var $c = this.$('.list-content.pane-scrollable .pane-content'), offset = this.resultsHeight / 2, scrollOptions, elToFocus;
            scrollOptions = {
                duration: this.scrollDuration,
                offset: -offset
            };
            $c.stop().scrollTo($target, scrollOptions);
            if(typeof shouldSkipSelected === 'undefined' || shouldSkipSelected === false) {
                if(select) {
                    this.$('.item-selected').removeAttr('aria-selected').removeClass('item-selected');
                    $target.attr('aria-selected', 'true').addClass('item-selected');
                    this.$('.k-state-focused').removeClass('k-state-focused');
                } else {
                    this.$('.k-state-focused').removeClass('k-state-focused');
                    $target.addClass('k-state-focused');
                }
            }
        };
        ListView.prototype.selectSearchItem = /** */
        function () {
            var $itemToSelect = this.$('#article-' + this.cachedArticleID);
            if($itemToSelect.length == 0) {
                $itemToSelect = this.$(this.contentSelector).find('li:first');
                if($itemToSelect.closest('ul').hasClass('indication-group')) {
                    $itemToSelect.find('.k-plus').click();
                    $itemToSelect = $itemToSelect.find('li:first');
                }
            }
            $itemToSelect.click();
        };
        ListView.prototype.renderBrowseBooks = /** */
        function () {
            var that = this, ddl = this.$('select.ddl-menu'), kddl = ddl.length ? ddl.data('kendoDropDownList') : null, canListBooks = this.books && this.books.length ? _.where(this.books.toJSON(), {
                can_list: true
            }) : [], animationConfig = {
                close: {
                    duration: 0
                }
            };
            if(!api.TC.current().settings.effects) {
                animationConfig = false;
            }
            if(kddl) {
                kddl.destroy();
            }
            this.$(this.browseSelector).html(this.templateBrowse({
                canListBooks: canListBooks
            })).find('select.ddl-menu').kendoDropDownList({
                animation: animationConfig,
                change: this.browseBookChanging,
                dataBound: this.booksSetComplete,
                height: 500
            });
        };
        ListView.prototype.booksSetComplete = function (e) {
            var ddl = this.$('select.ddl-menu').data('kendoDropDownList');
            if(this.bookFilters) {
                if(e.sender.dataSource.data().length) {
                    ddl.unbind('dataBound');
                    e.sender.dataSource.filter(this.bookFilters);
                }
            } else {
                ddl.unbind('dataBound');
            }
        };
        ListView.prototype.render = /** */
        function (type) {
            if(this.isFirstRender) {
                this.renderBrowseBooks();
                this.isFirstRender = false;
            }
            this.$(this.contentSelector).stop().scrollTo(0);
            this.$(this.titleSelector).html(this.templateTitle({
                type: type,
                bookTitle: TextBook[this.cachedBook] || this.cachedBook
            }));
            switch(type) {
                case 'browse':
                    this.mode = LIST_MODE.TREE;
                    this.$(this.contentSelector).html(this.templateTree({
                        data: this.browse.toJSON(true),
                        TextBook: TextBook,
                        resultsHeight: this.resultsHeight + 'px'
                    }));
                    this.initTreeView();
                    break;
                default:
                    this.mode = LIST_MODE.SEARCH;
                    this.$(this.contentSelector).html(this.templateSearch({
                        results: this.searchResults,
                        TextBook: TextBook,
                        resultsHeight: this.resultsHeight + 'px'
                    }));
                    this.selectSearchItem();
                    break;
            }
            this.isMockSearch = false;
            return this;
        };
        ListView.prototype.mockSelect = /** */
        function (event) {
            if(event.mockUser) {
                var $target = this.$('[data-article-id="' + event.id + '"]');
                if($target.length === 1) {
                    this.focusEntry($target, false, true);
                    this.tcSetFocus();
                }
            }
        };
        ListView.prototype.initTreeView = //#region KendoTreeView
        /** */
        function () {
            var settings = {
                template: '#= item.text #<input type="hidden" class="data-id" id="id-#= item.ID #" value="#= item.ID #" />'
            };
            if(!api.TC.current().settings.effects) {
                settings.animation = false;
            }
            var ktd = this.cachedTreeView = this.$('.treeview').kendoTreeView(settings).data('kendoTreeView');
            ktd.bind('expand', this.onExpand);
            ktd.bind('select', this.onSelect);
            ktd.bind('navigate', this.onNavigate);
            this.hub.trigger(Events.ReferencesBrowseYearsComplete);
        };
        ListView.prototype.onNavigate = /** */
        function (event) {
            this.focusEntry($(event.node), true);
        };
        ListView.prototype.onSelect = /** */
        function (event) {
            var level = this.cachedTreeView.dataItem(event.node).level(), getArticleOptions;
            if(level !== 2) {
                return;
            }
            getArticleOptions = {
                id: $(event.node).find('.data-id').val()
            };
            this.hub.trigger(Events.ReferencesGetArticle, getArticleOptions);
        };
        ListView.prototype.onExpand = /** */
        function (event) {
            //this.cachedTreeView.append({ text: 'hi' });
                        var level = this.cachedTreeView.dataItem(event.node).level(), $node = $(event.node), listIssuesOptions, listArticlesOptions, that = this;
            if(!$node.attr('data-loaded')) {
                switch(level) {
                    case 0:
                        listIssuesOptions = {
                            book: $node.attr('data-book'),
                            year: $node.attr('data-year')
                        };
                        this.currentReq = api.TC.current()._net.referencesListIssues(listIssuesOptions, function (data) {
                            that.showIssues(data, event.node);
                        }, this.handleError);
                        break;
                    case 1:
                        listArticlesOptions = {
                            issue: $node.find('.data-id').val()
                        };
                        this.currentReq = api.TC.current()._net.referencesListArticles(listArticlesOptions, function (data) {
                            that.showArticles(data, event.node);
                        }, this.handleError);
                        break;
                    default:
                        break;
                }
            }
        };
        ListView.prototype.showArticles = //#endregion
        /** */
        function (data, node) {
            $(node).attr('data-loaded', 'true');
            _.each(data.Articles, function (article) {
                article.text = article.ArticleTitle;
                delete article.ArticleTitle;
            });
            this.browse.set('Articles', data);
            var children = this.cachedTreeView.dataItem(node).children.data();
            children.pop();
            children.push.apply(children, data.Articles);
            this.hub.trigger(Events.ReferencesBrowseArticlesComplete);
        };
        ListView.prototype.showIssues = /** */
        function (data, node) {
            $(node).attr('data-loaded', 'true');
            _.each(data.Issues, function (issue) {
                issue.text = issue.IssueTitle;
                delete issue.IssueTitle;
                issue.items = [
                    {
                        text: '<span class="k-loading k-icon tc-loading"></span>',
                        ID: ''
                    }
                ];
            });
            this.browse.set('Issues', data.Issues);
            var children = this.cachedTreeView.dataItem(node).children.data();
            children.pop();
            children.push.apply(children, data.Issues);
            this.hub.trigger(Events.ReferencesBrowseIssuesComplete);
        };
        ListView.prototype.search = /**
        * @listens Events.ReferencesSearch
        */
        function (event) {
            var searchOptions;
            this.setLoading(true);
            this.cachedBook = event.bookName;
            this.cachedTerm = event.term;
            this.cachedArticleID = event.articleId;
            this.isMockSearch = event.mockUser;
            searchOptions = {
                book: event.bookId,
                term: event.term
            };
            net.Net.tryAbort(this.currentReq);
            this.currentReq = api.TC.current()._net.referencesSearch(searchOptions, this.showSearchResults, this.handleError);
        };
        ListView.prototype.showSearchResults = /** */
        function (data) {
            var hasArticles = false;
            this.setLoading(false);
            // handle data.search_type as necessary
            this.searchResults = new SRC.SearchResultCollection(data).toJSON();
            for(var i = 0; !hasArticles && i < this.searchResults.length; i++) {
                for(var j = 0; !hasArticles && j < this.searchResults[i].results.length; j++) {
                    hasArticles = this.searchResults[i].results[j].articles.length > 0;
                }
            }
            if(!hasArticles) {
                this.hub.trigger(Events.ReferencesSearchNoResults);
            } else {
                this.hub.trigger(Events.ReferencesSearchComplete);
            }
            this.render();
        };
        ListView.prototype.handleError = /** */
        function (error) {
            this.hub.trigger(Events.ReferencesSearchNoResults);
            this.clear();
        };
        ListView.prototype.toggleView = /** */
        function (e, keymasterEvent) {
            e.stopPropagation();
            $(e.target).closest('.accordion-heading').toggleClass('collapsed').find('.toggle-icon').toggleClass('k-plus k-minus');
            // ANIMATION
            var duration = (api.TC.current().settings.effects) ? 600 : 0;
            $(e.target).closest('.accordion-group').find('.section-items').slideToggle(duration);
        };
        ListView.prototype.onSplitterCreated = /** */
        function () {
            var splitter = this.$el.data('kendoSplitter');
            splitter.bind('layoutChange', this.fixScrollHeight);
            this.fixScrollHeight();
        };
        ListView.prototype.fixScrollHeight = function (e) {
            var $scrollableList = this.$('.list-content.pane-scrollable');
            if($scrollableList.length > 0) {
                this.resultsHeight = $scrollableList.height() - 31;
                $scrollableList.find('.pane-content').css('height', this.resultsHeight);
            }
        };
        ListView.prototype.trySelectFirstYear = function (event) {
            if(typeof event.issueYear === 'undefined') {
                var that = this;
                this.hub.once(Events.ReferencesBrowseYearsComplete, function selectAfterYears() {
                    var $selected = that.cachedTreeView.select();
                    if($selected.length === 0) {
                        that.onKeyboardFocus();
                    } else {
                        $selected.click();
                    }
                });
            }
        };
        ListView.prototype.onKeyboardFocus = function () {
            if(this.$el.find('.tree').length !== 0) {
                var $itemToSelect = this.cachedTreeView.select();
                $itemToSelect = $itemToSelect.length !== 0 ? $itemToSelect.first() : this.$('.k-treeview li:first');
                $itemToSelect.click();
                this.cachedTreeView.select($itemToSelect);
            }
        };
        ListView.prototype.onClearFocus = function () {
            this.$('.k-state-focused').removeClass('k-state-focused');
        };
        return ListView;
    })(Backbone.View);
    exports.ListView = ListView;    
})
;
define('text!controls/references/templates/detail/details-title.html',[],function () { return '<div class="pane-content pane-slim-s pane-slim-w pane-slim-e">\r\n    <div class="border">\r\n        <div class="heading-slim">\r\n            <% if (bookTitle) { print(bookTitle); } else { print(\'&nbsp;\'); } %>\r\n        </div>\r\n        <div class="controls control-group">\r\n            <div class="history">\r\n                <button type="button" class="references-back references-history disabled k-state-disabled k-button"><span class="k-icon k-i-arrow-w">Back</span></button>\r\n                <button type="button" class="references-forward references-history disabled k-state-disabled k-button"><span class="k-icon k-i-arrow-e">Forward</span></button>\r\n            </div>\r\n            <div class="article-title" title="">&nbsp;</div>\r\n            <div class="actions">\r\n                <button type="button" class="references-browse-issue k-button" style="display:none">Browse Issue</button>\r\n                <button type="button" class="references-print k-button"><i class="k-icon tc-print"></i></button>\r\n            </div>\r\n        </div>\r\n    </div>\r\n</div>';});

define('text!controls/references/templates/detail/details.html',[],function () { return '<div class="pane-content pane-slim pane-text" tabindex="-1">\r\n</div>';});

define('text!controls/references/templates/detail/notes-title.html',[],function () { return '<div class="pane-content pane-slim-s pane-slim-w pane-slim-e">\r\n    <div class="heading-slim">Notes</div>\r\n</div>';});

define('text!controls/references/templates/detail/notes.html',[],function () { return '<div class="pane-content pane-slim pane-text">\r\n</div>';});

var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/references/models/detailViewModel',["require", "exports", "Backbone"], function(require, exports, __Backbone__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    var DetailViewModel = (function (_super) {
        __extends(DetailViewModel, _super);
        function DetailViewModel(options) {
            this.defaults = {
                history: []
            };
                _super.call(this, options);
        }
        return DetailViewModel;
    })(Backbone.Model);
    exports.DetailViewModel = DetailViewModel;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/references/views/detail',["require", "exports", "Backbone", "underscore", "jql", "text!controls/common/templates/loading-large.html", "text!controls/references/templates/detail/details-title.html", "text!controls/references/templates/detail/details.html", "text!controls/references/templates/detail/notes-title.html", "text!controls/references/templates/detail/notes.html", "lib/api", "lib/dom", "lib/templates", "lib/net", "lib/events", "lib/shortcuts", "lib/modal", "controls/references/models/detailViewModel", "i18n!locale/nls/books"], function(require, exports, __Backbone__, _____, __$__, __loadingTemplate__, __contentTitleTemplate__, __contentTemplate__, __notesTitleTemplate__, __notesTemplate__, __api__, __dom__, __Templates__, __net__, __Events__, __Shortcuts__, __Modal__, __DVM__, __TextBook__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    /// <reference path="../../common/templates/templates.d.ts" />
    
    var loadingTemplate = __loadingTemplate__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var contentTitleTemplate = __contentTitleTemplate__;

    var contentTemplate = __contentTemplate__;

    var notesTitleTemplate = __notesTitleTemplate__;

    var notesTemplate = __notesTemplate__;

    var api = __api__;

    var dom = __dom__;

    var Templates = __Templates__;

    var net = __net__;

    var Events = __Events__;

    var Shortcuts = __Shortcuts__;

    var Modal = __Modal__;

    var DVM = __DVM__;
    ///<reference path="../../../locale/nls/locales.d.ts"/>
    
    var TextBook = __TextBook__;

    var DetailView = (function (_super) {
        __extends(DetailView, _super);
        function DetailView(options) {
            this.hub = options.hub;
            this.templateContentTitle = Templates.compile(Templates.tk_referencesDetailContentTitle, contentTitleTemplate);
            this.templateContent = Templates.compile(Templates.tk_referencesDetailContent, contentTemplate);
            this.templateNotesTitle = Templates.get(Templates.tk_referencesDetailNotesTitle, notesTitleTemplate);
            this.templateNotes = Templates.compile(Templates.tk_referencesDetailNotes, notesTemplate);
            this.templateLoading = Templates.get(Templates.tk_loadingLarge, loadingTemplate);
            this.contentSelector = options.detailSelector;
            this.contentTitleSelector = options.titleSelector;
            this.notesTitleSelector = options.notesTitleSelector;
            this.notesSelector = options.notesSelector;
            this.historyIndex = 0;
            this.model = new DVM.DetailViewModel();
            this.history = this.model.get('history');
            this.isShowingNoResults = false;
            this.events = {
                'click': 'tcSetFocus',
                'click .references-print': 'print',
                'click .tc_drug_section_hdr': 'toggle',
                'click .tc-article-link': 'handleArticleLink',
                'click .references-browse-issue': 'handleBrowseIssueClick',
                'click a.ref_thumb': 'handleThumbnailClick',
                'click .references-history': 'navigateHistory',
                'click .tc-code-link': 'handleCodeClick'
            };
            this.scopeName = 'references:detail';
            this.shortcuts = {
            };
                _super.call(this, options);
        }
        DetailView.prototype.initialize = function (options) {
            this.tcInit();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.hub, Events.ReferencesGetArticle, this.getArticle);
            this.listenTo(this.hub, Events.ReferencesGetArticle, this.showBrowseIssue);
            this.listenTo(this.hub, Events.ReferencesGetArticle, this.setHistoryButtons);
            this.listenTo(this.hub, Events.ReferencesSearch, this.updateTitleFromSearch);
            this.listenTo(this.hub, Events.ReferencesBrowseBook, this.updateTitleFromBrowse);
            this.listenTo(this.hub, Events.ReferencesSearch, this.onSearch);
            this.listenTo(this.hub, Events.ReferencesBrowseBook, this.clearContent);
            this.listenTo(this.hub, Events.ReferencesSearchNoResults, this.clearContent);
            this.listenTo(this.hub, Events.ReferencesClear, this.clear);
            this.listenTo(this.hub, Events.ReferencesListBooksFailure, this.clear);
            this.listenTo(this.hub, Events.ReferencesSearchNoResults, this.onNoSearchResults);
        };
        DetailView.prototype.handleThumbnailClick = function (event) {
            var $target = $(event.currentTarget), containerHeight = this.$el.closest('.bottom-wrap').height() - 100, imageClone = $target.find('img').clone().removeClass('ref_thumb'), imageHeightCalcDiv = $('<div style="position:absolute; bottom:0;right:0;z-index:-1000"/>').appendTo(this.$el).append(imageClone), imageHeight = imageClone.height(), htmlContent = $('<div/>').append('<strong class="ref-title">' + $target.prev('.ref_image_title').text() + '</strong>').append($target.html());
            event.preventDefault();
            if(containerHeight < 0) {
                containerHeight = 300;
            }
            imageHeightCalcDiv.remove();
            Modal.show({
                title: 'Interventional Radiology Image',
                htmlContent: htmlContent,
                maxHeight: containerHeight,
                height: imageHeight,
                close: this.tcSetFocus,
                open: this.tcClearFocus
            });
            return false;
        };
        DetailView.prototype.getFocusElement = function () {
            return this.$('.detail-content');
        };
        DetailView.prototype.handleBrowseIssueClick = /** */
        function (event) {
            var $target = $(event.currentTarget), issueTitle = $target.attr('data-issue-title'), issueYear = $target.attr('data-issue-year'), book = $target.attr('data-book'), articleId = $target.attr('data-article-id'), browseBookOptions;
            browseBookOptions = {
                bookId: book,
                issueTitle: issueTitle,
                issueYear: issueYear,
                articleId: articleId,
                preventClearContent: true
            };
            this.hub.trigger(Events.ReferencesBrowseBook, browseBookOptions);
        };
        DetailView.prototype.showBrowseIssue = /** */
        function (event) {
            if(event.issueTitle && event.issueYear && event.book) {
                this.$(this.contentTitleSelector).find('.references-browse-issue').show().attr('data-issue-title', event.issueTitle).attr('data-issue-year', event.issueYear).attr('data-book', event.book).attr('data-article-id', event.id);
            } else {
                this.hideBrowseIssue();
            }
        };
        DetailView.prototype.handleArticleLink = /** */
        function (event) {
            event.preventDefault();
            var $target = $(event.currentTarget), articleId = $target.attr('href'), getArticleOptions;
            getArticleOptions = {
                id: articleId
            };
            this.hub.trigger(Events.ReferencesGetArticle, getArticleOptions);
        };
        DetailView.prototype.toggle = /** */
        function (event) {
            var duration = (api.TC.current().settings.effects) ? 600 : 0, $target = $(event.currentTarget);
            $target.toggleClass('collapsed');
            $target.next().slideToggle(duration);
        };
        DetailView.prototype.print = /** */
        function (event) {
            var wasPrintSuccessful;
            this.hub.trigger(Events.ReferencesPrintRequested);
            if(!api.TC.current().settings.customPrintHandler) {
                var $printContent = $('.detail-content').clone(), frames = window.frames, printFrame = frames.references_print_frame;
                $printContent.find('.tc-article-note').show().before('<h2>Notes</h2>');
                printFrame.document.body.innerHTML = '<div class="print">' + $printContent.html() + '</div>';
                printFrame.window.focus();
                try  {
                    // need to use this command for IE to print consistent font sizes
                    wasPrintSuccessful = printFrame.document.execCommand("print", false, null);
                    // firefox doesn't throw an exception but returns false
                    if(!wasPrintSuccessful) {
                        printFrame.window.print();
                    }
                } catch (e) {
                    // fallback to standard window print
                    printFrame.window.print();
                }// clear to prevent ctrl+F searches from matching content within this frame
                
                printFrame.document.body.innerHTML = '';
            }
        };
        DetailView.prototype.onSearch = /** */
        function (event) {
            this.setLoading(true);
            this.isShowingNoResults = false;
        };
        DetailView.prototype.clear = /** */
        function () {
            net.Net.tryAbort(this.currentReq);
            this.clearContent();
            this.collapseNotes();
        };
        DetailView.prototype.clearContent = /** */
        function (event) {
            if(typeof event === 'undefined' || typeof event.preventClearContent === 'undefined' || event.preventClearContent === false) {
                this.$(this.contentSelector).html('&nbsp;');
                this.$(this.contentTitleSelector).find('.article-title').html('&nbsp;');
                this.collapseNotes();
                this.hideBrowseIssue();
            }
        };
        DetailView.prototype.hideBrowseIssue = /** */
        function () {
            this.$(this.contentTitleSelector).find('.references-browse-issue').hide();
        };
        DetailView.prototype.updateTitleFromBrowse = /** */
        function (event) {
            this.cachedBookTitle = event.bookText || TextBook[event.bookId] || '';
            this.$(this.contentTitleSelector).find('.heading-slim').text(this.cachedBookTitle);
            this.hideBrowseIssue();
        };
        DetailView.prototype.updateTitleFromSearch = /** */
        function (event) {
            var bookId = event.bookId;
            if(bookId.length) {
                bookId = bookId.toUpperCase();
            }
            this.cachedBookTitle = event.bookName || TextBook[bookId] || '';
            this.$(this.contentTitleSelector).find('.heading-slim').text(this.cachedBookTitle);
        };
        DetailView.prototype.updateTitleFromHistory = /** */
        function () {
            var currentHistoryItem = this.history[this.historyIndex], book = '';
            if(typeof currentHistoryItem !== 'undefined') {
                book = currentHistoryItem.book;
            }
            this.$(this.contentTitleSelector).find('.heading-slim').text(book);
        };
        DetailView.prototype.getArticle = /** */
        function (event) {
            var getArticleOptions, isHistoryEvent = (typeof event.isHistoryEvent !== 'undefined' && event.isHistoryEvent);
            this.currentArticleId = event.id;
            this.setLoading(true);
            this.isShowingNoResults = false;
            if(!isHistoryEvent) {
                this.addHistory(event);
            }
            getArticleOptions = {
                id: event.id
            };
            net.Net.tryAbort(this.currentReq);
            this.currentReq = api.TC.current()._net.referencesGetArticle(getArticleOptions, this.showArticle, this.handleError);
        };
        DetailView.prototype.showArticle = /** */
        function (data) {
            var $content = this.$(this.contentSelector), notes, title;
            this.setLoading(false);
            notes = $content.html(data).find('.tc-article-note').hide().clone();
            $content.find('a').attr('target', '_blank');
            title = this.$('.reference-title').remove().text();
            this.$(this.contentTitleSelector).find('.article-title').html(title).attr('title', title);
            if(notes.length > 0) {
                notes.show();
                this.$(this.notesSelector).find('.pane-content').html(notes);
                this.expandNotes();
            } else {
                this.collapseNotes();
            }
            $content.find('img:last').addClass('last');
            this.hub.trigger(Events.ReferencesGetArticleComplete);
        };
        DetailView.prototype.expandNotes = /** */
        function () {
            var ks = this.$el.data('kendoSplitter'), curSize = ks.size('.detail-notes');
            if(curSize === '0px') {
                ks.size('.detail-notes', '20%');
                ks.size('.detail-notes-title', '36px');
                this.fixNotesScrollHeight();
            }
        };
        DetailView.prototype.collapseNotes = /** */
        function () {
            var ks = this.$el.data('kendoSplitter'), curSize = ks.size('.detail-notes');
            if(curSize !== '0px') {
                ks.size('.detail-notes', '0px');
                ks.size('.detail-notes-title', '0px');
            }
        };
        DetailView.prototype.setLoading = /** */
        function (notDone) {
            if(typeof notDone === 'undefined' || !notDone) {
                this.$('.tc-loading').remove();
            } else {
                this.clearContent();
                this.$(this.contentSelector).html(this.templateLoading);
            }
        };
        DetailView.prototype.render = function () {
            this.$(this.contentTitleSelector).html(this.templateContentTitle({
                bookTitle: ''
            }));
            this.$(this.contentSelector.replace(' .pane-content', '')).html(this.templateContent());
            this.$(this.notesTitleSelector).html(this.templateNotesTitle);
            this.$(this.notesSelector).html(this.templateNotes());
            this.contentSelector += ' .pane-content';
            return this;
        };
        DetailView.prototype.onSetFocus = function (event) {
            dom.focusWithoutWindowScroll(this.$(this.contentSelector));
        };
        DetailView.prototype.handleError = function (e) {
            this.setLoading(false);
        };
        DetailView.prototype.onNoSearchResults = function () {
            this.isShowingNoResults = true;
        };
        DetailView.prototype.onSplitterCreated = /** */
        function () {
            var splitter = this.$el.data('kendoSplitter');
            splitter.bind('layoutChange', this.fixContentScrollHeight);
            splitter.bind('layoutChange', this.fixNotesScrollHeight);
            this.fixContentScrollHeight();
        };
        DetailView.prototype.fixContentScrollHeight = function (e) {
            var $scrollableDetail = this.$('.detail-content.pane-scrollable'), ks;
            if($scrollableDetail.length > 0) {
                ks = this.$el.data('kendoSplitter');
                if(ks.size('.detail-highlight') !== '0px') {
                    this.contentHeight = $scrollableDetail.height() - 12;
                } else {
                    this.contentHeight = $scrollableDetail.height() - 21;
                }
                $scrollableDetail.find('.pane-content').css('height', this.contentHeight);
            }
        };
        DetailView.prototype.fixNotesScrollHeight = function (e) {
            var $scrollableDetailNotes = this.$('.detail-notes.pane-scrollable');
            if($scrollableDetailNotes.length > 0) {
                this.detailNotesHeight = $scrollableDetailNotes.height() - 21;
                $scrollableDetailNotes.find('.pane-content').css('height', this.detailNotesHeight);
            }
        };
        DetailView.prototype.handleCodeClick = function (event) {
            event.preventDefault();
            var $target = $(event.currentTarget);
            var refCodeClick;
            var ct = $target.data('code-type');
            if(ct && ct.length) {
                ct = ct.toUpperCase();
            }
            var c = $target.data('code');
            refCodeClick = {
                code: c,
                codeType: ct,
                articleId: this.currentArticleId
            };
            this.hub.trigger(Events.ReferencesCodeClick, refCodeClick);
        };
        DetailView.prototype.navigateHistory = //#region History
        function (e) {
            var $target = $(e.currentTarget), options;
            if(!$target.hasClass('disabled')) {
                if($target.hasClass('references-back')) {
                    if(this.historyIndex > 0 && !this.isShowingNoResults) {
                        this.historyIndex--;
                    }
                } else {
                    if(this.historyIndex < this.history.length - 1) {
                        this.historyIndex++;
                    }
                }
                this.updateTitleFromHistory();
                options = this.history[this.historyIndex];
                options.isHistoryEvent = true;
                this.currentArticleId = options.id;
                this.hub.trigger(Events.ReferencesGetArticle, options);
            }
        };
        DetailView.prototype.addHistory = function (data, last) {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[references:history] addHistory');
            }
            var shouldChange = false, dataToInsert = {
                id: data.id,
                book: this.cachedBookTitle
            };
            // add to current index if isn't already equal to what we're adding, give precedence to other conditions
            if(typeof last === 'string') {
                if(this.history.length > 0) {
                    shouldChange = true;
                }
                // if not operating at the tail of the array rewrite the history from this point forward
                            } else if(this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
                shouldChange = true;
                // operating at the tail, act like 'last'
                            } else {
                if(this.history.length >= 0) {
                    shouldChange = true;
                }
            }
            if(shouldChange) {
                if(_.isEqual(this.history[this.historyIndex], dataToInsert) === false) {
                    this.history.push(dataToInsert);
                }
                this.historyIndex = this.history.length - 1;
            }
            this.model.trigger('change:history');
        };
        DetailView.prototype.setHistoryButtons = function () {
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[references:history] changed');
            }
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[references:history] index: ' + this.historyIndex + ', historyLength: ' + this.history.length);
            }
            // check current history position and enable/disable forward button
            if(this.historyIndex > 0) {
                this.$(this.contentTitleSelector).find('.references-back').removeClass('disabled k-state-disabled');
            } else {
                this.$(this.contentTitleSelector).find('.references-back').addClass('disabled k-state-disabled');
            }
            // check current history position and enable/disable forward button
            if(this.historyIndex < this.history.length - 1) {
                this.$(this.contentTitleSelector).find('.references-forward').removeClass('disabled k-state-disabled');
            } else {
                this.$(this.contentTitleSelector).find('.references-forward').addClass('disabled k-state-disabled');
            }
        };
        return DetailView;
    })(Backbone.View);
    exports.DetailView = DetailView;    
    //#endregion
    })
;
/**
 * SearchHighlight plugin for jQuery
 * 
 * Thanks to Scott Yang <http://scott.yang.id.au/>
 * for the original idea and some code
 *    
 * @author Renato Formato <renatoformato@virgilio.it> 
 *  
 * @version 0.33
 *
 *  Options
 *  - exact (string, default:"exact") 
 *    "exact" : find and highlight the exact words.
 *    "whole" : find partial matches but highlight whole words
 *    "wholestart" : find partial matches but highlight whole words that /start/ with the match
 *    "partial": find and highlight partial matches
 *     
 *  - style_name (string, default:'hilite')
 *    The class given to the span wrapping the matched words.
 *     
 *  - style_name_suffix (boolean, default:true)
 *    If true a different number is added to style_name for every different matched word.
 *     
 *  - debug_referrer (string, default:null)
 *    Set a referrer for debugging purpose.
 *     
 *  - engines (array of regex, default:null)
 *    Add a new search engine regex to highlight searches coming from new search engines.
 *    The first element is the regex to match the domain.
 *    The second element is the regex to match the query string. 
 *    Ex: [/^http:\/\/my\.site\.net/i,/search=([^&]+)/i]        
 *            
 *  - highlight (string, default:null)
 *    A jQuery selector or object to set the elements enabled for highlight.
 *    If null or no elements are found, all the document is enabled for highlight.
 *        
 *  - nohighlight (string, default:null)  
 *    A jQuery selector or object to set the elements not enabled for highlight.
 *    This option has priority on highlight. 
 *    
 *  - keys (string, default:null)
 *    Disable the analisys of the referrer and search for the words given as argument    
 *    
 */

//;(function( $ ){
define('vendor/jquery/plugins/jquery.searchHighlight',["jql"], function ($) {
    $.fn.SearchHighlight = function (options) {
        var ref = options.debug_referrer || document.referrer;
        if (!ref && options.keys == undefined) return this;

        SearchHighlight.options = $.extend({ exact: "exact", style_name: 'hilite', style_name_suffix: true }, options);

        if (options.engines) SearchHighlight.engines.unshift(options.engines);
        // allow matching '.'
        //var q = options.keys != undefined ? options.keys.toLowerCase().split(/[\s,\+\.]+/) : SearchHighlight.decodeURL(ref, SearchHighlight.engines);
        var q = options.keys != undefined ? options.keys.toLowerCase().split(/[\s,\+]+/) : SearchHighlight.decodeURL(ref, SearchHighlight.engines);
        if (q && q.join("")) {
            SearchHighlight.buildReplaceTools(q);
            return this.each(function () {
                var el = this;
                if (el == document) el = $("body")[0];
                SearchHighlight.hiliteElement(el, q);
            })
        } else return this;
    }

    var SearchHighlight = {
        options: {},
        regex: [],
        engines: [],
        subs: {},
        decodeURL: function (URL, reg) {
            URL = decodeURIComponent(URL);
            var query = null;
            $.each(reg, function (i, n) {
                if (n[0].test(URL)) {
                    var match = URL.match(n[1]);
                    if (match) {
                        query = match[1].toLowerCase();
                        return false;
                    }
                }
            })

            if (query) {
                query = query.replace(/(\'|")/, '\$1');
                query = query.split(/[\s,\+\.]+/);
            }

            return query;
        },
        regexAccent: [
      [/[\xC0-\xC5\u0100-\u0105]/ig, 'a'],
      [/[\xC7\u0106-\u010D]/ig, 'c'],
      [/[\xC8-\xCB]/ig, 'e'],
      [/[\xCC-\xCF]/ig, 'i'],
      [/\xD1/ig, 'n'],
      [/[\xD2-\xD6\xD8]/ig, 'o'],
      [/[\u015A-\u0161]/ig, 's'],
      [/[\u0162-\u0167]/ig, 't'],
      [/[\xD9-\xDC]/ig, 'u'],
      [/\xFF/ig, 'y'],
      [/[\x91\x92\u2018\u2019]/ig, '\'']
        ],
        matchAccent: /[\x91\x92\xC0-\xC5\xC7-\xCF\xD1-\xD6\xD8-\xDC\xFF\u0100-\u010D\u015A-\u0167\u2018\u2019]/ig,
        replaceAccent: function (q) {
            SearchHighlight.matchAccent.lastIndex = 0;
            if (SearchHighlight.matchAccent.test(q)) {
                for (var i = 0, l = SearchHighlight.regexAccent.length; i < l; i++)
                    q = q.replace(SearchHighlight.regexAccent[i][0], SearchHighlight.regexAccent[i][1]);
            }
            return q;
        },
        escapeRegEx: /((?:\\{2})*)([[\]{}*?|])/g, //the special chars . and + are already gone at this point because they are considered split chars
        buildReplaceTools: function (query) {
            var re = [], regex;
            $.each(query, function (i, n) {
                if (n = SearchHighlight.replaceAccent(n).replace(SearchHighlight.escapeRegEx, "$1\\$2"))
                    re.push(n);
            });

            regex = re.join("|");
            switch (SearchHighlight.options.exact) {
                case "exact":
                    regex = '\\b(?:' + regex + ')\\b';
                    break;
                case "whole":
                    regex = '\\b\\w*(' + regex + ')\\w*\\b';
                    break;
                case "wholestart":
                    regex = '\\b(' + regex + ')\\w*\\b';
                    break;
            }
            SearchHighlight.regex = new RegExp(regex, "gi");

            $.each(re, function (i, n) {
                SearchHighlight.subs[n] = SearchHighlight.options.style_name +
                  (SearchHighlight.options.style_name_suffix ? i + 1 : '');
            });
        },
        nosearch: /s(?:cript|tyle)|textarea/i,
        hiliteElement: function (el, query) {
            var opt = SearchHighlight.options, elHighlight, noHighlight;
            elHighlight = opt.highlight ? $(opt.highlight) : $("body");
            if (!elHighlight.length) elHighlight = $("body");
            noHighlight = opt.nohighlight ? $(opt.nohighlight) : $([]);

            elHighlight.each(function () {
                SearchHighlight.hiliteTree(this, query, noHighlight);
            });
        },
        hiliteTree: function (el, query, noHighlight) {
            if (noHighlight.index(el) != -1) return;
            var matchIndex = SearchHighlight.options.exact == "whole" || SearchHighlight.options.exact == "wholestart" ? 1 : 0;
            for (var startIndex = 0, endIndex = el.childNodes.length; startIndex < endIndex; startIndex++) {
                var item = el.childNodes[startIndex];
                if (item.nodeType != 8) {//comment node
                    //text node
                    if (item.nodeType == 3) {
                        var text = item.data, textNoAcc = SearchHighlight.replaceAccent(text);
                        var newtext = "", match, index = 0;
                        SearchHighlight.regex.lastIndex = 0;
                        while (match = SearchHighlight.regex.exec(textNoAcc)) {
                            newtext += text.substr(index, match.index - index) + '<a href="javascript:void(0)" class="' +
                            SearchHighlight.subs[match[matchIndex].toLowerCase()] + '">' + text.substr(match.index, match[0].length) + "</a>";
                            index = match.index + match[0].length;
                        }
                        if (newtext) {
                            //add the last part of the text
                            newtext += text.substring(index);
                            var repl = $.merge([], $("<span>" + newtext + "</span>")[0].childNodes);
                            endIndex += repl.length - 1;
                            startIndex += repl.length - 1;
                            $(item).before(repl).remove();
                        }
                    } else {
                        if (item.nodeType == 1 && item.nodeName.search(SearchHighlight.nosearch) == -1)
                            SearchHighlight.hiliteTree(item, query, noHighlight);
                    }
                }
            }
        }
    };

});
//})( jQuery );

define('text!controls/references/templates/detail/details-highlight.html',[],function () { return '<% var randomId = Math.random().toString().replace(\'0.\',\'\'); %>\r\n<div class="pane-content pane-slim">\r\n    <div class="heading-slim heading-nobg form-inline">\r\n        <div class="actions">\r\n            <div class="actions-right">\r\n                <input type="checkbox" class="hightlight-toggle" id="highlight-toggle-<%= randomId %>" checked="checked" />\r\n                <label for="highlight-toggle-<%= randomId %>">Highlight matched terms</label>\r\n            </div>\r\n            <button type="button" class="highlight-previous k-button k-state-disabled disabled">Previous Term</button>\r\n            <button type="button" class="highlight-next k-button k-state-disabled disabled">Next Term</button>\r\n        </div>\r\n    </div>\r\n</div>';});

var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/references/views/highlight',["require", "exports", "Backbone", "underscore", "jql", "vendor/jquery/plugins/jquery.searchHighlight", "text!controls/references/templates/detail/details-highlight.html", "lib/api", "lib/dom", "lib/templates", "lib/events", "lib/shortcuts"], function(require, exports, __Backbone__, _____, __$__, __jqHighlight__, __highlightTemplate__, __api__, __dom__, __Templates__, __Events__, __Shortcuts__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../../../vendor/jquery/plugins/jquery.searchHighlight.d.ts"/>
    
    var jqHighlight = __jqHighlight__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var highlightTemplate = __highlightTemplate__;

    var api = __api__;

    var dom = __dom__;

    var Templates = __Templates__;

    var Events = __Events__;

    var Shortcuts = __Shortcuts__;

    var HighlightView = (function (_super) {
        __extends(HighlightView, _super);
        function HighlightView(options) {
            // FORCE INCLUDE
            if(jqHighlight || !jqHighlight) {
            }
            this.hub = options.hub;
            this.template = Templates.compile(Templates.tk_referencesDetailHighlight, highlightTemplate);
            this.detailSelector = options.detailSelector;
            this.parentSelector = options.parentSelector;
            this.highlightOn = true;
            this.collapsed = false;
            this.isArticleVisible = false;
            this.events = {
                'click': 'tcSetFocus',
                'click .hightlight-toggle': 'toggleHighlight',
                'click .highlight-previous.enabled': 'findPrev',
                'click .highlight-next.enabled': 'findNext'
            };
            this.scopeName = 'references:highlight';
            this.shortcuts = {
            };
                _super.call(this, options);
        }
        HighlightView.prototype.initialize = function (options) {
            this.tcInit();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.hub, Events.ReferencesClear, this.clear);
            this.listenTo(this.hub, Events.ReferencesGetArticleComplete, this.highlightText);
            this.listenTo(this.hub, Events.ReferencesBrowseBook, this.collapseHighlight);
            this.listenTo(this.hub, Events.ReferencesSearch, this.onSearch);
            this.listenTo(this.hub, Events.ReferencesSearchComplete, this.setArticleVisible);
            this.listenTo(this.hub, Events.ReferencesSearchNoResults, this.unsetArticleVisible);
        };
        HighlightView.prototype.setArticleVisible = function () {
            this.isArticleVisible = true;
        };
        HighlightView.prototype.unsetArticleVisible = function () {
            this.isArticleVisible = false;
        };
        HighlightView.prototype.onSearch = function (event) {
            this.searchTerm = event.term;
            this.searchBook = event.bookId.toUpperCase();
            if(this.searchBook === 'DRUGS' || this.searchBook === 'DICTIONARY') {
                this.collapseHighlight();
            } else {
                this.expandHighlight();
            }
        };
        HighlightView.prototype.collapseHighlight = function () {
            if(!this.collapsed) {
                var ks = this.$el.closest('.detail-wrap').data('kendoSplitter');
                ks.size('.detail-highlight', '0px');
            }
            this.collapsed = true;
        };
        HighlightView.prototype.expandHighlight = function () {
            if(this.collapsed) {
                var ks = this.$el.closest('.detail-wrap').data('kendoSplitter');
                ks.size('.detail-highlight', '40px');
            }
            this.collapsed = false;
        };
        HighlightView.prototype.disableHighlight = function () {
            this.$('.hightlight-toggle').prop("checked", false);
            if(this.highlightOn) {
                this.toggleHighlight();
            }
        };
        HighlightView.prototype.clear = function () {
            this.disableHighlight();
            this.searchTerm = '';
            this.searchBook = '';
        };
        HighlightView.prototype.findPrev = function () {
            var $highlights = this.$detail.find('.hilite'), $activeSel = $highlights.filter('.selected'), $nextSel, idx;
            if($highlights.length) {
                if($activeSel.length) {
                    $activeSel.removeClass('selected');
                    idx = $highlights.index($activeSel);
                    $nextSel = (idx - 1 === -1) ? $highlights.last() : $highlights.eq(idx - 1);
                } else {
                    $nextSel = $highlights.last();
                }
            }
            if($nextSel) {
                dom.focusWithoutWindowScroll($nextSel.addClass('selected'));
            }
        };
        HighlightView.prototype.findNext = function () {
            var $highlights = this.$detail.find('.hilite'), $activeSel = $highlights.filter('.selected'), $nextSel, idx;
            if($highlights.length) {
                if($activeSel.length) {
                    $activeSel.removeClass('selected');
                    idx = $highlights.index($activeSel);
                    $nextSel = (idx + 1 === $highlights.length) ? $highlights.first() : $highlights.eq(idx + 1);
                } else {
                    $nextSel = $highlights.first();
                }
            }
            if($nextSel) {
                dom.focusWithoutWindowScroll($nextSel.addClass('selected'));
            }
        };
        HighlightView.prototype.highlightText = function () {
            this.$detail = this.$el.closest(this.parentSelector).find(this.detailSelector);
            if(this.highlightOn && !this.collapsed && this.isArticleVisible) {
                this.$('.k-button').addClass('enabled').removeClass('disabled k-state-disabled');
                this.$el.SearchHighlight({
                    exact: 'wholestart',
                    style_name_suffix: false,
                    keys: this.searchTerm,
                    highlight: this.$detail
                });
                if(this.$detail.find('.hilite').length === 0) {
                    this.$detail.find('.pane-content').append('<p id="no-matches-found">The term or code searched for is not present in the article, but information pertinent to this term/code is included. This article matched on <a class="hilite" href="javascript:void(0)">' + this.searchTerm + '</a>');
                }
            } else {
                this.$('.k-button').addClass('disabled k-state-disabled').removeClass('enabled');
                this.$detail.find('.hilite').each(function () {
                    $(this).replaceWith(this.childNodes);
                }).end().find('#no-matches-found').remove();
                this.$detail = null;
            }
        };
        HighlightView.prototype.toggleHighlight = function (e) {
            this.highlightOn = !this.highlightOn;
            this.$('.hightlight-toggle').prop("checked", this.highlightOn);
            this.highlightText();
        };
        HighlightView.prototype.render = function () {
            this.$el.html(this.template());
            return this;
        };
        return HighlightView;
    })(Backbone.View);
    exports.HighlightView = HighlightView;    
})
;
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define('controls/references/views/references',["require", "exports", "Backbone", "underscore", "jql", "text!controls/references/templates/references.html", "controls/references/views/searchbar", "controls/references/views/list", "controls/references/views/detail", "controls/references/views/highlight", "kendoui/kendo.core", "kendoui/kendo.splitter", "lib/api", "lib/templates", "lib/events", "lib/shortcuts", "lib/config", "lib/dom"], function(require, exports, __Backbone__, _____, __$__, __referencesTemplate__, __SBV__, __LV__, __DV__, __HLV__, __KC__, __KS__, __api__, __Templates__, __Events__, __Shortcuts__, __cfg__, __dom__) {
    ///<reference path="../../../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;
    ///<reference path="../../../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;
    ///<reference path="../../../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../templates/templates.d.ts"/>
    
    var referencesTemplate = __referencesTemplate__;

    var SBV = __SBV__;

    var LV = __LV__;

    var DV = __DV__;

    var HLV = __HLV__;
    ///<reference path="../../../vendor/kendoui/kendoui.d.ts"/>
    
    var KC = __KC__;

    var KS = __KS__;

    var api = __api__;

    var Templates = __Templates__;

    
    var Events = __Events__;

    var Shortcuts = __Shortcuts__;

    var cfg = __cfg__;

    var dom = __dom__;

    var ReferencesView = (function (_super) {
        __extends(ReferencesView, _super);
        function ReferencesView(options) {
            // Force include
            if(KC || !KC) {
            }
            if(KS || !KS) {
            }
            this.searchbarSelector = '.searchbar';
            this.listParent = '.list-wrap';
            this.listSelector = '.list-content';
            this.listTitleSelector = '.list-title';
            this.listBrowseSelector = '.list-browse';
            this.detailWrapSelector = '.detail-wrap';
            this.detailTitleSelector = '.detail-title';
            this.detailNotesTitleSelector = '.detail-notes-title';
            this.detailNotesSelector = '.detail-notes';
            this.detailSelector = '.detail-content';
            this.highlightSelector = '.detail-highlight';
            this.lastUsedBook = '';
            this.hideSearchbar = (options && typeof options.hideSearchbar === 'boolean') ? options.hideSearchbar : false;
            this.hideSearchAndBrowseResults = (options && typeof options.hideSearchAndBrowseResults === 'boolean') ? options.hideSearchAndBrowseResults : false;
            this.book = (options && options.book) ? options.book.toUpperCase() : '';
            this.bookFilters = (options && options.bookFilters) ? options.bookFilters : null;
            this.visible = true;
            this.childRefs = [];
            this.events = {
                'click': 'tcSetActiveWidget'
            };
            this.shortcuts = {
                'ctrl+up': 'movePaneFocus',
                'ctrl+down': 'movePaneFocus'
            };
                _super.call(this, options);
        }
        ReferencesView.prototype.initialize = function (options) {
            this.hub = Events.Get();
            this.tcInit();
            this.tcSetActiveWidget();
            if(api.TC.current().settings.keyboardShortcuts) {
                $.extend(this, Shortcuts.Get());
                this.delegateShortcuts();
            }
            _.bindAll(this);
            this.listenTo(this.hub, Events.ClearWidgetAreaFocus, this.blurSplitters);
            this.listenTo(this.hub, Events.ReferencesBrowseBook, this.updateBook);
            this.listenTo(this.hub, Events.ReferencesSearch, this.updateBook);
        };
        ReferencesView.prototype.movePaneFocus = /** Move pane focus */
        function (e, keymasterEvent) {
            $.event.fix(e).preventDefault();
            if(!this.$el.hasClass('active-widget')) {
                return;
            }
            // search       -> results      -> splitter     -> detail content
            // 10           -> 20           -> (s)25        -> 30
                        var kb = 'keyboard', $activePane = this.$('.' + cfg.activePaneClass), isSplitbar = $activePane.hasClass('k-splitbar'), paneIndex;
            paneIndex = isSplitbar ? 25 : parseInt($activePane.attr('data-pane-index'), 10);
            this.hub.trigger(Events.ClearWidgetAreaFocus);
            this.$('.' + cfg.activePaneClass).removeClass(cfg.activePaneClass);
            if(typeof DEBUG !== 'undefined' && DEBUG) {
                log('[sb] Blurring all!');
            }
            dom.blurAll();
            if(typeof paneIndex === 'number' && keymasterEvent.key === 'ctrl+up') {
                paneIndex *= -1;
            }
            // Compensate for "hidden" areas via config
            if(this.hideSearchbar && this.hideSearchAndBrowseResults) {
                paneIndex = 25// detail
                ;
            } else if(this.hideSearchbar) {
                if(isNaN(paneIndex) || paneIndex === 30) {
                    paneIndex = 10;
                }// results
                
                if(paneIndex === -20) {
                    paneIndex = 25;
                }// detail
                
            } else if(this.hideSearchAndBrowseResults) {
                if(isNaN(paneIndex) || paneIndex === 10 || paneIndex === 20) {
                    paneIndex = 25;
                }// detail
                
                if(paneIndex === -25 || paneIndex === -30) {
                    paneIndex = 30;
                }// searchbar
                
            }
            switch(paneIndex) {
                case -25:
                case 10:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -> results');
                    }
                    this.childRefs[1].tcSetFocus(kb);
                    break;
                case -30:
                case 20:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -> splitter');
                    }
                    dom.focusWithoutWindowScroll(this.$('.list-wrap').next('.k-splitbar').addClass(cfg.activePaneClass)).click();
                    break;
                case -10:
                case 25:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -> detail');
                    }
                    this.childRefs[2].tcSetFocus(kb);
                    break;
                case -20:
                case 30:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -^ searchbar');
                    }
                    this.childRefs[0].tcSetFocus(kb);
                    break;
                default:
                    if(typeof DEBUG !== 'undefined' && DEBUG) {
                        log('[focus] -^ searchbar');
                    }
                    this.childRefs[0].tcSetFocus(kb);
                    break;
            }
        };
        ReferencesView.prototype.onClose = function () {
            for(var i = 0; i < this.childRefs.length; i++) {
                this.childRefs[i].tcClose();
            }
        };
        ReferencesView.prototype.render = function () {
            var template = Templates.compile(Templates.tk_referencesWrapper, referencesTemplate), overrideSearchbarEl;
            this.$el.html(template({
                printTemplate: api.TC.current().settings.printTemplate
            }));
            // render regardless to take advantage of listBooksComplete event, not an issue with its small footprint
            if(this.hideSearchbar) {
                overrideSearchbarEl = $('<div/>');
            }
            this.childRefs.push(new SBV.SearchbarView({
                el: overrideSearchbarEl || this.$(this.searchbarSelector),
                book: this.book,
                bookFilters: this.bookFilters,
                hub: this.hub
            }).render());
            this.childRefs.push(new LV.ListView({
                el: this.$(this.listParent),
                contentSelector: this.listSelector,
                titleSelector: this.listTitleSelector,
                browseSelector: this.listBrowseSelector,
                bookFilters: this.bookFilters,
                hub: this.hub
            }).render());
            this.childRefs.push(new DV.DetailView({
                el: this.$(this.detailWrapSelector),
                detailSelector: this.detailSelector,
                titleSelector: this.detailTitleSelector,
                notesTitleSelector: this.detailNotesTitleSelector,
                notesSelector: this.detailNotesSelector,
                hub: this.hub
            }).render());
            this.childRefs.push(new HLV.HighlightView({
                el: this.$(this.highlightSelector),
                parentSelector: this.detailWrapSelector,
                detailSelector: this.detailSelector,
                hub: this.hub
            }).render());
            this.createSplitter();
            _.each(this.childRefs, function (child) {
                if(child.onSplitterCreated) {
                    child.onSplitterCreated();
                }
            });
            this.checkStyleVersions();
            return this;
        };
        ReferencesView.prototype.createSplitter = function () {
            var $el = this.$('.references-wrap');
            $el.height($el.parent().parent().height());
            $el.kendoSplitter({
                orientation: 'vertical',
                panes: [
                    // searchbar
                    {
                        collapsible: false,
                        resizable: false,
                        size: (this.hideSearchbar) ? '0px' : '82px',
                        scrollable: false
                    }, 
                    // others
                    {
                        collapsible: false,
                        scrollable: false
                    }
                ]
            });
            $el = this.$('.bottom-wrap');
            $el.kendoSplitter({
                orientation: 'horizontal',
                panes: [
                    // list
                    {
                        collapsible: false,
                        resizable: (this.hideSearchAndBrowseResults) ? false : true,
                        size: (this.hideSearchAndBrowseResults) ? '0px' : '360px',
                        min: (this.hideSearchAndBrowseResults) ? '0px' : '360px',
                        max: (this.hideSearchAndBrowseResults) ? '0px' : '50%',
                        scrollable: false
                    }, 
                    // detail
                    {
                        collapsible: false,
                        resizable: (this.hideSearchAndBrowseResults) ? false : true,
                        scrollable: false
                    }
                ]
            });
            $el = this.$('.list-wrap');
            $el.kendoSplitter({
                orientation: 'vertical',
                panes: [
                    // browse
                    {
                        collapsible: false,
                        resizable: false,
                        size: '64px',
                        scrollable: false
                    }, 
                    // title
                    {
                        collapsible: false,
                        resizable: false,
                        size: '36px',
                        scrollable: false
                    }, 
                    // tree/search
                    {
                        collapsible: false,
                        resizable: false,
                        scrollable: false
                    }
                ]
            });
            $el = this.$('.detail-wrap');
            $el.kendoSplitter({
                orientation: 'vertical',
                panes: [
                    // detail title
                    {
                        collapsible: false,
                        resizable: false,
                        size: '75px',
                        scrollable: false
                    }, 
                    // detail content
                    {
                        collapsible: false,
                        resizable: false,
                        scrollable: false
                    }, 
                    // Highlight bar
                    {
                        collapsible: false,
                        resizable: false,
                        size: '40px',
                        scrollable: false
                    }, 
                    // detail notes title
                    {
                        collapsible: false,
                        resizable: false,
                        size: '0px',
                        scrollable: false
                    }, 
                    // detail notes
                    {
                        collapsible: false,
                        resizable: false,
                        size: '0px',
                        scrollable: false
                    }
                ]
            });
            this.$('.k-splitbar-draggable-horizontal, .k-splitbar-draggable-vertical').focus(function () {
                $(this).find('.k-resize-handle').addClass('active-border');
            }).blur(function () {
                $(this).find('.k-resize-handle').removeClass('active-border');
            });
        };
        ReferencesView.prototype.blurSplitters = function () {
            this.$('.list-wrap').next('.k-splitbar').removeClass(cfg.activePaneClass).blur();
        };
        ReferencesView.prototype.updateBook = function (e) {
            this.lastUsedBook = e.bookId;
        };
        ReferencesView.prototype.tcGetBook = function () {
            return this.lastUsedBook;
        };
        return ReferencesView;
    })(Backbone.View);
    exports.ReferencesView = ReferencesView;    
})
;
define('lib/extensions',["require", "exports", "jql", "lib/config", "lib/events", "lib/shortcuts", "lib/net"], function(require, exports, __$__, __cfg__, __Events__, __Shortcuts__, __net__) {
    ///<reference path="../vendor/jquery/jquery.d.ts"/>
    var $ = __$__;

    var cfg = __cfg__;

    var Events = __Events__;

    var Shortcuts = __Shortcuts__;

    var net = __net__;

    // Extend dependent libraries
    function initBackboneExtensions(backbone) {
        /**
        * Each control instance extends this base view. These are the only methods that are intended to be called programmatically. The rest of the methods are for internal use only.
        * @class Controls.BaseView
        * @abstract
        */
        /**
        * This method closes the view, removes it from the DOM, and cleans up all events.
        *
        * Be sure to dispose of the reference to this view when you are done with it so it can be garbage collected.
        *
        * **Note:** The element in which this control was rendered is *removed* when this method is called. This occurs to clean up event handlers and any data attached to DOM nodes.
        */
        backbone.View.prototype.tcClose = function () {
            this.hub.trigger(Events.Destroy);
            if(this.onClose) {
                this.onClose();
            }
            // this currently isn't mapping modified keys correctly
            if(this.undelegateShortcuts) {
                this.undelegateShortcuts();
            }
            return this.remove();
        };
        /**
        * This method binds a callback function to an event for this control instance. The callback is invoked whenever the event is fired.
        *
        * @param {String} event The name of the event.
        * @param {Function} callback The callback function to bind.
        * @param {Boolean} [doOnce=false] Indicates if this callback should only be fired once before being automatically removed.
        */
        backbone.View.prototype.tcOn = function (event, callback, doOnce) {
            if(doOnce === true) {
                this.hub.once(event, callback);
            } else {
                this.listenTo(this.hub, event, callback);
            }
        };
        /**
        * This method removes a previously-bound callback function from this control instance.
        *
        * Events that have been bound are automatically removed as part of **#tcClose**. Use this when you need to remove an event at specific states of your application.
        *
        * @param {String} event The name of the event.
        * @param {Function} callback The callback function to unbind.
        */
        backbone.View.prototype.tcOff = function (event, callback) {
            this.stopListening(this.hub, event, callback);
        };
        /**
        * This method triggers this control instance's callbacks for the event.
        *
        * @param {String} event The name of the event.
        * @param {Object} options The options, or data, to be sent to the callbacks.
        */
        backbone.View.prototype.tcTrigger = function (event, options) {
            this.hub.trigger(event, options);
        };
        /**
        * This method gets or sets the control's visibility status. It's important to note that this doesn't actually hide or show a control. It lets the control know when to start or stop responding to user events such as keyboard presses.
        *
        * @param {Boolean} [isVisible] Boolean to update the control's status with. `true` when visible. `false` when hidden. When omitted, it returns the current visibility status.
        */
        backbone.View.prototype.tcVisible = function (isVisible) {
            if(typeof isVisible !== 'boolean') {
                return this.visible;
            } else {
                this.visible = isVisible;
                if(isVisible) {
                    this.tcSetFocus();
                }
                if(!isVisible) {
                    this.tcClearFocus();
                }
            }
        };
        // Private
        backbone.View.prototype.tcSetFocus = function (e, keymasterEvent) {
            var $elToFocus = (this.getFocusElement) ? this.getFocusElement() : this.$el, scope = this.scopeName || 'all', $activeEl = $('.' + cfg.activePaneClass);
            this.hub.trigger(Events.ClearWidgetAreaFocus);
            $elToFocus.addClass(cfg.activePaneClass);
            Shortcuts.setScope(scope);
            if(this.onSetFocus) {
                this.onSetFocus.call(this, {
                    scopeName: scope,
                    originalArgs: arguments
                });
            }
            if(e && e === 'keyboard' && this.onKeyboardFocus) {
                this.onKeyboardFocus.apply(this, arguments);
            }
        };
        backbone.View.prototype.tcSetActiveWidget = function () {
            this.hub.trigger(Events.ClearWidgetActive);
            this.$el.addClass(cfg.activeWidgetClass);
        };
        // Clears active widget class (will prevent the pane navigation global hotkey from functioning for this widget)
        backbone.View.prototype.tcClearActiveWidget = function () {
            var $elToFocus = (this.getFocusElement) ? this.getFocusElement() : this.$el;
            $elToFocus.removeClass(cfg.activeWidgetClass);
        };
        // Clears the active pane from the widget (resets global hotkey navigation position and allows for cleanup of extra evt handlers such as tabular's keyup)
        backbone.View.prototype.tcClearFocus = function (e) {
            var $elToFocus = (this.getFocusElement) ? this.getFocusElement() : this.$el;
            //if (typeof DEBUG !== 'undefined' && DEBUG) log('[focus] clearing');
            $elToFocus.removeClass(cfg.activePaneClass);
            Shortcuts.setScope('all');
            if(this.onClearFocus) {
                this.onClearFocus.apply(this, arguments);
            }
        };
        // Cleanup anything before global is destroyed
        backbone.View.prototype.tcDestroy = function (e) {
            if(this.currentReq) {
                net.Net.tryAbort(this.currentReq);
            }
        };
        // Automatically hook into clearFocus and clearActiveWidget events/methods
        backbone.View.prototype.tcInit = function () {
            this.listenTo(this.hub, Events.ClearWidgetAreaFocus, this.tcClearFocus);
            this.listenTo(this.hub, Events.ClearWidgetActive, this.tcClearActiveWidget);
            this.listenTo(this.hub, Events.Destroy, this.tcDestroy);
        };
        backbone.View.prototype.checkStyleVersions = function () {
            // avoid
                    };
    }
    exports.initBackboneExtensions = initBackboneExtensions;
})
;
define('lib/api',["require", "exports", "Backbone", "vendor/backbone/plugins/backbone.shortcuts", "jql", "underscore", "controls/codebooks/views/codebooks", "controls/research/views/research", "controls/references/views/references", "lib/config", "lib/extensions", "lib/net"], function(require, exports, __Backbone__, __BackboneShortcuts__, __$__, _____, __CBV__, __RPV__, __RV__, __cfg__, __ext__, __net__) {
    ///<reference path="../vendor/backbone/backbone.d.ts"/>
    var Backbone = __Backbone__;

    ///<reference path="../vendor/backbone/plugins/backbone.shortcuts.d.ts"/>
    var BackboneShortcuts = __BackboneShortcuts__;
    ///<reference path="../vendor/jquery/jquery.d.ts"/>
    
    var $ = __$__;
    ///<reference path="../vendor/underscore/underscore.d.ts"/>
    
    var _ = _____;

    var CBV = __CBV__;

    var RPV = __RPV__;

    var RV = __RV__;

    var cfg = __cfg__;

    var ext = __ext__;

    var net = __net__;
    // without this export here main.ts won't compile .....
    
    /**
    * TC is the global namespace for every class, function and configuration intended to be publicly accessible for the HTML controls.
    * @class TC
    * @singleton
    */
    var WebControls = (function () {
        function WebControls(options) {
            /** The TruCode HTML controls version number.  */
            this.version = '3.1.0.363';
            /**
            * @property {String} [env="stage"]
            * The target web service environment. Valid values are **stage** or **prod**.
            */
            this.env = 'stage';
            // Force include
            if(BackboneShortcuts || !BackboneShortcuts) {
            }
            // Library extensions
            ext.initBackboneExtensions(Backbone);
            this.settings = {
                _dirtyAuth: null,
                authorizationKey: null,
                authorizationTokenType: null,
                authorizationTimestamp: null,
                authorizationExpired: null,
                authorizationExpiredParser: null,
                proxyUrl: null,
                fatalErrorCallback: function (msg, textStatus, error) {
                },
                templates: null,
                keyboardShortcuts: null,
                modalId: null,
                codingLevel: null,
                effects: null,
                printTemplate: null,
                customPrintHandler: null,
                ajaxTimeout: null,
                forceProxy: null
            };
            /**
            * Flag to indicate that the authorization credentials have not yet been sanitized by the auth module.
            *
            * @private
            * @ignore This is not intended for public consumption
            */
            this.settings._dirtyAuth = true;
            /**
            * @cfg {String} authorizationKey (required)
            * The authorization header key.
            */
            this.settings.authorizationKey = '';
            /**
            * @cfg {String} [authorizationTokenType="Bearer"]
            * The authorization header token type.
            */
            this.settings.authorizationTokenType = 'Bearer';
            /**
            * @cfg {Date} authorizationTimestamp
            * The date that the authorization was set.
            * Useful when trying to preemptively determine if authorization has expired.
            * @ignore This is not yet implemented nor ready for public consumption
            */
            this.settings.authorizationTimestamp = null;
            /**
            * @cfg {Function} [authorizationExpired="this.fatalErrorCallback('Expired authorization callback not provided', '', null);"]
            * Refreshes authorization credentials.
            * @returns {String} Valid authorization values that will automatically be parsed by auth.setAuthorizationHeader.
            */
            this.settings.authorizationExpired = function () {
                this.fatalErrorCallback('Expired authorization callback not provided', '', null);
            };
            /**
            * @cfg {Function} [authorizationExpiredParser=null]
            * Provide a parser for the value returned by #authorizationExpired
            */
            this.settings.authorizationExpiredParser = null;
            /**
            * @cfg {String} [proxyUrl=null]
            * The URL of a server side script to proxy cross domain ajax requests through.
            * This is only useful for browsers that do not support <a href="http://www.w3.org/TR/cors/" target="_blank">CORS</a>.
            *
            * CORS support is automatically detected.
            */
            this.settings.proxyUrl = null;
            /**
            * @cfg {Function} [fatalErrorCallback="function (errorText, textStatus, error) {}"]
            * Specify a fatal error handler
            */
            this.settings.fatalErrorCallback = function (errorText, textStatus, error) {
                if(typeof DEBUG !== 'undefined' && DEBUG) {
                    log(errorText);
                }
                throw new Error(errorText + '\n' + textStatus + '\n' + error);
            };
            /**
            * @cfg {Boolean} [keyboardShortcuts=true]
            * Toggle keyboard shortcut handling. **Must** be set before controls are
            * rendered or events will ***not*** be bound.
            */
            this.settings.keyboardShortcuts = true;
            /**
            * @cfg {Object} [templates={}]
            * Provide custom HTML templates. See {@link Templates Templates} for more information.
            */
            this.settings.templates = {
            };
            /**
            * @cfg {String} [modalId="trucode-modal"]
            * The ID of the generated modal window
            */
            this.settings.modalId = 'trucode-modal';
            /**
            * @cfg {String} [codingLevel="beginner"]
            * Set this to modify how the controls display tips. Currently accepted values are `beginner` and `experienced`.
            */
            this.settings.codingLevel = 'beginner';
            /**
            * @cfg {Boolean} [effects=true]
            * Toggle effects and animations
            */
            this.settings.effects = true;
            /**
            * @cfg {String} printTemplate (required)
            * The path to the file to be used as the printing template. When a user prints using a print button, this file is embedded in a hidden frame and the innerHTML is overwritten with the contents to be printed. This file is used to set the print stylesheets in the `<head>` section and specify the page title.
            */
            this.settings.printTemplate = '../css/print.html';
            /**
            * @cfg {Boolean} customPrintHandler
            * Set to false if you don't want the default print action to occur. Handle the print event by listening to {@link Controls.References#ReferencesPrintRequested ReferencesPrintRequested}
            */
            this.settings.customPrintHandler = false;
            /**
            * @cfg {Number} ajaxTimeout
            * The time in ms used to control ajax timeouts. Set to 0 to disable timeouts.
            */
            this.settings.ajaxTimeout = 0;
            /**
            * @cfg {Boolean} [forceProxy=false]
            * Force the use of a proxy script even when the browser supports  <a href="http://www.w3.org/TR/cors/" target="_blank">CORS</a>. When this option is set to **true** the {@link #authorizationKey authorizationKey} option is no longer mandatory. This option is intended for those who wish to completely manage the authorizationKey as part of the proxy script and avoid it being revealed client side.
            */
            this.settings.forceProxy = false;
            /**
            * Internal events instance
            *
            * @ignore
            */
            this._tcEvents = $.extend({
            }, Backbone.Events);
            /**
            * Interal shortcuts instance
            *
            * @ignore
            */
            this._shortcuts = $.extend({
            }, new Backbone.Shortcuts());
            /**
            * @cfg {String} env
            * Initialize the {@link TC#env env} property
            */
            // treat TC.env specially
            if(options.env) {
                this.env = options.env;
                delete options.env;
            }
            this.settings.authorizationExpired = _.bind(this.settings.authorizationExpired, this);
            // extend with user options
            if(options) {
                $.extend(this.settings, options);
            }
            this._net = new net.Net(this);
        }
        WebControls.prototype.fatalErrorCallback = function (msg, textStatus, error) {
            this.settings.fatalErrorCallback(msg, textStatus, error);
        };
        WebControls.prototype.createControl = /**
        * Render a control
        *
        * @param typeOrOptions
        * Provide a string of the control name such as `'references'` or an object with `'type'` set to the control name along with named options for that control.
        * @param containerSelector
        * A <a href="http://sizzlejs.com/" target="_blank">SizzleJS</a> compatible selector where the control should be rendered within. **Note:** Be sure that this element can safely be removed from the DOM when finished with the control. {@link Controls.BaseView#tcClose .tcClose()} will remove this container when called.
        * @return {Object} A reference to the Backbone view
        */
        function (typeOrOptions, containerSelector) {
            var controlType, controlOptions, control;
            if(typeof typeOrOptions === 'string') {
                controlType = typeOrOptions;
                controlOptions = {
                    el: containerSelector
                };
            } else {
                controlType = typeOrOptions.type;
                delete typeOrOptions.type;
                controlOptions = typeOrOptions;
            }
            switch(controlType) {
                case 'codeBooks':
                    control = new CBV.EncoderView(controlOptions).render();
                    break;
                case 'research':
                    control = new RPV.ResearchView(controlOptions).render();
                    break;
                case 'researchPane':
                    control = new RPV.ResearchView(controlOptions).render();
                    break;
                case 'references':
                    control = new RV.ReferencesView(controlOptions).render();
                    break;
                default:
                    // unknown control, do nothing or throw error?
                    break;
            }
            return control;
        };
        WebControls.prototype.option = /**
        * Get or set an option. May set multiple settings by passing in an object.
        * @param nameOrObject
        * This can either be a string of a property name or an object with multiple properties and values
        * @param {String} [value]
        * The value of the single property to set
        * @return {String} If only a property name was set as nameOrObject the value of that property will be returned
        */
        function (nameOrObject, value) {
            if(typeof nameOrObject === 'string') {
                if(typeof value !== 'undefined') {
                    this.settings[nameOrObject] = value;
                    if(nameOrObject === 'authorizationKey') {
                        this.settings._dirtyAuth = true;
                    }
                    this._tcEvents.trigger('settings:' + nameOrObject, value);
                } else {
                    return (this.settings[nameOrObject]) ? this.settings[nameOrObject] : null;
                }
            } else {
                $.extend(this.settings, nameOrObject);
            }
        };
        WebControls.prototype.noConflict = /**
        * Restore the original global TC object and return the instance
        */
        function () {
            cfg.global[cfg.ns] = userCfg;
            return this;
        };
        WebControls.prototype.destroy = /**
        * Restore the global TC object to its un-initialized state. Use this with caution.
        */
        function () {
            cfg.global[cfg.ns] = null;
            $(cfg.global).removeProp(cfg.ns);
            cfg.global[cfg.ns] = TCPublic;
        };
        return WebControls;
    })();
    exports.WebControls = WebControls;    
    var TC = (function () {
        function TC() { }
        TC.current = function current() {
            if(typeof cfg.global[cfg.ns] === 'undefined') {
                throw new Error('Not yet initialized.');
            }
            return cfg.global[cfg.ns];
        };
        return TC;
    })();
    exports.TC = TC;    
    var TCPublic = (function () {
        function TCPublic() { }
        TCPublic.version = '3.1.0.363';
        TCPublic.init = function (options) {
            cfg.global[cfg.ns] = new WebControls(options);
            return cfg.global[cfg.ns];
        };
        return TCPublic;
    })();
    exports.TCPublic = TCPublic;    
    // Expose singleton constructor to global namespace
    // backup existing global configuration options, if any
    var userCfg = cfg.global[cfg.ns];
    $(cfg.global).removeProp(cfg.ns)// safely remove object from window in oldIE
    ;
    if(userCfg) {
        cfg.global[cfg.ns] = new WebControls(userCfg);
        // ready
        if(typeof userCfg.ready === 'function') {
            userCfg.ready(cfg.global[cfg.ns], $);
        }
    } else {
        // only use this version if the subscriber is /certain/ that TCPublic is in the global before the call to init()
        cfg.global[cfg.ns] = TCPublic;
    }
})
;
define('main-api-only',["require", "exports", "lib/api"], function (require, exports, api) {
        
});
require(["main-api-only"]);
}());