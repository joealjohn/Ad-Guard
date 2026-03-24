(() => {
    // This bit intercepts the show() method of the ytp-skip-ad-button element and calls the onAdUxClicked() method of the api object. This quickly skips the preroll text ads.
    const hooked = new WeakSet();

    function hookClass(cls) {
        if (!cls?.prototype?.show || hooked.has(cls)) return;

        let str;
        try {
            str = cls.toString();
        } catch (e) {
            return;
        }

        hooked.add(cls);

        const origInit = cls.prototype.init;
        if (origInit) {
            cls.prototype.init = function () {
                const result = origInit.apply(this, arguments);

                try {
                    if (this.element?.classList?.contains('ytp-skip-ad-button') && this.api?.onAdUxClicked) {
                        this.api.onAdUxClicked(this.componentType, this.layoutId);
                    } else if (this.element?.classList?.contains('ytp-skip-ad') && this.Y?.api?.onAdUxClicked) {
                        this.Y.api.onAdUxClicked(this.Y.componentType, this.Y.layoutId);
                    }
                } catch (e) { }

                return result;
            };
        }

        const origShow = cls.prototype.show;
        cls.prototype.show = function () {
            try {
                if (this.element?.classList?.contains('ytp-skip-ad-button') && this.api?.onAdUxClicked) {
                    this.api.onAdUxClicked(this.componentType, this.layoutId);
                } else if (this.element?.classList?.contains('ytp-skip-ad') && this.Y?.api?.onAdUxClicked) {
                    this.Y.api.onAdUxClicked(this.Y.componentType, this.Y.layoutId);
                }
            } catch (e) { }

            return origShow.apply(this, arguments);
        };
    }

    function deepHook(obj, depth = 0, seen = new WeakSet()) {
        if (depth > 4 || !obj || typeof obj !== 'object') return;
        if (seen.has(obj)) return;
        try { seen.add(obj); } catch (e) { return; }

        let keys;
        try {
            keys = Object.getOwnPropertyNames(obj);
        } catch (e) {
            return;
        }

        for (const key of keys) {
            if (key === 'OH' || key === 'window' || key === 'self' || key === 'top' || key === 'parent' || key === 'frames' || key === 'document') continue;

            try {
                const desc = Object.getOwnPropertyDescriptor(obj, key);
                // Only access if it's a simple value property, not a getter
                if (!desc || !('value' in desc)) continue;

                const val = desc.value;
                if (typeof val === 'function' && val.prototype?.show && val.prototype?.hide && val.prototype?.clear && val.prototype?.init) {
                    hookClass(val);
                }
                if (typeof val === 'object' && val !== null) {
                    deepHook(val, depth + 1, seen);
                }
            } catch (e) { }
        }
    }


    const interval = setInterval(() => {
        if (typeof _yt_player === 'undefined') return;

        deepHook(_yt_player);
        if (_yt_player.g) deepHook(_yt_player.g);

        clearInterval(interval);
    }, 50);


    try {
        // ========= AdShield feature flags (easy bisect) =========
        // Toggle these booleans to isolate what breaks SPA navigation.
        // After changing, reload the extension + hard refresh YouTube.
        window.__ADSHIELD_FLAGS = window.__ADSHIELD_FLAGS || {
            debug: true,
            // TEMP (bisect): disable nav timing instrumentation
            navTracker: false,
            blockUnload: true,
            bypassVideoOnError: true,
            // Re-enabled: this did not fix SPA loading by itself.
            blockDetectionPostMessage: true,
            interceptYtConfig: true,
            // Network interception toggles
            netProxies: true,
            // TEMP (bisect): disable only XHR proxy hooks
            xhrProxy: false,
            fetchProxy: true
        };

        // Back-compat: if older flags exist, derive per-hook toggles from netProxies
        if (typeof window.__ADSHIELD_FLAGS.xhrProxy !== 'boolean') {
            window.__ADSHIELD_FLAGS.xhrProxy = window.__ADSHIELD_FLAGS.netProxies === true;
        }
        if (typeof window.__ADSHIELD_FLAGS.fetchProxy !== 'boolean') {
            window.__ADSHIELD_FLAGS.fetchProxy = window.__ADSHIELD_FLAGS.netProxies === true;
        }

        // Keep existing debug wiring working
        window.__ADSHIELD_DEBUG = window.__ADSHIELD_FLAGS.debug;

        // ========== DEBUG: Navigation timing tracker ==========
        (function () {
            if (window.__ADSHIELD_FLAGS.navTracker !== true) return;
            let lastNavTime = 0;
            let navCount = 0;

            // Track YouTube SPA navigation events
            const trackNav = (type) => {
                const now = performance.now();
                const elapsed = lastNavTime ? (now - lastNavTime).toFixed(0) : 0;
                navCount++;
                console.log(`[AdShield NAV #${navCount}] ${type} - ${elapsed}ms since last nav - URL: ${location.href.substring(0, 80)}`);
                lastNavTime = now;
            };

            // Monitor popstate (back/forward)
            window.addEventListener('popstate', () => trackNav('popstate'));

            // Monitor yt-navigate events (YouTube SPA)
            var navTimerActive = false;
            document.addEventListener('yt-navigate-start', () => {
                if (navTimerActive) {
                    console.timeEnd('[AdShield] Navigation'); // End previous timer first
                }
                console.time('[AdShield] Navigation');
                navTimerActive = true;
                trackNav('yt-navigate-start');
            });
            document.addEventListener('yt-navigate-finish', () => {
                if (navTimerActive) {
                    console.timeEnd('[AdShield] Navigation');
                    navTimerActive = false;
                }
                trackNav('yt-navigate-finish');
            });

            // Monitor page-data events
            document.addEventListener('yt-page-data-fetched', () => trackNav('yt-page-data-fetched'));
            document.addEventListener('yt-page-data-updated', () => trackNav('yt-page-data-updated'));

            console.log('[AdShield] Navigation tracker installed');
        })();
        // ========== END DEBUG ==========

        // Bypass Permissions-Policy: unload restriction
        // Intercept addEventListener to silently block 'unload' and 'beforeunload' events
        // that cause "Permissions policy violation: unload is not allowed" errors
        (function () {
            if (window.__ADSHIELD_FLAGS.blockUnload !== true) return;
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            const originalWindowAddEventListener = window.addEventListener;

            const blockedEvents = ['unload', 'beforeunload'];

            EventTarget.prototype.addEventListener = function (type, listener, options) {
                if (blockedEvents.includes(type)) {
                    // Silently ignore unload/beforeunload events to prevent policy violation
                    return;
                }
                return originalAddEventListener.call(this, type, listener, options);
            };

            // Also handle window.onunload and window.onbeforeunload property assignments
            try {
                Object.defineProperty(window, 'onunload', {
                    get: function () { return null; },
                    set: function () { /* silently ignore */ },
                    configurable: true
                });
                Object.defineProperty(window, 'onbeforeunload', {
                    get: function () { return null; },
                    set: function () { /* silently ignore */ },
                    configurable: true
                });
            } catch (e) { /* ignore if already defined */ }
        })();

        // Store original fetch and XHR for fallback when proxies fail
        const _originalFetch = window.fetch;
        const _originalXHROpen = XMLHttpRequest.prototype.open;
        const _originalXHRSend = XMLHttpRequest.prototype.send;

        // Safe Reflect.apply wrapper that handles ERR_BLOCKED_BY_CLIENT errors
        const safeReflectApply = (target, thisArg, args, fallbackFn) => {
            try {
                return Reflect.apply(target, thisArg, args);
            } catch (e) {
                // If blocked by client (ad blocker conflict), try original method
                if (e.message && (e.message.includes('BLOCKED') || e.message.includes('Failed to fetch'))) {
                    console.warn('[AdShield] Request blocked, using fallback');
                    if (fallbackFn) return fallbackFn();
                }
                throw e;
            }
        };

        // Make it globally available for the proxy handlers
        window.__safeReflectApply = safeReflectApply;
        window.__originalFetch = _originalFetch;
        window.__originalXHROpen = _originalXHROpen;
        window.__originalXHRSend = _originalXHRSend;

        // Bypass YouTube's error reporting and detection
        (function () {
            if (window.__ADSHIELD_FLAGS.bypassVideoOnError !== true) return;
            // Prevent YouTube from detecting playback issues via onerror
            try {
                Object.defineProperty(HTMLVideoElement.prototype, 'onerror', {
                    get: function () { return null; },
                    set: function () { /* silently ignore */ },
                    configurable: true
                });
            } catch (e) { }
        })();

        // CRITICAL: Bypass YouTube's isTrusted detection
        // Instead of modifying Event (which breaks the page), we intercept the detection itself
        (function () {
            // Intercept Object.defineProperty to prevent YouTube from setting up detection
            const originalDefineProperty = Object.defineProperty;
            Object.defineProperty = function (obj, prop, descriptor) {
                // Allow our own defineProperty calls
                return originalDefineProperty.call(this, obj, prop, descriptor);
            };

            // DEBUG FLAG - set to true to see timing logs
            const _dbg = (msg, ...args) => window.__ADSHIELD_DEBUG && console.log(`[AdShield] ${msg}`, ...args);
            window.__adshieldDebug = _dbg;

            // Store reference to detect and block abnormality reporting
            const originalPostMessage = window.postMessage;
            window.postMessage = function (message, targetOrigin, transfer) {
                if (window.__ADSHIELD_FLAGS.blockDetectionPostMessage !== true) {
                    return originalPostMessage.call(this, message, targetOrigin, transfer);
                }
                // Block messages related to ad detection
                if (message && typeof message === 'object') {
                    if (message.type === 'biscottiBasedDetection' ||
                        message.detected === true ||
                        (message.source && message.source.includes && message.source.includes('detection'))) {
                        _dbg('BLOCKED postMessage:', message.type || 'detection');
                        return; // Block the message
                    }
                }
                return originalPostMessage.call(this, message, targetOrigin, transfer);
            };
        })();

        // Intercept YouTube's detection tracking function
        (function () {
            if (window.__ADSHIELD_FLAGS.interceptYtConfig !== true) return;
            // YouTube uses a global object to track detection state
            // We intercept property access to always return "not detected"
            let ytConfigIntercepted = false;
            let _ytValue = window.yt;

            const interceptYtConfig = () => {
                if (ytConfigIntercepted) return;
                if (_ytValue && _ytValue.config_) {
                    ytConfigIntercepted = true;
                    const originalConfig = _ytValue.config_;
                    window.__adshieldDebug && window.__adshieldDebug('yt.config_ intercepted');

                    // Intercept reads to detection-related properties
                    const handler = {
                        get(target, prop) {
                            // Always report as not detected
                            if (prop === 'ISDSTAT' || prop === 'ASDSTAT' || prop === 'CATSTAT') {
                                window.__adshieldDebug && window.__adshieldDebug('yt.config_ GET blocked:', prop);
                                return 1; // 1 = trusted/not detected
                            }
                            return target[prop];
                        },
                        set(target, prop, value) {
                            // Block setting detection states to "detected"
                            if ((prop === 'ISDSTAT' || prop === 'ASDSTAT') && value === 0) {
                                window.__adshieldDebug && window.__adshieldDebug('yt.config_ SET blocked:', prop, value);
                                return true; // Pretend we set it but don't
                            }
                            target[prop] = value;
                            return true;
                        }
                    };

                    try {
                        _ytValue.config_ = new Proxy(originalConfig, handler);
                    } catch (e) { }
                }
            };

            // Try to intercept immediately and also after a delay
            interceptYtConfig();
            setTimeout(interceptYtConfig, 100);
            setTimeout(interceptYtConfig, 500);
            setTimeout(interceptYtConfig, 1000);

            // Also intercept the global yt object creation
            try {
                Object.defineProperty(window, 'yt', {
                    get() {
                        return _ytValue;
                    },
                    set(val) {
                        _ytValue = val;
                        ytConfigIntercepted = false; // Reset so we can intercept the new config
                        setTimeout(interceptYtConfig, 0);
                    },
                    configurable: true
                });
            } catch (e) { }
        })();

        (function setConstant(source, args) {
            const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId && "done" === Window.prototype.toString[uniqueIdentifier])
                return;
            function noopFunc() { }
            function noopCallbackFunc() {
                return noopFunc
            }
            function trueFunc() {
                return !0
            }
            function falseFunc() {
                return !1
            }
            function throwFunc() {
                throw new Error
            }
            function noopPromiseReject() {
                return Promise.reject()
            }
            function noopPromiseResolve() {
                var responseUrl = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : ""
                    , responseType = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "basic";
                if ("undefined" != typeof Response) {
                    var response = new Response(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "{}", {
                        status: 200,
                        statusText: "OK"
                    });
                    return "opaque" === responseType ? Object.defineProperties(response, {
                        body: {
                            value: null
                        },
                        status: {
                            value: 0
                        },
                        ok: {
                            value: !1
                        },
                        statusText: {
                            value: ""
                        },
                        url: {
                            value: ""
                        },
                        type: {
                            value: responseType
                        }
                    }) : Object.defineProperties(response, {
                        url: {
                            value: responseUrl
                        },
                        type: {
                            value: responseType
                        }
                    }),
                        Promise.resolve(response)
                }
            }
            function getPropertyInChain(base, chain) {
                var pos = chain.indexOf(".");
                if (-1 === pos)
                    return {
                        base: base,
                        prop: chain
                    };
                var prop = chain.slice(0, pos);
                if (null === base)
                    return {
                        base: base,
                        prop: prop,
                        chain: chain
                    };
                var nextBase = base[prop];
                return chain = chain.slice(pos + 1),
                    (base instanceof Object || "object" == typeof base) && isEmptyObject(base) || null === nextBase ? {
                        base: base,
                        prop: prop,
                        chain: chain
                    } : void 0 !== nextBase ? getPropertyInChain(nextBase, chain) : (Object.defineProperty(base, prop, {
                        configurable: !0
                    }),
                    {
                        base: base,
                        prop: prop,
                        chain: chain
                    })
            }
            function nativeIsNaN(num) {
                return (Number.isNaN || window.isNaN)(num)
            }
            function isEmptyObject(obj) {
                return 0 === Object.keys(obj).length && !obj.prototype
            }
            function toRegExp(rawInput) {
                var input = rawInput || "";
                if ("" === input)
                    return new RegExp(".?");
                var regExpStr, flagsStr, delimiterIndex = input.lastIndexOf("/"), flagsPart = input.substring(delimiterIndex + 1), regExpPart = input.substring(0, delimiterIndex + 1), flags = (flagsStr = flagsPart,
                    (regExpStr = regExpPart).startsWith("/") && regExpStr.endsWith("/") && !regExpStr.endsWith("\\/") && function (flag) {
                        if (!flag)
                            return !1;
                        try {
                            return new RegExp("", flag),
                                !0
                        } catch (ex) {
                            return !1
                        }
                    }(flagsStr) ? flagsStr : "");
                if (input.startsWith("/") && input.endsWith("/") || flags)
                    return new RegExp((flags ? regExpPart : input).slice(1, -1), flags);
                var escaped = input.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(escaped)
            }
            function restoreRegExpValues(array) {
                if (array.length)
                    try {
                        var stringPattern = "";
                        stringPattern = 1 === array.length ? `(${array[0]})` : array.reduce((function (accumulator, currentValue, currentIndex) {
                            return 1 === currentIndex ? `(${accumulator}),(${currentValue})` : `${accumulator},(${currentValue})`
                        }
                        ));
                        var regExpGroup = new RegExp(stringPattern);
                        array.toString().replace(regExpGroup, "")
                    } catch (error) {
                        var message = `Failed to restore RegExp values: ${error}`;
                        console.log(message)
                    }
            }
            const updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                (function (source, property, value) {
                    var parsedDelay, stack = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : "", valueWrapper = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : "", setProxyTrap = arguments.length > 5 && void 0 !== arguments[5] && arguments[5];
                    if (["set-constant.js", "ubo-set-constant.js", "set.js", "ubo-set.js", "ubo-set-constant", "ubo-set"].includes(source.name) && (1 !== stack.length && (nativeIsNaN(parsedDelay = parseInt(stack, 10)) || !parsedDelay) && (valueWrapper = stack),
                        stack = void 0),
                        property && function (stackMatch, stackTrace) {
                            if (!stackMatch || "" === stackMatch)
                                return !0;
                            var regExpValues = function () {
                                try {
                                    for (var arrayOfRegexpValues = [], index = 1; index < 10; index += 1) {
                                        var value = `$${index}`;
                                        if (!RegExp[value])
                                            break;
                                        arrayOfRegexpValues.push(RegExp[value])
                                    }
                                    return arrayOfRegexpValues
                                } catch (error) {
                                    return []
                                }
                            }();
                            if (function (stackMatch, stackTrace) {
                                var INLINE_SCRIPT_STRING = "inlineScript"
                                    , INJECTED_SCRIPT_STRING = "injectedScript"
                                    , INJECTED_SCRIPT_MARKER = "<anonymous>"
                                    , isInlineScript = function (match) {
                                        return match.includes(INLINE_SCRIPT_STRING)
                                    }
                                    , isInjectedScript = function (match) {
                                        return match.includes(INJECTED_SCRIPT_STRING)
                                    };
                                if (!isInlineScript(stackMatch) && !isInjectedScript(stackMatch))
                                    return !1;
                                var documentURL = window.location.href
                                    , pos = documentURL.indexOf("#");
                                -1 !== pos && (documentURL = documentURL.slice(0, pos));
                                var stackLines = stackTrace.split("\n").slice(2).map((function (line) {
                                    return line.trim()
                                }
                                )).map((function (line) {
                                    var stack, getStackTraceValues = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(line);
                                    if (getStackTraceValues) {
                                        var _stackURL, _stackURL2, stackURL = getStackTraceValues[2], stackLine = getStackTraceValues[3], stackCol = getStackTraceValues[4];
                                        if (null !== (_stackURL = stackURL) && void 0 !== _stackURL && _stackURL.startsWith("(") && (stackURL = stackURL.slice(1)),
                                            null !== (_stackURL2 = stackURL) && void 0 !== _stackURL2 && _stackURL2.startsWith(INJECTED_SCRIPT_MARKER)) {
                                            var _stackFunction;
                                            stackURL = INJECTED_SCRIPT_STRING;
                                            var stackFunction = void 0 !== getStackTraceValues[1] ? getStackTraceValues[1].slice(0, -1) : line.slice(0, getStackTraceValues.index).trim();
                                            null !== (_stackFunction = stackFunction) && void 0 !== _stackFunction && _stackFunction.startsWith("at") && (stackFunction = stackFunction.slice(2).trim()),
                                                stack = `${stackFunction} ${stackURL}${stackLine}${stackCol}`.trim()
                                        } else
                                            stack = stackURL === documentURL ? `${INLINE_SCRIPT_STRING}${stackLine}${stackCol}`.trim() : `${stackURL}${stackLine}${stackCol}`.trim()
                                    } else
                                        stack = line;
                                    return stack
                                }
                                ));
                                if (stackLines)
                                    for (var index = 0; index < stackLines.length; index += 1) {
                                        if (isInlineScript(stackMatch) && stackLines[index].startsWith(INLINE_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                            return !0;
                                        if (isInjectedScript(stackMatch) && stackLines[index].startsWith(INJECTED_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                            return !0
                                    }
                                return !1
                            }(stackMatch, stackTrace))
                                return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                    !0;
                            var stackRegexp = toRegExp(stackMatch)
                                , refinedStackTrace = stackTrace.split("\n").slice(2).map((function (line) {
                                    return line.trim()
                                }
                                )).join("\n");
                            return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                function () {
                                    var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, "test")
                                        , nativeRegexTest = null == descriptor ? void 0 : descriptor.value;
                                    if (descriptor && "function" == typeof descriptor.value)
                                        return nativeRegexTest;
                                    throw new Error("RegExp.prototype.test is not a function")
                                }().call(stackRegexp, refinedStackTrace)
                        }(stack, (new Error).stack)) {
                        var constantValue, isProxyTrapSet = !1;
                        if ("undefined" === value)
                            constantValue = void 0;
                        else if ("false" === value)
                            constantValue = !1;
                        else if ("true" === value)
                            constantValue = !0;
                        else if ("null" === value)
                            constantValue = null;
                        else if ("emptyArr" === value)
                            constantValue = [];
                        else if ("emptyObj" === value)
                            constantValue = {};
                        else if ("noopFunc" === value)
                            constantValue = noopFunc;
                        else if ("noopCallbackFunc" === value)
                            constantValue = noopCallbackFunc;
                        else if ("trueFunc" === value)
                            constantValue = trueFunc;
                        else if ("falseFunc" === value)
                            constantValue = falseFunc;
                        else if ("throwFunc" === value)
                            constantValue = throwFunc;
                        else if ("noopPromiseResolve" === value)
                            constantValue = noopPromiseResolve;
                        else if ("noopPromiseReject" === value)
                            constantValue = noopPromiseReject;
                        else if (/^\d+$/.test(value)) {
                            if (nativeIsNaN(constantValue = parseFloat(value)))
                                return;
                            if (Math.abs(constantValue) > 32767)
                                return
                        } else if ("-1" === value)
                            constantValue = -1;
                        else if ("" === value)
                            constantValue = "";
                        else if ("yes" === value)
                            constantValue = "yes";
                        else {
                            if ("no" !== value)
                                return;
                            constantValue = "no"
                        }
                        ["asFunction", "asCallback", "asResolved", "asRejected"].includes(valueWrapper) && (constantValue = {
                            asFunction: v => function () {
                                return v
                            }
                            ,
                            asCallback: v => function () {
                                return function () {
                                    return v
                                }
                            }
                            ,
                            asResolved: v => Promise.resolve(v),
                            asRejected: v => Promise.reject(v)
                        }[valueWrapper](constantValue));
                        var canceled = !1
                            , mustCancel = function (value) {
                                return canceled || (canceled = void 0 !== value && void 0 !== constantValue && typeof value != typeof constantValue && null !== value)
                            }
                            , trapProp = function (base, prop, configurable, handler) {
                                if (!handler.init(base[prop]))
                                    return !1;
                                var prevSetter, origDescriptor = Object.getOwnPropertyDescriptor(base, prop);
                                if (origDescriptor instanceof Object) {
                                    if (!origDescriptor.configurable)
                                        return function (source, message) {
                                            var forced = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                                                , convertMessageToString = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
                                                , { name: name, verbose: verbose } = source;
                                            if (forced || verbose) {
                                                var nativeConsole = console.log;
                                                convertMessageToString ? nativeConsole(`${name}: ${message}`) : nativeConsole(`${name}:`, message)
                                            }
                                        }(source, `Property '${prop}' is not configurable`),
                                            !1;
                                    base[prop] && (base[prop] = constantValue),
                                        origDescriptor.set instanceof Function && (prevSetter = origDescriptor.set)
                                }
                                return Object.defineProperty(base, prop, {
                                    configurable: configurable,
                                    get: () => handler.get(),
                                    set(a) {
                                        if (void 0 !== prevSetter && prevSetter(a),
                                            a instanceof Object) {
                                            var propertiesToCheck = property.split(".").slice(1);
                                            setProxyTrap && !isProxyTrapSet && (isProxyTrapSet = !0,
                                                a = new Proxy(a, {
                                                    get: function (target, propertyKey, val) {
                                                        return propertiesToCheck.reduce((function (object, currentProp, index, array) {
                                                            var currentObj = null == object ? void 0 : object[currentProp];
                                                            return index === array.length - 1 && currentObj !== constantValue && (object[currentProp] = constantValue),
                                                                currentObj || object
                                                        }
                                                        ), target),
                                                            Reflect.get(target, propertyKey, val)
                                                    }
                                                }))
                                        }
                                        handler.set(a)
                                    }
                                }),
                                    !0
                            }
                            , _setChainPropAccess = function (owner, property) {
                                var chainInfo = getPropertyInChain(owner, property)
                                    , { base: base } = chainInfo
                                    , { prop: prop, chain: chain } = chainInfo
                                    , inChainPropHandler = {
                                        factValue: void 0,
                                        init(a) {
                                            return this.factValue = a,
                                                !0
                                        },
                                        get() {
                                            return this.factValue
                                        },
                                        set(a) {
                                            this.factValue !== a && (this.factValue = a,
                                                a instanceof Object && _setChainPropAccess(a, chain))
                                        }
                                    }
                                    , endPropHandler = {
                                        init: a => !mustCancel(a),
                                        get: () => constantValue,
                                        set(a) {
                                            mustCancel(a) && (constantValue = a)
                                        }
                                    };
                                if (chain)
                                    if (void 0 === base || null !== base[prop]) {
                                        (base instanceof Object || "object" == typeof base) && isEmptyObject(base) && trapProp(base, prop, !0, inChainPropHandler);
                                        var propValue = owner[prop];
                                        (propValue instanceof Object || "object" == typeof propValue && null !== propValue) && _setChainPropAccess(propValue, chain),
                                            trapProp(base, prop, !0, inChainPropHandler)
                                    } else
                                        trapProp(base, prop, !0, inChainPropHandler);
                                else
                                    trapProp(base, prop, !1, endPropHandler) && function (source) {
                                        var ABY_PREFIX = "[ABY]";
                                        if (source.verbose) {
                                            try {
                                                var trace = console.trace.bind(console)
                                                    , label = `${ABY_PREFIX} `;
                                                "corelibs" === source.engine ? label += source.ruleText : (source.domainName && (label += `${source.domainName}`),
                                                    source.args ? label += `#%#//scriptlet('${source.name}', '${source.args.join("', '")}')` : label += `#%#//scriptlet('${source.name}')`),
                                                    trace && trace(label)
                                            } catch (e) { }
                                            "function" == typeof window.__debug && window.__debug(source)
                                        }
                                    }(source)
                            };
                        _setChainPropAccess(window, property)
                    }
                }
                ).apply(this, updatedArgs),
                    source.uniqueId && Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: "done",
                        enumerable: !1,
                        writable: !1,
                        configurable: !1
                    })
            } catch (e) {
                console.log(e)
            }
        }
        )({
            "name": "set-constant",
            "args": ["ytInitialPlayerResponse.adPlacements", "undefined"]
        }, ["ytInitialPlayerResponse.adPlacements", "undefined"]);
        ; (function setConstant(source, args) {
            const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId && "done" === Window.prototype.toString[uniqueIdentifier])
                return;
            function noopFunc() { }
            function noopCallbackFunc() {
                return noopFunc
            }
            function trueFunc() {
                return !0
            }
            function falseFunc() {
                return !1
            }
            function throwFunc() {
                throw new Error
            }
            function noopPromiseReject() {
                return Promise.reject()
            }
            function noopPromiseResolve() {
                var responseUrl = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : ""
                    , responseType = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "basic";
                if ("undefined" != typeof Response) {
                    var response = new Response(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "{}", {
                        status: 200,
                        statusText: "OK"
                    });
                    return "opaque" === responseType ? Object.defineProperties(response, {
                        body: {
                            value: null
                        },
                        status: {
                            value: 0
                        },
                        ok: {
                            value: !1
                        },
                        statusText: {
                            value: ""
                        },
                        url: {
                            value: ""
                        },
                        type: {
                            value: responseType
                        }
                    }) : Object.defineProperties(response, {
                        url: {
                            value: responseUrl
                        },
                        type: {
                            value: responseType
                        }
                    }),
                        Promise.resolve(response)
                }
            }
            function getPropertyInChain(base, chain) {
                var pos = chain.indexOf(".");
                if (-1 === pos)
                    return {
                        base: base,
                        prop: chain
                    };
                var prop = chain.slice(0, pos);
                if (null === base)
                    return {
                        base: base,
                        prop: prop,
                        chain: chain
                    };
                var nextBase = base[prop];
                return chain = chain.slice(pos + 1),
                    (base instanceof Object || "object" == typeof base) && isEmptyObject(base) || null === nextBase ? {
                        base: base,
                        prop: prop,
                        chain: chain
                    } : void 0 !== nextBase ? getPropertyInChain(nextBase, chain) : (Object.defineProperty(base, prop, {
                        configurable: !0
                    }),
                    {
                        base: base,
                        prop: prop,
                        chain: chain
                    })
            }
            function nativeIsNaN(num) {
                return (Number.isNaN || window.isNaN)(num)
            }
            function isEmptyObject(obj) {
                return 0 === Object.keys(obj).length && !obj.prototype
            }
            function toRegExp(rawInput) {
                var input = rawInput || "";
                if ("" === input)
                    return new RegExp(".?");
                var regExpStr, flagsStr, delimiterIndex = input.lastIndexOf("/"), flagsPart = input.substring(delimiterIndex + 1), regExpPart = input.substring(0, delimiterIndex + 1), flags = (flagsStr = flagsPart,
                    (regExpStr = regExpPart).startsWith("/") && regExpStr.endsWith("/") && !regExpStr.endsWith("\\/") && function (flag) {
                        if (!flag)
                            return !1;
                        try {
                            return new RegExp("", flag),
                                !0
                        } catch (ex) {
                            return !1
                        }
                    }(flagsStr) ? flagsStr : "");
                if (input.startsWith("/") && input.endsWith("/") || flags)
                    return new RegExp((flags ? regExpPart : input).slice(1, -1), flags);
                var escaped = input.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(escaped)
            }
            function restoreRegExpValues(array) {
                if (array.length)
                    try {
                        var stringPattern = "";
                        stringPattern = 1 === array.length ? `(${array[0]})` : array.reduce((function (accumulator, currentValue, currentIndex) {
                            return 1 === currentIndex ? `(${accumulator}),(${currentValue})` : `${accumulator},(${currentValue})`
                        }
                        ));
                        var regExpGroup = new RegExp(stringPattern);
                        array.toString().replace(regExpGroup, "")
                    } catch (error) {
                        var message = `Failed to restore RegExp values: ${error}`;
                        console.log(message)
                    }
            }
            const updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                (function (source, property, value) {
                    var parsedDelay, stack = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : "", valueWrapper = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : "", setProxyTrap = arguments.length > 5 && void 0 !== arguments[5] && arguments[5];
                    if (["set-constant.js", "ubo-set-constant.js", "set.js", "ubo-set.js", "ubo-set-constant", "ubo-set"].includes(source.name) && (1 !== stack.length && (nativeIsNaN(parsedDelay = parseInt(stack, 10)) || !parsedDelay) && (valueWrapper = stack),
                        stack = void 0),
                        property && function (stackMatch, stackTrace) {
                            if (!stackMatch || "" === stackMatch)
                                return !0;
                            var regExpValues = function () {
                                try {
                                    for (var arrayOfRegexpValues = [], index = 1; index < 10; index += 1) {
                                        var value = `$${index}`;
                                        if (!RegExp[value])
                                            break;
                                        arrayOfRegexpValues.push(RegExp[value])
                                    }
                                    return arrayOfRegexpValues
                                } catch (error) {
                                    return []
                                }
                            }();
                            if (function (stackMatch, stackTrace) {
                                var INLINE_SCRIPT_STRING = "inlineScript"
                                    , INJECTED_SCRIPT_STRING = "injectedScript"
                                    , INJECTED_SCRIPT_MARKER = "<anonymous>"
                                    , isInlineScript = function (match) {
                                        return match.includes(INLINE_SCRIPT_STRING)
                                    }
                                    , isInjectedScript = function (match) {
                                        return match.includes(INJECTED_SCRIPT_STRING)
                                    };
                                if (!isInlineScript(stackMatch) && !isInjectedScript(stackMatch))
                                    return !1;
                                var documentURL = window.location.href
                                    , pos = documentURL.indexOf("#");
                                -1 !== pos && (documentURL = documentURL.slice(0, pos));
                                var stackLines = stackTrace.split("\n").slice(2).map((function (line) {
                                    return line.trim()
                                }
                                )).map((function (line) {
                                    var stack, getStackTraceValues = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(line);
                                    if (getStackTraceValues) {
                                        var _stackURL, _stackURL2, stackURL = getStackTraceValues[2], stackLine = getStackTraceValues[3], stackCol = getStackTraceValues[4];
                                        if (null !== (_stackURL = stackURL) && void 0 !== _stackURL && _stackURL.startsWith("(") && (stackURL = stackURL.slice(1)),
                                            null !== (_stackURL2 = stackURL) && void 0 !== _stackURL2 && _stackURL2.startsWith(INJECTED_SCRIPT_MARKER)) {
                                            var _stackFunction;
                                            stackURL = INJECTED_SCRIPT_STRING;
                                            var stackFunction = void 0 !== getStackTraceValues[1] ? getStackTraceValues[1].slice(0, -1) : line.slice(0, getStackTraceValues.index).trim();
                                            null !== (_stackFunction = stackFunction) && void 0 !== _stackFunction && _stackFunction.startsWith("at") && (stackFunction = stackFunction.slice(2).trim()),
                                                stack = `${stackFunction} ${stackURL}${stackLine}${stackCol}`.trim()
                                        } else
                                            stack = stackURL === documentURL ? `${INLINE_SCRIPT_STRING}${stackLine}${stackCol}`.trim() : `${stackURL}${stackLine}${stackCol}`.trim()
                                    } else
                                        stack = line;
                                    return stack
                                }
                                ));
                                if (stackLines)
                                    for (var index = 0; index < stackLines.length; index += 1) {
                                        if (isInlineScript(stackMatch) && stackLines[index].startsWith(INLINE_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                            return !0;
                                        if (isInjectedScript(stackMatch) && stackLines[index].startsWith(INJECTED_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                            return !0
                                    }
                                return !1
                            }(stackMatch, stackTrace))
                                return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                    !0;
                            var stackRegexp = toRegExp(stackMatch)
                                , refinedStackTrace = stackTrace.split("\n").slice(2).map((function (line) {
                                    return line.trim()
                                }
                                )).join("\n");
                            return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                function () {
                                    var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, "test")
                                        , nativeRegexTest = null == descriptor ? void 0 : descriptor.value;
                                    if (descriptor && "function" == typeof descriptor.value)
                                        return nativeRegexTest;
                                    throw new Error("RegExp.prototype.test is not a function")
                                }().call(stackRegexp, refinedStackTrace)
                        }(stack, (new Error).stack)) {
                        var constantValue, isProxyTrapSet = !1;
                        if ("undefined" === value)
                            constantValue = void 0;
                        else if ("false" === value)
                            constantValue = !1;
                        else if ("true" === value)
                            constantValue = !0;
                        else if ("null" === value)
                            constantValue = null;
                        else if ("emptyArr" === value)
                            constantValue = [];
                        else if ("emptyObj" === value)
                            constantValue = {};
                        else if ("noopFunc" === value)
                            constantValue = noopFunc;
                        else if ("noopCallbackFunc" === value)
                            constantValue = noopCallbackFunc;
                        else if ("trueFunc" === value)
                            constantValue = trueFunc;
                        else if ("falseFunc" === value)
                            constantValue = falseFunc;
                        else if ("throwFunc" === value)
                            constantValue = throwFunc;
                        else if ("noopPromiseResolve" === value)
                            constantValue = noopPromiseResolve;
                        else if ("noopPromiseReject" === value)
                            constantValue = noopPromiseReject;
                        else if (/^\d+$/.test(value)) {
                            if (nativeIsNaN(constantValue = parseFloat(value)))
                                return;
                            if (Math.abs(constantValue) > 32767)
                                return
                        } else if ("-1" === value)
                            constantValue = -1;
                        else if ("" === value)
                            constantValue = "";
                        else if ("yes" === value)
                            constantValue = "yes";
                        else {
                            if ("no" !== value)
                                return;
                            constantValue = "no"
                        }
                        ["asFunction", "asCallback", "asResolved", "asRejected"].includes(valueWrapper) && (constantValue = {
                            asFunction: v => function () {
                                return v
                            }
                            ,
                            asCallback: v => function () {
                                return function () {
                                    return v
                                }
                            }
                            ,
                            asResolved: v => Promise.resolve(v),
                            asRejected: v => Promise.reject(v)
                        }[valueWrapper](constantValue));
                        var canceled = !1
                            , mustCancel = function (value) {
                                return canceled || (canceled = void 0 !== value && void 0 !== constantValue && typeof value != typeof constantValue && null !== value)
                            }
                            , trapProp = function (base, prop, configurable, handler) {
                                if (!handler.init(base[prop]))
                                    return !1;
                                var prevSetter, origDescriptor = Object.getOwnPropertyDescriptor(base, prop);
                                if (origDescriptor instanceof Object) {
                                    if (!origDescriptor.configurable)
                                        return function (source, message) {
                                            var forced = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                                                , convertMessageToString = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
                                                , { name: name, verbose: verbose } = source;
                                            if (forced || verbose) {
                                                var nativeConsole = console.log;
                                                convertMessageToString ? nativeConsole(`${name}: ${message}`) : nativeConsole(`${name}:`, message)
                                            }
                                        }(source, `Property '${prop}' is not configurable`),
                                            !1;
                                    base[prop] && (base[prop] = constantValue),
                                        origDescriptor.set instanceof Function && (prevSetter = origDescriptor.set)
                                }
                                return Object.defineProperty(base, prop, {
                                    configurable: configurable,
                                    get: () => handler.get(),
                                    set(a) {
                                        if (void 0 !== prevSetter && prevSetter(a),
                                            a instanceof Object) {
                                            var propertiesToCheck = property.split(".").slice(1);
                                            setProxyTrap && !isProxyTrapSet && (isProxyTrapSet = !0,
                                                a = new Proxy(a, {
                                                    get: function (target, propertyKey, val) {
                                                        return propertiesToCheck.reduce((function (object, currentProp, index, array) {
                                                            var currentObj = null == object ? void 0 : object[currentProp];
                                                            return index === array.length - 1 && currentObj !== constantValue && (object[currentProp] = constantValue),
                                                                currentObj || object
                                                        }
                                                        ), target),
                                                            Reflect.get(target, propertyKey, val)
                                                    }
                                                }))
                                        }
                                        handler.set(a)
                                    }
                                }),
                                    !0
                            }
                            , _setChainPropAccess = function (owner, property) {
                                var chainInfo = getPropertyInChain(owner, property)
                                    , { base: base } = chainInfo
                                    , { prop: prop, chain: chain } = chainInfo
                                    , inChainPropHandler = {
                                        factValue: void 0,
                                        init(a) {
                                            return this.factValue = a,
                                                !0
                                        },
                                        get() {
                                            return this.factValue
                                        },
                                        set(a) {
                                            this.factValue !== a && (this.factValue = a,
                                                a instanceof Object && _setChainPropAccess(a, chain))
                                        }
                                    }
                                    , endPropHandler = {
                                        init: a => !mustCancel(a),
                                        get: () => constantValue,
                                        set(a) {
                                            mustCancel(a) && (constantValue = a)
                                        }
                                    };
                                if (chain)
                                    if (void 0 === base || null !== base[prop]) {
                                        (base instanceof Object || "object" == typeof base) && isEmptyObject(base) && trapProp(base, prop, !0, inChainPropHandler);
                                        var propValue = owner[prop];
                                        (propValue instanceof Object || "object" == typeof propValue && null !== propValue) && _setChainPropAccess(propValue, chain),
                                            trapProp(base, prop, !0, inChainPropHandler)
                                    } else
                                        trapProp(base, prop, !0, inChainPropHandler);
                                else
                                    trapProp(base, prop, !1, endPropHandler) && function (source) {
                                        var ABY_PREFIX = "[ABY]";
                                        if (source.verbose) {
                                            try {
                                                var trace = console.trace.bind(console)
                                                    , label = `${ABY_PREFIX} `;
                                                "corelibs" === source.engine ? label += source.ruleText : (source.domainName && (label += `${source.domainName}`),
                                                    source.args ? label += `#%#//scriptlet('${source.name}', '${source.args.join("', '")}')` : label += `#%#//scriptlet('${source.name}')`),
                                                    trace && trace(label)
                                            } catch (e) { }
                                            "function" == typeof window.__debug && window.__debug(source)
                                        }
                                    }(source)
                            };
                        _setChainPropAccess(window, property)
                    }
                }
                ).apply(this, updatedArgs),
                    source.uniqueId && Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: "done",
                        enumerable: !1,
                        writable: !1,
                        configurable: !1
                    })
            } catch (e) {
                console.log(e)
            }
        }
        )({
            "name": "set-constant",
            "args": ["ytInitialPlayerResponse.adSlots", "undefined"]
        }, ["ytInitialPlayerResponse.adSlots", "undefined"]);
        ; (function setConstant(source, args) {
            const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId && "done" === Window.prototype.toString[uniqueIdentifier])
                return;
            function noopFunc() { }
            function noopCallbackFunc() {
                return noopFunc
            }
            function trueFunc() {
                return !0
            }
            function falseFunc() {
                return !1
            }
            function throwFunc() {
                throw new Error
            }
            function noopPromiseReject() {
                return Promise.reject()
            }
            function noopPromiseResolve() {
                var responseUrl = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : ""
                    , responseType = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "basic";
                if ("undefined" != typeof Response) {
                    var response = new Response(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "{}", {
                        status: 200,
                        statusText: "OK"
                    });
                    return "opaque" === responseType ? Object.defineProperties(response, {
                        body: {
                            value: null
                        },
                        status: {
                            value: 0
                        },
                        ok: {
                            value: !1
                        },
                        statusText: {
                            value: ""
                        },
                        url: {
                            value: ""
                        },
                        type: {
                            value: responseType
                        }
                    }) : Object.defineProperties(response, {
                        url: {
                            value: responseUrl
                        },
                        type: {
                            value: responseType
                        }
                    }),
                        Promise.resolve(response)
                }
            }
            function getPropertyInChain(base, chain) {
                var pos = chain.indexOf(".");
                if (-1 === pos)
                    return {
                        base: base,
                        prop: chain
                    };
                var prop = chain.slice(0, pos);
                if (null === base)
                    return {
                        base: base,
                        prop: prop,
                        chain: chain
                    };
                var nextBase = base[prop];
                return chain = chain.slice(pos + 1),
                    (base instanceof Object || "object" == typeof base) && isEmptyObject(base) || null === nextBase ? {
                        base: base,
                        prop: prop,
                        chain: chain
                    } : void 0 !== nextBase ? getPropertyInChain(nextBase, chain) : (Object.defineProperty(base, prop, {
                        configurable: !0
                    }),
                    {
                        base: base,
                        prop: prop,
                        chain: chain
                    })
            }
            function nativeIsNaN(num) {
                return (Number.isNaN || window.isNaN)(num)
            }
            function isEmptyObject(obj) {
                return 0 === Object.keys(obj).length && !obj.prototype
            }
            function toRegExp(rawInput) {
                var input = rawInput || "";
                if ("" === input)
                    return new RegExp(".?");
                var regExpStr, flagsStr, delimiterIndex = input.lastIndexOf("/"), flagsPart = input.substring(delimiterIndex + 1), regExpPart = input.substring(0, delimiterIndex + 1), flags = (flagsStr = flagsPart,
                    (regExpStr = regExpPart).startsWith("/") && regExpStr.endsWith("/") && !regExpStr.endsWith("\\/") && function (flag) {
                        if (!flag)
                            return !1;
                        try {
                            return new RegExp("", flag),
                                !0
                        } catch (ex) {
                            return !1
                        }
                    }(flagsStr) ? flagsStr : "");
                if (input.startsWith("/") && input.endsWith("/") || flags)
                    return new RegExp((flags ? regExpPart : input).slice(1, -1), flags);
                var escaped = input.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(escaped)
            }
            function restoreRegExpValues(array) {
                if (array.length)
                    try {
                        var stringPattern = "";
                        stringPattern = 1 === array.length ? `(${array[0]})` : array.reduce((function (accumulator, currentValue, currentIndex) {
                            return 1 === currentIndex ? `(${accumulator}),(${currentValue})` : `${accumulator},(${currentValue})`
                        }
                        ));
                        var regExpGroup = new RegExp(stringPattern);
                        array.toString().replace(regExpGroup, "")
                    } catch (error) {
                        var message = `Failed to restore RegExp values: ${error}`;
                        console.log(message)
                    }
            }
            const updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                (function (source, property, value) {
                    var parsedDelay, stack = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : "", valueWrapper = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : "", setProxyTrap = arguments.length > 5 && void 0 !== arguments[5] && arguments[5];
                    if (["set-constant.js", "ubo-set-constant.js", "set.js", "ubo-set.js", "ubo-set-constant", "ubo-set"].includes(source.name) && (1 !== stack.length && (nativeIsNaN(parsedDelay = parseInt(stack, 10)) || !parsedDelay) && (valueWrapper = stack),
                        stack = void 0),
                        property && function (stackMatch, stackTrace) {
                            if (!stackMatch || "" === stackMatch)
                                return !0;
                            var regExpValues = function () {
                                try {
                                    for (var arrayOfRegexpValues = [], index = 1; index < 10; index += 1) {
                                        var value = `$${index}`;
                                        if (!RegExp[value])
                                            break;
                                        arrayOfRegexpValues.push(RegExp[value])
                                    }
                                    return arrayOfRegexpValues
                                } catch (error) {
                                    return []
                                }
                            }();
                            if (function (stackMatch, stackTrace) {
                                var INLINE_SCRIPT_STRING = "inlineScript"
                                    , INJECTED_SCRIPT_STRING = "injectedScript"
                                    , INJECTED_SCRIPT_MARKER = "<anonymous>"
                                    , isInlineScript = function (match) {
                                        return match.includes(INLINE_SCRIPT_STRING)
                                    }
                                    , isInjectedScript = function (match) {
                                        return match.includes(INJECTED_SCRIPT_STRING)
                                    };
                                if (!isInlineScript(stackMatch) && !isInjectedScript(stackMatch))
                                    return !1;
                                var documentURL = window.location.href
                                    , pos = documentURL.indexOf("#");
                                -1 !== pos && (documentURL = documentURL.slice(0, pos));
                                var stackLines = stackTrace.split("\n").slice(2).map((function (line) {
                                    return line.trim()
                                }
                                )).map((function (line) {
                                    var stack, getStackTraceValues = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(line);
                                    if (getStackTraceValues) {
                                        var _stackURL, _stackURL2, stackURL = getStackTraceValues[2], stackLine = getStackTraceValues[3], stackCol = getStackTraceValues[4];
                                        if (null !== (_stackURL = stackURL) && void 0 !== _stackURL && _stackURL.startsWith("(") && (stackURL = stackURL.slice(1)),
                                            null !== (_stackURL2 = stackURL) && void 0 !== _stackURL2 && _stackURL2.startsWith(INJECTED_SCRIPT_MARKER)) {
                                            var _stackFunction;
                                            stackURL = INJECTED_SCRIPT_STRING;
                                            var stackFunction = void 0 !== getStackTraceValues[1] ? getStackTraceValues[1].slice(0, -1) : line.slice(0, getStackTraceValues.index).trim();
                                            null !== (_stackFunction = stackFunction) && void 0 !== _stackFunction && _stackFunction.startsWith("at") && (stackFunction = stackFunction.slice(2).trim()),
                                                stack = `${stackFunction} ${stackURL}${stackLine}${stackCol}`.trim()
                                        } else
                                            stack = stackURL === documentURL ? `${INLINE_SCRIPT_STRING}${stackLine}${stackCol}`.trim() : `${stackURL}${stackLine}${stackCol}`.trim()
                                    } else
                                        stack = line;
                                    return stack
                                }
                                ));
                                if (stackLines)
                                    for (var index = 0; index < stackLines.length; index += 1) {
                                        if (isInlineScript(stackMatch) && stackLines[index].startsWith(INLINE_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                            return !0;
                                        if (isInjectedScript(stackMatch) && stackLines[index].startsWith(INJECTED_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                            return !0
                                    }
                                return !1
                            }(stackMatch, stackTrace))
                                return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                    !0;
                            var stackRegexp = toRegExp(stackMatch)
                                , refinedStackTrace = stackTrace.split("\n").slice(2).map((function (line) {
                                    return line.trim()
                                }
                                )).join("\n");
                            return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                function () {
                                    var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, "test")
                                        , nativeRegexTest = null == descriptor ? void 0 : descriptor.value;
                                    if (descriptor && "function" == typeof descriptor.value)
                                        return nativeRegexTest;
                                    throw new Error("RegExp.prototype.test is not a function")
                                }().call(stackRegexp, refinedStackTrace)
                        }(stack, (new Error).stack)) {
                        var constantValue, isProxyTrapSet = !1;
                        if ("undefined" === value)
                            constantValue = void 0;
                        else if ("false" === value)
                            constantValue = !1;
                        else if ("true" === value)
                            constantValue = !0;
                        else if ("null" === value)
                            constantValue = null;
                        else if ("emptyArr" === value)
                            constantValue = [];
                        else if ("emptyObj" === value)
                            constantValue = {};
                        else if ("noopFunc" === value)
                            constantValue = noopFunc;
                        else if ("noopCallbackFunc" === value)
                            constantValue = noopCallbackFunc;
                        else if ("trueFunc" === value)
                            constantValue = trueFunc;
                        else if ("falseFunc" === value)
                            constantValue = falseFunc;
                        else if ("throwFunc" === value)
                            constantValue = throwFunc;
                        else if ("noopPromiseResolve" === value)
                            constantValue = noopPromiseResolve;
                        else if ("noopPromiseReject" === value)
                            constantValue = noopPromiseReject;
                        else if (/^\d+$/.test(value)) {
                            if (nativeIsNaN(constantValue = parseFloat(value)))
                                return;
                            if (Math.abs(constantValue) > 32767)
                                return
                        } else if ("-1" === value)
                            constantValue = -1;
                        else if ("" === value)
                            constantValue = "";
                        else if ("yes" === value)
                            constantValue = "yes";
                        else {
                            if ("no" !== value)
                                return;
                            constantValue = "no"
                        }
                        ["asFunction", "asCallback", "asResolved", "asRejected"].includes(valueWrapper) && (constantValue = {
                            asFunction: v => function () {
                                return v
                            }
                            ,
                            asCallback: v => function () {
                                return function () {
                                    return v
                                }
                            }
                            ,
                            asResolved: v => Promise.resolve(v),
                            asRejected: v => Promise.reject(v)
                        }[valueWrapper](constantValue));
                        var canceled = !1
                            , mustCancel = function (value) {
                                return canceled || (canceled = void 0 !== value && void 0 !== constantValue && typeof value != typeof constantValue && null !== value)
                            }
                            , trapProp = function (base, prop, configurable, handler) {
                                if (!handler.init(base[prop]))
                                    return !1;
                                var prevSetter, origDescriptor = Object.getOwnPropertyDescriptor(base, prop);
                                if (origDescriptor instanceof Object) {
                                    if (!origDescriptor.configurable)
                                        return function (source, message) {
                                            var forced = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                                                , convertMessageToString = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
                                                , { name: name, verbose: verbose } = source;
                                            if (forced || verbose) {
                                                var nativeConsole = console.log;
                                                convertMessageToString ? nativeConsole(`${name}: ${message}`) : nativeConsole(`${name}:`, message)
                                            }
                                        }(source, `Property '${prop}' is not configurable`),
                                            !1;
                                    base[prop] && (base[prop] = constantValue),
                                        origDescriptor.set instanceof Function && (prevSetter = origDescriptor.set)
                                }
                                return Object.defineProperty(base, prop, {
                                    configurable: configurable,
                                    get: () => handler.get(),
                                    set(a) {
                                        if (void 0 !== prevSetter && prevSetter(a),
                                            a instanceof Object) {
                                            var propertiesToCheck = property.split(".").slice(1);
                                            setProxyTrap && !isProxyTrapSet && (isProxyTrapSet = !0,
                                                a = new Proxy(a, {
                                                    get: function (target, propertyKey, val) {
                                                        return propertiesToCheck.reduce((function (object, currentProp, index, array) {
                                                            var currentObj = null == object ? void 0 : object[currentProp];
                                                            return index === array.length - 1 && currentObj !== constantValue && (object[currentProp] = constantValue),
                                                                currentObj || object
                                                        }
                                                        ), target),
                                                            Reflect.get(target, propertyKey, val)
                                                    }
                                                }))
                                        }
                                        handler.set(a)
                                    }
                                }),
                                    !0
                            }
                            , _setChainPropAccess = function (owner, property) {
                                var chainInfo = getPropertyInChain(owner, property)
                                    , { base: base } = chainInfo
                                    , { prop: prop, chain: chain } = chainInfo
                                    , inChainPropHandler = {
                                        factValue: void 0,
                                        init(a) {
                                            return this.factValue = a,
                                                !0
                                        },
                                        get() {
                                            return this.factValue
                                        },
                                        set(a) {
                                            this.factValue !== a && (this.factValue = a,
                                                a instanceof Object && _setChainPropAccess(a, chain))
                                        }
                                    }
                                    , endPropHandler = {
                                        init: a => !mustCancel(a),
                                        get: () => constantValue,
                                        set(a) {
                                            mustCancel(a) && (constantValue = a)
                                        }
                                    };
                                if (chain)
                                    if (void 0 === base || null !== base[prop]) {
                                        (base instanceof Object || "object" == typeof base) && isEmptyObject(base) && trapProp(base, prop, !0, inChainPropHandler);
                                        var propValue = owner[prop];
                                        (propValue instanceof Object || "object" == typeof propValue && null !== propValue) && _setChainPropAccess(propValue, chain),
                                            trapProp(base, prop, !0, inChainPropHandler)
                                    } else
                                        trapProp(base, prop, !0, inChainPropHandler);
                                else
                                    trapProp(base, prop, !1, endPropHandler) && function (source) {
                                        var ABY_PREFIX = "[ABY]";
                                        if (source.verbose) {
                                            try {
                                                var trace = console.trace.bind(console)
                                                    , label = `${ABY_PREFIX} `;
                                                "corelibs" === source.engine ? label += source.ruleText : (source.domainName && (label += `${source.domainName}`),
                                                    source.args ? label += `#%#//scriptlet('${source.name}', '${source.args.join("', '")}')` : label += `#%#//scriptlet('${source.name}')`),
                                                    trace && trace(label)
                                            } catch (e) { }
                                            "function" == typeof window.__debug && window.__debug(source)
                                        }
                                    }(source)
                            };
                        _setChainPropAccess(window, property)
                    }
                }
                ).apply(this, updatedArgs),
                    source.uniqueId && Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: "done",
                        enumerable: !1,
                        writable: !1,
                        configurable: !1
                    })
            } catch (e) {
                console.log(e)
            }
        }
        )({
            "name": "set-constant",
            "args": ["ytInitialPlayerResponse.playerAds", "undefined"]
        }, ["ytInitialPlayerResponse.playerAds", "undefined"]);
        ; (function setConstant(source, args) {
            const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId && "done" === Window.prototype.toString[uniqueIdentifier])
                return;
            function noopFunc() { }
            function noopCallbackFunc() {
                return noopFunc
            }
            function trueFunc() {
                return !0
            }
            function falseFunc() {
                return !1
            }
            function throwFunc() {
                throw new Error
            }
            function noopPromiseReject() {
                return Promise.reject()
            }
            function noopPromiseResolve() {
                var responseUrl = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : ""
                    , responseType = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "basic";
                if ("undefined" != typeof Response) {
                    var response = new Response(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "{}", {
                        status: 200,
                        statusText: "OK"
                    });
                    return "opaque" === responseType ? Object.defineProperties(response, {
                        body: {
                            value: null
                        },
                        status: {
                            value: 0
                        },
                        ok: {
                            value: !1
                        },
                        statusText: {
                            value: ""
                        },
                        url: {
                            value: ""
                        },
                        type: {
                            value: responseType
                        }
                    }) : Object.defineProperties(response, {
                        url: {
                            value: responseUrl
                        },
                        type: {
                            value: responseType
                        }
                    }),
                        Promise.resolve(response)
                }
            }
            function getPropertyInChain(base, chain) {
                var pos = chain.indexOf(".");
                if (-1 === pos)
                    return {
                        base: base,
                        prop: chain
                    };
                var prop = chain.slice(0, pos);
                if (null === base)
                    return {
                        base: base,
                        prop: prop,
                        chain: chain
                    };
                var nextBase = base[prop];
                return chain = chain.slice(pos + 1),
                    (base instanceof Object || "object" == typeof base) && isEmptyObject(base) || null === nextBase ? {
                        base: base,
                        prop: prop,
                        chain: chain
                    } : void 0 !== nextBase ? getPropertyInChain(nextBase, chain) : (Object.defineProperty(base, prop, {
                        configurable: !0
                    }),
                    {
                        base: base,
                        prop: prop,
                        chain: chain
                    })
            }
            function nativeIsNaN(num) {
                return (Number.isNaN || window.isNaN)(num)
            }
            function isEmptyObject(obj) {
                return 0 === Object.keys(obj).length && !obj.prototype
            }
            function toRegExp(rawInput) {
                var input = rawInput || "";
                if ("" === input)
                    return new RegExp(".?");
                var regExpStr, flagsStr, delimiterIndex = input.lastIndexOf("/"), flagsPart = input.substring(delimiterIndex + 1), regExpPart = input.substring(0, delimiterIndex + 1), flags = (flagsStr = flagsPart,
                    (regExpStr = regExpPart).startsWith("/") && regExpStr.endsWith("/") && !regExpStr.endsWith("\\/") && function (flag) {
                        if (!flag)
                            return !1;
                        try {
                            return new RegExp("", flag),
                                !0
                        } catch (ex) {
                            return !1
                        }
                    }(flagsStr) ? flagsStr : "");
                if (input.startsWith("/") && input.endsWith("/") || flags)
                    return new RegExp((flags ? regExpPart : input).slice(1, -1), flags);
                var escaped = input.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(escaped)
            }
            function restoreRegExpValues(array) {
                if (array.length)
                    try {
                        var stringPattern = "";
                        stringPattern = 1 === array.length ? `(${array[0]})` : array.reduce((function (accumulator, currentValue, currentIndex) {
                            return 1 === currentIndex ? `(${accumulator}),(${currentValue})` : `${accumulator},(${currentValue})`
                        }
                        ));
                        var regExpGroup = new RegExp(stringPattern);
                        array.toString().replace(regExpGroup, "")
                    } catch (error) {
                        var message = `Failed to restore RegExp values: ${error}`;
                        console.log(message)
                    }
            }
            const updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                (function (source, property, value) {
                    var parsedDelay, stack = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : "", valueWrapper = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : "", setProxyTrap = arguments.length > 5 && void 0 !== arguments[5] && arguments[5];
                    if (["set-constant.js", "ubo-set-constant.js", "set.js", "ubo-set.js", "ubo-set-constant", "ubo-set"].includes(source.name) && (1 !== stack.length && (nativeIsNaN(parsedDelay = parseInt(stack, 10)) || !parsedDelay) && (valueWrapper = stack),
                        stack = void 0),
                        property && function (stackMatch, stackTrace) {
                            if (!stackMatch || "" === stackMatch)
                                return !0;
                            var regExpValues = function () {
                                try {
                                    for (var arrayOfRegexpValues = [], index = 1; index < 10; index += 1) {
                                        var value = `$${index}`;
                                        if (!RegExp[value])
                                            break;
                                        arrayOfRegexpValues.push(RegExp[value])
                                    }
                                    return arrayOfRegexpValues
                                } catch (error) {
                                    return []
                                }
                            }();
                            if (function (stackMatch, stackTrace) {
                                var INLINE_SCRIPT_STRING = "inlineScript"
                                    , INJECTED_SCRIPT_STRING = "injectedScript"
                                    , INJECTED_SCRIPT_MARKER = "<anonymous>"
                                    , isInlineScript = function (match) {
                                        return match.includes(INLINE_SCRIPT_STRING)
                                    }
                                    , isInjectedScript = function (match) {
                                        return match.includes(INJECTED_SCRIPT_STRING)
                                    };
                                if (!isInlineScript(stackMatch) && !isInjectedScript(stackMatch))
                                    return !1;
                                var documentURL = window.location.href
                                    , pos = documentURL.indexOf("#");
                                -1 !== pos && (documentURL = documentURL.slice(0, pos));
                                var stackLines = stackTrace.split("\n").slice(2).map((function (line) {
                                    return line.trim()
                                }
                                )).map((function (line) {
                                    var stack, getStackTraceValues = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(line);
                                    if (getStackTraceValues) {
                                        var _stackURL, _stackURL2, stackURL = getStackTraceValues[2], stackLine = getStackTraceValues[3], stackCol = getStackTraceValues[4];
                                        if (null !== (_stackURL = stackURL) && void 0 !== _stackURL && _stackURL.startsWith("(") && (stackURL = stackURL.slice(1)),
                                            null !== (_stackURL2 = stackURL) && void 0 !== _stackURL2 && _stackURL2.startsWith(INJECTED_SCRIPT_MARKER)) {
                                            var _stackFunction;
                                            stackURL = INJECTED_SCRIPT_STRING;
                                            var stackFunction = void 0 !== getStackTraceValues[1] ? getStackTraceValues[1].slice(0, -1) : line.slice(0, getStackTraceValues.index).trim();
                                            null !== (_stackFunction = stackFunction) && void 0 !== _stackFunction && _stackFunction.startsWith("at") && (stackFunction = stackFunction.slice(2).trim()),
                                                stack = `${stackFunction} ${stackURL}${stackLine}${stackCol}`.trim()
                                        } else
                                            stack = stackURL === documentURL ? `${INLINE_SCRIPT_STRING}${stackLine}${stackCol}`.trim() : `${stackURL}${stackLine}${stackCol}`.trim()
                                    } else
                                        stack = line;
                                    return stack
                                }
                                ));
                                if (stackLines)
                                    for (var index = 0; index < stackLines.length; index += 1) {
                                        if (isInlineScript(stackMatch) && stackLines[index].startsWith(INLINE_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                            return !0;
                                        if (isInjectedScript(stackMatch) && stackLines[index].startsWith(INJECTED_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                            return !0
                                    }
                                return !1
                            }(stackMatch, stackTrace))
                                return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                    !0;
                            var stackRegexp = toRegExp(stackMatch)
                                , refinedStackTrace = stackTrace.split("\n").slice(2).map((function (line) {
                                    return line.trim()
                                }
                                )).join("\n");
                            return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                function () {
                                    var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, "test")
                                        , nativeRegexTest = null == descriptor ? void 0 : descriptor.value;
                                    if (descriptor && "function" == typeof descriptor.value)
                                        return nativeRegexTest;
                                    throw new Error("RegExp.prototype.test is not a function")
                                }().call(stackRegexp, refinedStackTrace)
                        }(stack, (new Error).stack)) {
                        var constantValue, isProxyTrapSet = !1;
                        if ("undefined" === value)
                            constantValue = void 0;
                        else if ("false" === value)
                            constantValue = !1;
                        else if ("true" === value)
                            constantValue = !0;
                        else if ("null" === value)
                            constantValue = null;
                        else if ("emptyArr" === value)
                            constantValue = [];
                        else if ("emptyObj" === value)
                            constantValue = {};
                        else if ("noopFunc" === value)
                            constantValue = noopFunc;
                        else if ("noopCallbackFunc" === value)
                            constantValue = noopCallbackFunc;
                        else if ("trueFunc" === value)
                            constantValue = trueFunc;
                        else if ("falseFunc" === value)
                            constantValue = falseFunc;
                        else if ("throwFunc" === value)
                            constantValue = throwFunc;
                        else if ("noopPromiseResolve" === value)
                            constantValue = noopPromiseResolve;
                        else if ("noopPromiseReject" === value)
                            constantValue = noopPromiseReject;
                        else if (/^\d+$/.test(value)) {
                            if (nativeIsNaN(constantValue = parseFloat(value)))
                                return;
                            if (Math.abs(constantValue) > 32767)
                                return
                        } else if ("-1" === value)
                            constantValue = -1;
                        else if ("" === value)
                            constantValue = "";
                        else if ("yes" === value)
                            constantValue = "yes";
                        else {
                            if ("no" !== value)
                                return;
                            constantValue = "no"
                        }
                        ["asFunction", "asCallback", "asResolved", "asRejected"].includes(valueWrapper) && (constantValue = {
                            asFunction: v => function () {
                                return v
                            }
                            ,
                            asCallback: v => function () {
                                return function () {
                                    return v
                                }
                            }
                            ,
                            asResolved: v => Promise.resolve(v),
                            asRejected: v => Promise.reject(v)
                        }[valueWrapper](constantValue));
                        var canceled = !1
                            , mustCancel = function (value) {
                                return canceled || (canceled = void 0 !== value && void 0 !== constantValue && typeof value != typeof constantValue && null !== value)
                            }
                            , trapProp = function (base, prop, configurable, handler) {
                                if (!handler.init(base[prop]))
                                    return !1;
                                var prevSetter, origDescriptor = Object.getOwnPropertyDescriptor(base, prop);
                                if (origDescriptor instanceof Object) {
                                    if (!origDescriptor.configurable)
                                        return function (source, message) {
                                            var forced = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                                                , convertMessageToString = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
                                                , { name: name, verbose: verbose } = source;
                                            if (forced || verbose) {
                                                var nativeConsole = console.log;
                                                convertMessageToString ? nativeConsole(`${name}: ${message}`) : nativeConsole(`${name}:`, message)
                                            }
                                        }(source, `Property '${prop}' is not configurable`),
                                            !1;
                                    base[prop] && (base[prop] = constantValue),
                                        origDescriptor.set instanceof Function && (prevSetter = origDescriptor.set)
                                }
                                return Object.defineProperty(base, prop, {
                                    configurable: configurable,
                                    get: () => handler.get(),
                                    set(a) {
                                        if (void 0 !== prevSetter && prevSetter(a),
                                            a instanceof Object) {
                                            var propertiesToCheck = property.split(".").slice(1);
                                            setProxyTrap && !isProxyTrapSet && (isProxyTrapSet = !0,
                                                a = new Proxy(a, {
                                                    get: function (target, propertyKey, val) {
                                                        return propertiesToCheck.reduce((function (object, currentProp, index, array) {
                                                            var currentObj = null == object ? void 0 : object[currentProp];
                                                            return index === array.length - 1 && currentObj !== constantValue && (object[currentProp] = constantValue),
                                                                currentObj || object
                                                        }
                                                        ), target),
                                                            Reflect.get(target, propertyKey, val)
                                                    }
                                                }))
                                        }
                                        handler.set(a)
                                    }
                                }),
                                    !0
                            }
                            , _setChainPropAccess = function (owner, property) {
                                var chainInfo = getPropertyInChain(owner, property)
                                    , { base: base } = chainInfo
                                    , { prop: prop, chain: chain } = chainInfo
                                    , inChainPropHandler = {
                                        factValue: void 0,
                                        init(a) {
                                            return this.factValue = a,
                                                !0
                                        },
                                        get() {
                                            return this.factValue
                                        },
                                        set(a) {
                                            this.factValue !== a && (this.factValue = a,
                                                a instanceof Object && _setChainPropAccess(a, chain))
                                        }
                                    }
                                    , endPropHandler = {
                                        init: a => !mustCancel(a),
                                        get: () => constantValue,
                                        set(a) {
                                            mustCancel(a) && (constantValue = a)
                                        }
                                    };
                                if (chain)
                                    if (void 0 === base || null !== base[prop]) {
                                        (base instanceof Object || "object" == typeof base) && isEmptyObject(base) && trapProp(base, prop, !0, inChainPropHandler);
                                        var propValue = owner[prop];
                                        (propValue instanceof Object || "object" == typeof propValue && null !== propValue) && _setChainPropAccess(propValue, chain),
                                            trapProp(base, prop, !0, inChainPropHandler)
                                    } else
                                        trapProp(base, prop, !0, inChainPropHandler);
                                else
                                    trapProp(base, prop, !1, endPropHandler) && function (source) {
                                        var ABY_PREFIX = "[ABY]";
                                        if (source.verbose) {
                                            try {
                                                var trace = console.trace.bind(console)
                                                    , label = `${ABY_PREFIX} `;
                                                "corelibs" === source.engine ? label += source.ruleText : (source.domainName && (label += `${source.domainName}`),
                                                    source.args ? label += `#%#//scriptlet('${source.name}', '${source.args.join("', '")}')` : label += `#%#//scriptlet('${source.name}')`),
                                                    trace && trace(label)
                                            } catch (e) { }
                                            "function" == typeof window.__debug && window.__debug(source)
                                        }
                                    }(source)
                            };
                        _setChainPropAccess(window, property)
                    }
                }
                ).apply(this, updatedArgs),
                    source.uniqueId && Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: "done",
                        enumerable: !1,
                        writable: !1,
                        configurable: !1
                    })
            } catch (e) {
                console.log(e)
            }
        }
        )({
            "name": "set-constant",
            "args": ["playerResponse.adPlacements", "undefined"]
        }, ["playerResponse.adPlacements", "undefined"]);
        ; (function setConstant(source, args) {
            const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId && "done" === Window.prototype.toString[uniqueIdentifier])
                return;
            function noopFunc() { }
            function noopCallbackFunc() {
                return noopFunc
            }
            function trueFunc() {
                return !0
            }
            function falseFunc() {
                return !1
            }
            function throwFunc() {
                throw new Error
            }
            function noopPromiseReject() {
                return Promise.reject()
            }
            function noopPromiseResolve() {
                var responseUrl = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : ""
                    , responseType = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "basic";
                if ("undefined" != typeof Response) {
                    var response = new Response(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "{}", {
                        status: 200,
                        statusText: "OK"
                    });
                    return "opaque" === responseType ? Object.defineProperties(response, {
                        body: {
                            value: null
                        },
                        status: {
                            value: 0
                        },
                        ok: {
                            value: !1
                        },
                        statusText: {
                            value: ""
                        },
                        url: {
                            value: ""
                        },
                        type: {
                            value: responseType
                        }
                    }) : Object.defineProperties(response, {
                        url: {
                            value: responseUrl
                        },
                        type: {
                            value: responseType
                        }
                    }),
                        Promise.resolve(response)
                }
            }
            function getPropertyInChain(base, chain) {
                var pos = chain.indexOf(".");
                if (-1 === pos)
                    return {
                        base: base,
                        prop: chain
                    };
                var prop = chain.slice(0, pos);
                if (null === base)
                    return {
                        base: base,
                        prop: prop,
                        chain: chain
                    };
                var nextBase = base[prop];
                return chain = chain.slice(pos + 1),
                    (base instanceof Object || "object" == typeof base) && isEmptyObject(base) || null === nextBase ? {
                        base: base,
                        prop: prop,
                        chain: chain
                    } : void 0 !== nextBase ? getPropertyInChain(nextBase, chain) : (Object.defineProperty(base, prop, {
                        configurable: !0
                    }),
                    {
                        base: base,
                        prop: prop,
                        chain: chain
                    })
            }
            function nativeIsNaN(num) {
                return (Number.isNaN || window.isNaN)(num)
            }
            function isEmptyObject(obj) {
                return 0 === Object.keys(obj).length && !obj.prototype
            }
            function toRegExp(rawInput) {
                var input = rawInput || "";
                if ("" === input)
                    return new RegExp(".?");
                var regExpStr, flagsStr, delimiterIndex = input.lastIndexOf("/"), flagsPart = input.substring(delimiterIndex + 1), regExpPart = input.substring(0, delimiterIndex + 1), flags = (flagsStr = flagsPart,
                    (regExpStr = regExpPart).startsWith("/") && regExpStr.endsWith("/") && !regExpStr.endsWith("\\/") && function (flag) {
                        if (!flag)
                            return !1;
                        try {
                            return new RegExp("", flag),
                                !0
                        } catch (ex) {
                            return !1
                        }
                    }(flagsStr) ? flagsStr : "");
                if (input.startsWith("/") && input.endsWith("/") || flags)
                    return new RegExp((flags ? regExpPart : input).slice(1, -1), flags);
                var escaped = input.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(escaped)
            }
            function restoreRegExpValues(array) {
                if (array.length)
                    try {
                        var stringPattern = "";
                        stringPattern = 1 === array.length ? `(${array[0]})` : array.reduce((function (accumulator, currentValue, currentIndex) {
                            return 1 === currentIndex ? `(${accumulator}),(${currentValue})` : `${accumulator},(${currentValue})`
                        }
                        ));
                        var regExpGroup = new RegExp(stringPattern);
                        array.toString().replace(regExpGroup, "")
                    } catch (error) {
                        var message = `Failed to restore RegExp values: ${error}`;
                        console.log(message)
                    }
            }
            const updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                (function (source, property, value) {
                    var parsedDelay, stack = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : "", valueWrapper = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : "", setProxyTrap = arguments.length > 5 && void 0 !== arguments[5] && arguments[5];
                    if (["set-constant.js", "ubo-set-constant.js", "set.js", "ubo-set.js", "ubo-set-constant", "ubo-set"].includes(source.name) && (1 !== stack.length && (nativeIsNaN(parsedDelay = parseInt(stack, 10)) || !parsedDelay) && (valueWrapper = stack),
                        stack = void 0),
                        property && function (stackMatch, stackTrace) {
                            if (!stackMatch || "" === stackMatch)
                                return !0;
                            var regExpValues = function () {
                                try {
                                    for (var arrayOfRegexpValues = [], index = 1; index < 10; index += 1) {
                                        var value = `$${index}`;
                                        if (!RegExp[value])
                                            break;
                                        arrayOfRegexpValues.push(RegExp[value])
                                    }
                                    return arrayOfRegexpValues
                                } catch (error) {
                                    return []
                                }
                            }();
                            if (function (stackMatch, stackTrace) {
                                var INLINE_SCRIPT_STRING = "inlineScript"
                                    , INJECTED_SCRIPT_STRING = "injectedScript"
                                    , INJECTED_SCRIPT_MARKER = "<anonymous>"
                                    , isInlineScript = function (match) {
                                        return match.includes(INLINE_SCRIPT_STRING)
                                    }
                                    , isInjectedScript = function (match) {
                                        return match.includes(INJECTED_SCRIPT_STRING)
                                    };
                                if (!isInlineScript(stackMatch) && !isInjectedScript(stackMatch))
                                    return !1;
                                var documentURL = window.location.href
                                    , pos = documentURL.indexOf("#");
                                -1 !== pos && (documentURL = documentURL.slice(0, pos));
                                var stackLines = stackTrace.split("\n").slice(2).map((function (line) {
                                    return line.trim()
                                }
                                )).map((function (line) {
                                    var stack, getStackTraceValues = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(line);
                                    if (getStackTraceValues) {
                                        var _stackURL, _stackURL2, stackURL = getStackTraceValues[2], stackLine = getStackTraceValues[3], stackCol = getStackTraceValues[4];
                                        if (null !== (_stackURL = stackURL) && void 0 !== _stackURL && _stackURL.startsWith("(") && (stackURL = stackURL.slice(1)),
                                            null !== (_stackURL2 = stackURL) && void 0 !== _stackURL2 && _stackURL2.startsWith(INJECTED_SCRIPT_MARKER)) {
                                            var _stackFunction;
                                            stackURL = INJECTED_SCRIPT_STRING;
                                            var stackFunction = void 0 !== getStackTraceValues[1] ? getStackTraceValues[1].slice(0, -1) : line.slice(0, getStackTraceValues.index).trim();
                                            null !== (_stackFunction = stackFunction) && void 0 !== _stackFunction && _stackFunction.startsWith("at") && (stackFunction = stackFunction.slice(2).trim()),
                                                stack = `${stackFunction} ${stackURL}${stackLine}${stackCol}`.trim()
                                        } else
                                            stack = stackURL === documentURL ? `${INLINE_SCRIPT_STRING}${stackLine}${stackCol}`.trim() : `${stackURL}${stackLine}${stackCol}`.trim()
                                    } else
                                        stack = line;
                                    return stack
                                }
                                ));
                                if (stackLines)
                                    for (var index = 0; index < stackLines.length; index += 1) {
                                        if (isInlineScript(stackMatch) && stackLines[index].startsWith(INLINE_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                            return !0;
                                        if (isInjectedScript(stackMatch) && stackLines[index].startsWith(INJECTED_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                            return !0
                                    }
                                return !1
                            }(stackMatch, stackTrace))
                                return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                    !0;
                            var stackRegexp = toRegExp(stackMatch)
                                , refinedStackTrace = stackTrace.split("\n").slice(2).map((function (line) {
                                    return line.trim()
                                }
                                )).join("\n");
                            return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                function () {
                                    var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, "test")
                                        , nativeRegexTest = null == descriptor ? void 0 : descriptor.value;
                                    if (descriptor && "function" == typeof descriptor.value)
                                        return nativeRegexTest;
                                    throw new Error("RegExp.prototype.test is not a function")
                                }().call(stackRegexp, refinedStackTrace)
                        }(stack, (new Error).stack)) {
                        var constantValue, isProxyTrapSet = !1;
                        if ("undefined" === value)
                            constantValue = void 0;
                        else if ("false" === value)
                            constantValue = !1;
                        else if ("true" === value)
                            constantValue = !0;
                        else if ("null" === value)
                            constantValue = null;
                        else if ("emptyArr" === value)
                            constantValue = [];
                        else if ("emptyObj" === value)
                            constantValue = {};
                        else if ("noopFunc" === value)
                            constantValue = noopFunc;
                        else if ("noopCallbackFunc" === value)
                            constantValue = noopCallbackFunc;
                        else if ("trueFunc" === value)
                            constantValue = trueFunc;
                        else if ("falseFunc" === value)
                            constantValue = falseFunc;
                        else if ("throwFunc" === value)
                            constantValue = throwFunc;
                        else if ("noopPromiseResolve" === value)
                            constantValue = noopPromiseResolve;
                        else if ("noopPromiseReject" === value)
                            constantValue = noopPromiseReject;
                        else if (/^\d+$/.test(value)) {
                            if (nativeIsNaN(constantValue = parseFloat(value)))
                                return;
                            if (Math.abs(constantValue) > 32767)
                                return
                        } else if ("-1" === value)
                            constantValue = -1;
                        else if ("" === value)
                            constantValue = "";
                        else if ("yes" === value)
                            constantValue = "yes";
                        else {
                            if ("no" !== value)
                                return;
                            constantValue = "no"
                        }
                        ["asFunction", "asCallback", "asResolved", "asRejected"].includes(valueWrapper) && (constantValue = {
                            asFunction: v => function () {
                                return v
                            }
                            ,
                            asCallback: v => function () {
                                return function () {
                                    return v
                                }
                            }
                            ,
                            asResolved: v => Promise.resolve(v),
                            asRejected: v => Promise.reject(v)
                        }[valueWrapper](constantValue));
                        var canceled = !1
                            , mustCancel = function (value) {
                                return canceled || (canceled = void 0 !== value && void 0 !== constantValue && typeof value != typeof constantValue && null !== value)
                            }
                            , trapProp = function (base, prop, configurable, handler) {
                                if (!handler.init(base[prop]))
                                    return !1;
                                var prevSetter, origDescriptor = Object.getOwnPropertyDescriptor(base, prop);
                                if (origDescriptor instanceof Object) {
                                    if (!origDescriptor.configurable)
                                        return function (source, message) {
                                            var forced = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                                                , convertMessageToString = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
                                                , { name: name, verbose: verbose } = source;
                                            if (forced || verbose) {
                                                var nativeConsole = console.log;
                                                convertMessageToString ? nativeConsole(`${name}: ${message}`) : nativeConsole(`${name}:`, message)
                                            }
                                        }(source, `Property '${prop}' is not configurable`),
                                            !1;
                                    base[prop] && (base[prop] = constantValue),
                                        origDescriptor.set instanceof Function && (prevSetter = origDescriptor.set)
                                }
                                return Object.defineProperty(base, prop, {
                                    configurable: configurable,
                                    get: () => handler.get(),
                                    set(a) {
                                        if (void 0 !== prevSetter && prevSetter(a),
                                            a instanceof Object) {
                                            var propertiesToCheck = property.split(".").slice(1);
                                            setProxyTrap && !isProxyTrapSet && (isProxyTrapSet = !0,
                                                a = new Proxy(a, {
                                                    get: function (target, propertyKey, val) {
                                                        return propertiesToCheck.reduce((function (object, currentProp, index, array) {
                                                            var currentObj = null == object ? void 0 : object[currentProp];
                                                            return index === array.length - 1 && currentObj !== constantValue && (object[currentProp] = constantValue),
                                                                currentObj || object
                                                        }
                                                        ), target),
                                                            Reflect.get(target, propertyKey, val)
                                                    }
                                                }))
                                        }
                                        handler.set(a)
                                    }
                                }),
                                    !0
                            }
                            , _setChainPropAccess = function (owner, property) {
                                var chainInfo = getPropertyInChain(owner, property)
                                    , { base: base } = chainInfo
                                    , { prop: prop, chain: chain } = chainInfo
                                    , inChainPropHandler = {
                                        factValue: void 0,
                                        init(a) {
                                            return this.factValue = a,
                                                !0
                                        },
                                        get() {
                                            return this.factValue
                                        },
                                        set(a) {
                                            this.factValue !== a && (this.factValue = a,
                                                a instanceof Object && _setChainPropAccess(a, chain))
                                        }
                                    }
                                    , endPropHandler = {
                                        init: a => !mustCancel(a),
                                        get: () => constantValue,
                                        set(a) {
                                            mustCancel(a) && (constantValue = a)
                                        }
                                    };
                                if (chain)
                                    if (void 0 === base || null !== base[prop]) {
                                        (base instanceof Object || "object" == typeof base) && isEmptyObject(base) && trapProp(base, prop, !0, inChainPropHandler);
                                        var propValue = owner[prop];
                                        (propValue instanceof Object || "object" == typeof propValue && null !== propValue) && _setChainPropAccess(propValue, chain),
                                            trapProp(base, prop, !0, inChainPropHandler)
                                    } else
                                        trapProp(base, prop, !0, inChainPropHandler);
                                else
                                    trapProp(base, prop, !1, endPropHandler) && function (source) {
                                        var ABY_PREFIX = "[ABY]";
                                        if (source.verbose) {
                                            try {
                                                var trace = console.trace.bind(console)
                                                    , label = `${ABY_PREFIX} `;
                                                "corelibs" === source.engine ? label += source.ruleText : (source.domainName && (label += `${source.domainName}`),
                                                    source.args ? label += `#%#//scriptlet('${source.name}', '${source.args.join("', '")}')` : label += `#%#//scriptlet('${source.name}')`),
                                                    trace && trace(label)
                                            } catch (e) { }
                                            "function" == typeof window.__debug && window.__debug(source)
                                        }
                                    }(source)
                            };
                        _setChainPropAccess(window, property)
                    }
                }
                ).apply(this, updatedArgs),
                    source.uniqueId && Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: "done",
                        enumerable: !1,
                        writable: !1,
                        configurable: !1
                    })
            } catch (e) {
                console.log(e)
            }
        }
        )({
            "name": "set-constant",
            "args": ["google_ad_status", "1"]
        }, ["google_ad_status", "1"]);
        ; (function jsonPrune(source, args) {
            const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId && "done" === Window.prototype.toString[uniqueIdentifier])
                return;
            function matchStackTrace(stackMatch, stackTrace) {
                if (!stackMatch || "" === stackMatch)
                    return !0;
                var regExpValues = function () {
                    try {
                        for (var arrayOfRegexpValues = [], index = 1; index < 10; index += 1) {
                            var value = `$${index}`;
                            if (!RegExp[value])
                                break;
                            arrayOfRegexpValues.push(RegExp[value])
                        }
                        return arrayOfRegexpValues
                    } catch (error) {
                        return []
                    }
                }();
                if (function (stackMatch, stackTrace) {
                    var INLINE_SCRIPT_STRING = "inlineScript"
                        , INJECTED_SCRIPT_STRING = "injectedScript"
                        , INJECTED_SCRIPT_MARKER = "<anonymous>"
                        , isInlineScript = function (match) {
                            return match.includes(INLINE_SCRIPT_STRING)
                        }
                        , isInjectedScript = function (match) {
                            return match.includes(INJECTED_SCRIPT_STRING)
                        };
                    if (!isInlineScript(stackMatch) && !isInjectedScript(stackMatch))
                        return !1;
                    var documentURL = window.location.href
                        , pos = documentURL.indexOf("#");
                    -1 !== pos && (documentURL = documentURL.slice(0, pos));
                    var stackSteps = stackTrace.split("\n").slice(2).map((function (line) {
                        return line.trim()
                    }
                    ))
                        , stackLines = stackSteps.map((function (line) {
                            var stack, getStackTraceValues = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(line);
                            if (getStackTraceValues) {
                                var _stackURL, _stackURL2, stackURL = getStackTraceValues[2], stackLine = getStackTraceValues[3], stackCol = getStackTraceValues[4];
                                if (null !== (_stackURL = stackURL) && void 0 !== _stackURL && _stackURL.startsWith("(") && (stackURL = stackURL.slice(1)),
                                    null !== (_stackURL2 = stackURL) && void 0 !== _stackURL2 && _stackURL2.startsWith(INJECTED_SCRIPT_MARKER)) {
                                    var _stackFunction;
                                    stackURL = INJECTED_SCRIPT_STRING;
                                    var stackFunction = void 0 !== getStackTraceValues[1] ? getStackTraceValues[1].slice(0, -1) : line.slice(0, getStackTraceValues.index).trim();
                                    null !== (_stackFunction = stackFunction) && void 0 !== _stackFunction && _stackFunction.startsWith("at") && (stackFunction = stackFunction.slice(2).trim()),
                                        stack = `${stackFunction} ${stackURL}${stackLine}${stackCol}`.trim()
                                } else
                                    stack = stackURL === documentURL ? `${INLINE_SCRIPT_STRING}${stackLine}${stackCol}`.trim() : `${stackURL}${stackLine}${stackCol}`.trim()
                            } else
                                stack = line;
                            return stack
                        }
                        ));
                    if (stackLines)
                        for (var index = 0; index < stackLines.length; index += 1) {
                            if (isInlineScript(stackMatch) && stackLines[index].startsWith(INLINE_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                return !0;
                            if (isInjectedScript(stackMatch) && stackLines[index].startsWith(INJECTED_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                return !0
                        }
                    return !1
                }(stackMatch, stackTrace))
                    return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                        !0;
                var stackRegexp = toRegExp(stackMatch)
                    , refinedStackTrace = stackTrace.split("\n").slice(2).map((function (line) {
                        return line.trim()
                    }
                    )).join("\n");
                return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                    function () {
                        var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, "test")
                            , nativeRegexTest = null == descriptor ? void 0 : descriptor.value;
                        if (descriptor && "function" == typeof descriptor.value)
                            return nativeRegexTest;
                        throw new Error("RegExp.prototype.test is not a function")
                    }().call(stackRegexp, refinedStackTrace)
            }
            function getWildcardPropertyInChain(base, chain) {
                var lookThrough = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                    , output = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : []
                    , pos = chain.indexOf(".");
                if (-1 === pos) {
                    if ("*" === chain || "[]" === chain)
                        for (var key in base)
                            Object.prototype.hasOwnProperty.call(base, key) && output.push({
                                base: base,
                                prop: key
                            });
                    else
                        output.push({
                            base: base,
                            prop: chain
                        });
                    return output
                }
                var prop = chain.slice(0, pos);
                if ("[]" === prop && Array.isArray(base) || "*" === prop && base instanceof Object) {
                    var nextProp = chain.slice(pos + 1);
                    Object.keys(base).forEach((function (key) {
                        getWildcardPropertyInChain(base[key], nextProp, lookThrough, output)
                    }
                    ))
                }
                Array.isArray(base) && base.forEach((function (key) {
                    void 0 !== key && getWildcardPropertyInChain(key, chain, lookThrough, output)
                }
                ));
                var nextBase = base[prop];
                return chain = chain.slice(pos + 1),
                    void 0 !== nextBase && getWildcardPropertyInChain(nextBase, chain, lookThrough, output),
                    output
            }
            function logMessage(source, message) {
                var forced = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                    , convertMessageToString = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
                    , { name: name, verbose: verbose } = source;
                if (forced || verbose) {
                    var nativeConsole = console.log;
                    convertMessageToString ? nativeConsole(`${name}: ${message}`) : nativeConsole(`${name}:`, message)
                }
            }
            function jsonPruner(source, root, prunePaths, requiredPaths, stack, nativeObjects) {
                var { nativeStringify: nativeStringify } = nativeObjects;
                if (0 === prunePaths.length && 0 === requiredPaths.length)
                    return logMessage(source, `${window.location.hostname}\n${nativeStringify(root, null, 2)}\nStack trace:\n${(new Error).stack}`, !0),
                        root && "object" == typeof root && logMessage(source, root, !0, !1),
                        root;
                try {
                    if (!1 === function (source, root, prunePaths, requiredPaths, stack, nativeObjects) {
                        if (!root)
                            return !1;
                        var shouldProcess, { nativeStringify: nativeStringify } = nativeObjects;
                        if (0 === prunePaths.length && requiredPaths.length > 0) {
                            var rootString = nativeStringify(root);
                            if (toRegExp(requiredPaths.join("")).test(rootString))
                                return logMessage(source, `${window.location.hostname}\n${nativeStringify(root, null, 2)}\nStack trace:\n${(new Error).stack}`, !0),
                                    root && "object" == typeof root && logMessage(source, root, !0, !1),
                                    shouldProcess = !1
                        }
                        if (stack && !matchStackTrace(stack, (new Error).stack || ""))
                            return shouldProcess = !1;
                        for (var _ret, wildcardSymbols = [".*.", "*.", ".*", ".[].", "[].", ".[]"], _loop = function () {
                            var requiredPath = requiredPaths[i]
                                , lastNestedPropName = requiredPath.split(".").pop()
                                , hasWildcard = wildcardSymbols.some((function (symbol) {
                                    return requiredPath.includes(symbol)
                                }
                                ))
                                , details = getWildcardPropertyInChain(root, requiredPath, hasWildcard);
                            if (!details.length)
                                return {
                                    v: shouldProcess = !1
                                };
                            shouldProcess = !hasWildcard;
                            for (var j = 0; j < details.length; j += 1) {
                                var hasRequiredProp = "string" == typeof lastNestedPropName && void 0 !== details[j].base[lastNestedPropName];
                                shouldProcess = hasWildcard ? hasRequiredProp || shouldProcess : hasRequiredProp && shouldProcess
                            }
                        }, i = 0; i < requiredPaths.length; i += 1)
                            if (_ret = _loop())
                                return _ret.v;
                        return shouldProcess
                    }(source, root, prunePaths, requiredPaths, stack, nativeObjects))
                        return root;
                    prunePaths.forEach((function (path) {
                        getWildcardPropertyInChain(root, path, !0).forEach((function (ownerObj) {
                            void 0 !== ownerObj && ownerObj.base && (delete ownerObj.base[ownerObj.prop],
                                function (source) {
                                    if (source.verbose) {
                                        try {
                                            var trace = console.trace.bind(console)
                                                , label = "[ABY] ";
                                            "corelibs" === source.engine ? label += source.ruleText : (source.domainName && (label += `${source.domainName}`),
                                                source.args ? label += `#%#//scriptlet('${source.name}', '${source.args.join("', '")}')` : label += `#%#//scriptlet('${source.name}')`),
                                                trace && trace(label)
                                        } catch (e) { }
                                        "function" == typeof window.__debug && window.__debug(source)
                                    }
                                }(source))
                        }
                        ))
                    }
                    ))
                } catch (e) {
                    logMessage(source, e)
                }
                return root
            }
            function getPrunePath(props) {
                return "string" == typeof props && void 0 !== props && "" !== props ? props.split(/ +/) : []
            }
            function toRegExp(rawInput) {
                var input = rawInput || "";
                if ("" === input)
                    return new RegExp(".?");
                var regExpStr, flagsStr, delimiterIndex = input.lastIndexOf("/"), flagsPart = input.substring(delimiterIndex + 1), regExpPart = input.substring(0, delimiterIndex + 1), flags = (flagsStr = flagsPart,
                    (regExpStr = regExpPart).startsWith("/") && regExpStr.endsWith("/") && !regExpStr.endsWith("\\/") && function (flag) {
                        if (!flag)
                            return !1;
                        try {
                            return new RegExp("", flag),
                                !0
                        } catch (ex) {
                            return !1
                        }
                    }(flagsStr) ? flagsStr : "");
                if (input.startsWith("/") && input.endsWith("/") || flags)
                    return new RegExp((flags ? regExpPart : input).slice(1, -1), flags);
                var escaped = input.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(escaped)
            }
            function restoreRegExpValues(array) {
                if (array.length)
                    try {
                        var stringPattern = "";
                        stringPattern = 1 === array.length ? `(${array[0]})` : array.reduce((function (accumulator, currentValue, currentIndex) {
                            return 1 === currentIndex ? `(${accumulator}),(${currentValue})` : `${accumulator},(${currentValue})`
                        }
                        ));
                        var regExpGroup = new RegExp(stringPattern);
                        array.toString().replace(regExpGroup, "")
                    } catch (error) {
                        var message = `Failed to restore RegExp values: ${error}`;
                        console.log(message)
                    }
            }
            const updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                (function (source, propsToRemove, requiredInitialProps) {
                    var stack = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : ""
                        , prunePaths = getPrunePath(propsToRemove)
                        , requiredPaths = getPrunePath(requiredInitialProps)
                        , nativeObjects = {
                            nativeStringify: window.JSON.stringify
                        }
                        , nativeJSONParse = JSON.parse
                        , jsonParseWrapper = function () {
                            for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++)
                                args[_key] = arguments[_key];
                            var root = nativeJSONParse.apply(JSON, args);
                            return jsonPruner(source, root, prunePaths, requiredPaths, stack, nativeObjects)
                        };
                    jsonParseWrapper.toString = nativeJSONParse.toString.bind(nativeJSONParse),
                        JSON.parse = jsonParseWrapper;
                    var nativeResponseJson = Response.prototype.json;
                    "undefined" != typeof Response && (Response.prototype.json = function () {
                        return nativeResponseJson.apply(this).then((function (obj) {
                            return jsonPruner(source, obj, prunePaths, requiredPaths, stack, nativeObjects)
                        }
                        ))
                    }
                    )
                }
                ).apply(this, updatedArgs),
                    source.uniqueId && Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: "done",
                        enumerable: !1,
                        writable: !1,
                        configurable: !1
                    })
            } catch (e) {
                console.log(e)
            }
        }
        )({
            "name": "json-prune",
            "args": ["__DISABLED_NOOP__", "__DISABLED_NOOP__"]
        }, ["__DISABLED_NOOP__", "__DISABLED_NOOP__"]);
        // DISABLED: Global JSON.parse modification was breaking SPA navigation - pruning ad data from all parsed JSON
        ; (function jsonPruneXhrResponse(source, args) {
            const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId && "done" === Window.prototype.toString[uniqueIdentifier])
                return;
            function hit(source) {
                window.postMessage({
                    source: 'YT_AD_CLEANER',
                    type: 'INCREMENT_COUNTER',
                    key: 'adBlockCount'
                }, '*');
                if (source.verbose) {
                    try {
                        var trace = console.trace.bind(console)
                            , label = "[ABY] ";
                        "corelibs" === source.engine ? label += source.ruleText : (source.domainName && (label += `${source.domainName}`),
                            source.args ? label += `#%#//scriptlet('${source.name}', '${source.args.join("', '")}')` : label += `#%#//scriptlet('${source.name}')`),
                            trace && trace(label)
                    } catch (e) { }
                    "function" == typeof window.__debug && window.__debug(source)
                }
            }
            function logMessage(source, message) {
                var forced = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                    , convertMessageToString = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
                    , { name: name, verbose: verbose } = source;
                if (forced || verbose) {
                    var nativeConsole = console.log;
                    convertMessageToString ? nativeConsole(`${name}: ${message}`) : nativeConsole(`${name}:`, message)
                }
            }
            function toRegExp(rawInput) {
                var input = rawInput || "";
                if ("" === input)
                    return new RegExp(".?");
                var regExpStr, flagsStr, delimiterIndex = input.lastIndexOf("/"), flagsPart = input.substring(delimiterIndex + 1), regExpPart = input.substring(0, delimiterIndex + 1), flags = (flagsStr = flagsPart,
                    (regExpStr = regExpPart).startsWith("/") && regExpStr.endsWith("/") && !regExpStr.endsWith("\\/") && function (flag) {
                        if (!flag)
                            return !1;
                        try {
                            return new RegExp("", flag),
                                !0
                        } catch (ex) {
                            return !1
                        }
                    }(flagsStr) ? flagsStr : "");
                if (input.startsWith("/") && input.endsWith("/") || flags)
                    return new RegExp((flags ? regExpPart : input).slice(1, -1), flags);
                var escaped = input.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(escaped)
            }
            function getPrunePath(props) {
                return "string" == typeof props && void 0 !== props && "" !== props ? props.split(/ +/) : []
            }
            function getXhrData(method, url, async, user, password) {
                return {
                    method: method,
                    url: url,
                    async: async,
                    user: user,
                    password: password
                }
            }
            function matchStackTrace(stackMatch, stackTrace) {
                if (!stackMatch || "" === stackMatch)
                    return !0;
                var regExpValues = function () {
                    try {
                        for (var arrayOfRegexpValues = [], index = 1; index < 10; index += 1) {
                            var value = `$${index}`;
                            if (!RegExp[value])
                                break;
                            arrayOfRegexpValues.push(RegExp[value])
                        }
                        return arrayOfRegexpValues
                    } catch (error) {
                        return []
                    }
                }();
                if (function (stackMatch, stackTrace) {
                    var INLINE_SCRIPT_STRING = "inlineScript"
                        , INJECTED_SCRIPT_STRING = "injectedScript"
                        , INJECTED_SCRIPT_MARKER = "<anonymous>"
                        , isInlineScript = function (match) {
                            return match.includes(INLINE_SCRIPT_STRING)
                        }
                        , isInjectedScript = function (match) {
                            return match.includes(INJECTED_SCRIPT_STRING)
                        };
                    if (!isInlineScript(stackMatch) && !isInjectedScript(stackMatch))
                        return !1;
                    var documentURL = window.location.href
                        , pos = documentURL.indexOf("#");
                    -1 !== pos && (documentURL = documentURL.slice(0, pos));
                    var stackSteps = stackTrace.split("\n").slice(2).map((function (line) {
                        return line.trim()
                    }
                    ))
                        , stackLines = stackSteps.map((function (line) {
                            var stack, getStackTraceValues = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(line);
                            if (getStackTraceValues) {
                                var _stackURL, _stackURL2, stackURL = getStackTraceValues[2], stackLine = getStackTraceValues[3], stackCol = getStackTraceValues[4];
                                if (null !== (_stackURL = stackURL) && void 0 !== _stackURL && _stackURL.startsWith("(") && (stackURL = stackURL.slice(1)),
                                    null !== (_stackURL2 = stackURL) && void 0 !== _stackURL2 && _stackURL2.startsWith(INJECTED_SCRIPT_MARKER)) {
                                    var _stackFunction;
                                    stackURL = INJECTED_SCRIPT_STRING;
                                    var stackFunction = void 0 !== getStackTraceValues[1] ? getStackTraceValues[1].slice(0, -1) : line.slice(0, getStackTraceValues.index).trim();
                                    null !== (_stackFunction = stackFunction) && void 0 !== _stackFunction && _stackFunction.startsWith("at") && (stackFunction = stackFunction.slice(2).trim()),
                                        stack = `${stackFunction} ${stackURL}${stackLine}${stackCol}`.trim()
                                } else
                                    stack = stackURL === documentURL ? `${INLINE_SCRIPT_STRING}${stackLine}${stackCol}`.trim() : `${stackURL}${stackLine}${stackCol}`.trim()
                            } else
                                stack = line;
                            return stack
                        }
                        ));
                    if (stackLines)
                        for (var index = 0; index < stackLines.length; index += 1) {
                            if (isInlineScript(stackMatch) && stackLines[index].startsWith(INLINE_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                return !0;
                            if (isInjectedScript(stackMatch) && stackLines[index].startsWith(INJECTED_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                return !0
                        }
                    return !1
                }(stackMatch, stackTrace))
                    return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                        !0;
                var stackRegexp = toRegExp(stackMatch)
                    , refinedStackTrace = stackTrace.split("\n").slice(2).map((function (line) {
                        return line.trim()
                    }
                    )).join("\n");
                return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                    function () {
                        var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, "test")
                            , nativeRegexTest = null == descriptor ? void 0 : descriptor.value;
                        if (descriptor && "function" == typeof descriptor.value)
                            return nativeRegexTest;
                        throw new Error("RegExp.prototype.test is not a function")
                    }().call(stackRegexp, refinedStackTrace)
            }
            function getWildcardPropertyInChain(base, chain) {
                var lookThrough = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                    , output = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : []
                    , pos = chain.indexOf(".");
                if (-1 === pos) {
                    if ("*" === chain || "[]" === chain)
                        for (var key in base)
                            Object.prototype.hasOwnProperty.call(base, key) && output.push({
                                base: base,
                                prop: key
                            });
                    else
                        output.push({
                            base: base,
                            prop: chain
                        });
                    return output
                }
                var prop = chain.slice(0, pos);
                if ("[]" === prop && Array.isArray(base) || "*" === prop && base instanceof Object) {
                    var nextProp = chain.slice(pos + 1);
                    Object.keys(base).forEach((function (key) {
                        getWildcardPropertyInChain(base[key], nextProp, lookThrough, output)
                    }
                    ))
                }
                Array.isArray(base) && base.forEach((function (key) {
                    void 0 !== key && getWildcardPropertyInChain(key, chain, lookThrough, output)
                }
                ));
                var nextBase = base[prop];
                return chain = chain.slice(pos + 1),
                    void 0 !== nextBase && getWildcardPropertyInChain(nextBase, chain, lookThrough, output),
                    output
            }
            function restoreRegExpValues(array) {
                if (array.length)
                    try {
                        var stringPattern = "";
                        stringPattern = 1 === array.length ? `(${array[0]})` : array.reduce((function (accumulator, currentValue, currentIndex) {
                            return 1 === currentIndex ? `(${accumulator}),(${currentValue})` : `${accumulator},(${currentValue})`
                        }
                        ));
                        var regExpGroup = new RegExp(stringPattern);
                        array.toString().replace(regExpGroup, "")
                    } catch (error) {
                        var message = `Failed to restore RegExp values: ${error}`;
                        console.log(message)
                    }
            }
            const updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                (function (source, propsToRemove, obligatoryProps) {
                    var propsToMatch = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : ""
                        , stack = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : "";
                    if ("undefined" != typeof Proxy) {
                        var xhrData, shouldLog = !propsToRemove && !obligatoryProps, prunePaths = getPrunePath(propsToRemove), requiredPaths = getPrunePath(obligatoryProps), nativeParse = window.JSON.parse, nativeStringify = window.JSON.stringify, nativeOpen = window.XMLHttpRequest.prototype.open, nativeSend = window.XMLHttpRequest.prototype.send, setRequestHeaderHandler = {
                            apply: function (setRequestHeader, thisArgument, argsList) {
                                return thisArgument.collectedHeaders.push(argsList),
                                    Reflect.apply(setRequestHeader, thisArgument, argsList)
                            }
                        }, openHandler = {
                            apply: function (target, thisArg, args) {
                                // BYPASS: Don't intercept YouTube API requests - let them pass through cleanly for SPA navigation
                                try {
                                    var requestUrl = String(args[1] || '');
                                    // BYPASS most YouTube API traffic, but allow /youtubei/v1/player to be processed
                                    // so we can prune ad fields from the playerResponse.
                                    if ((requestUrl.includes('/youtubei/') && !requestUrl.includes('/youtubei/v1/player')) || requestUrl.includes('/api/stats/') || requestUrl.includes('/qoe') || requestUrl.includes('googlevideo.com')) {
                                        return Reflect.apply(target, thisArg, args);
                                    }
                                } catch (e) { }

                                // IMPORTANT: xhrData must be stored per XHR instance.
                                // Using a shared variable causes cross-request bleeding during SPA navigation.
                                thisArg.__adshieldXhrData = getXhrData.apply(null, args),
                                    xhrData = thisArg.__adshieldXhrData,
                                    (function (source, propsToMatch, requestData) {
                                        if ("" === propsToMatch || "*" === propsToMatch)
                                            return !0;
                                        var isMatched, PROPS_DIVIDER, PAIRS_MARKER, isRequestProp, propsObj, data, parsedData = (PROPS_DIVIDER = " ",
                                            PAIRS_MARKER = ":",
                                            isRequestProp = function (prop) {
                                                return ["url", "method", "headers", "body", "credentials", "cache", "redirect", "referrer", "referrerPolicy", "integrity", "keepalive", "signal", "mode"].includes(prop)
                                            }
                                            ,
                                            propsObj = {},
                                            propsToMatch.split(PROPS_DIVIDER).forEach((function (prop) {
                                                var dividerInd = prop.indexOf(PAIRS_MARKER)
                                                    , key = prop.slice(0, dividerInd);
                                                if (isRequestProp(key)) {
                                                    var value = prop.slice(dividerInd + 1);
                                                    propsObj[key] = value
                                                } else
                                                    propsObj.url = prop
                                            }
                                            )),
                                            propsObj);
                                        if (data = parsedData,
                                            Object.values(data).every((function (value) {
                                                return function (input) {
                                                    var isValid, FORWARD_SLASH = "/", str = function (str) {
                                                        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                                                    }(input);
                                                    input[0] === FORWARD_SLASH && input[input.length - 1] === FORWARD_SLASH && (str = input.slice(1, -1));
                                                    try {
                                                        isValid = new RegExp(str),
                                                            isValid = !0
                                                    } catch (e) {
                                                        isValid = !1
                                                    }
                                                    return isValid
                                                }(value)
                                            }
                                            ))) {
                                            var matchData = function (data) {
                                                var matchData = {};
                                                return Object.keys(data).forEach((function (key) {
                                                    matchData[key] = toRegExp(data[key])
                                                }
                                                )),
                                                    matchData
                                            }(parsedData);
                                            isMatched = Object.keys(matchData).every((function (matchKey) {
                                                var matchValue = matchData[matchKey]
                                                    , dataValue = requestData[matchKey];
                                                return Object.prototype.hasOwnProperty.call(requestData, matchKey) && "string" == typeof dataValue && (null == matchValue ? void 0 : matchValue.test(dataValue))
                                            }
                                            ))
                                        } else
                                            logMessage(source, `Invalid parameter: ${propsToMatch}`),
                                                isMatched = !1;
                                        return isMatched
                                    }(source, propsToMatch, thisArg.__adshieldXhrData) || shouldLog) && (thisArg.xhrShouldBePruned = !0,
                                        thisArg.headersReceived = !!thisArg.headersReceived),
                                    thisArg.xhrShouldBePruned && !thisArg.headersReceived && (thisArg.headersReceived = !0,
                                        thisArg.collectedHeaders = [],
                                        thisArg.setRequestHeader = new Proxy(thisArg.setRequestHeader, setRequestHeaderHandler));
                                try { return Reflect.apply(target, thisArg, args); } catch (e) { console.warn('[AdShield] XHR open error:', e); return; }
                            }
                        }, sendHandler = {
                            apply: function (target, thisArg, args) {
                                var sendStartTime = performance.now();
                                var stackTrace = (new Error).stack || "";

                                // Use per-instance xhr metadata (prevents race conditions)
                                var xhrDataLocal = thisArg.__adshieldXhrData;

                                // Check if XHR is actually opened - if not, just pass through
                                if (thisArg.readyState !== 1) {
                                    window.__adshieldDebug && window.__adshieldDebug('XHR not in OPENED state, passing through. State:', thisArg.readyState);
                                    try { return Reflect.apply(target, thisArg, args); } catch (e) { return; }
                                }

                                if (!thisArg.xhrShouldBePruned || stack && !matchStackTrace(stack, stackTrace)) {
                                    try { return Reflect.apply(target, thisArg, args); } catch (e) { console.warn('[AdShield] XHR send passthrough error:', e); return; }
                                }

                                // ALWAYS LOG forged requests during debugging
                                console.log('[AdShield] XHR FORGED REQUEST START:', xhrDataLocal?.url?.substring(0, 80));

                                var forgedRequest = new XMLHttpRequest;
                                forgedRequest.addEventListener("readystatechange", (function () {
                                    if (4 === forgedRequest.readyState) {
                                        // DEBUG: Log forged request completion time
                                        var forgedTime = performance.now() - sendStartTime;
                                        console.log('[AdShield] XHR FORGED REQUEST DONE:', forgedTime.toFixed(0), 'ms, status:', forgedRequest.status, 'url:', xhrDataLocal?.url?.substring(0, 60));

                                        var { readyState: readyState, response: response, responseText: responseText, responseURL: responseURL, responseXML: responseXML, status: status, statusText: statusText } = forgedRequest
                                            , content = responseText || response;
                                        if ("string" == typeof content || "object" == typeof content) {
                                            var modifiedContent;
                                            if ("string" == typeof content)
                                                try {
                                                    var jsonContent = nativeParse(content);
                                                    if (shouldLog)
                                                        logMessage(source, `${window.location.hostname}\n${nativeStringify(jsonContent, null, 2)}\nStack trace:\n${stackTrace}`, !0),
                                                            logMessage(source, jsonContent, !0, !1),
                                                            modifiedContent = content;
                                                    else {
                                                        modifiedContent = function (source, root, prunePaths, requiredPaths, stack, nativeObjects) {
                                                            var { nativeStringify: nativeStringify } = nativeObjects;
                                                            if (0 === prunePaths.length && 0 === requiredPaths.length)
                                                                return logMessage(source, `${window.location.hostname}\n${nativeStringify(root, null, 2)}\nStack trace:\n${(new Error).stack}`, !0),
                                                                    root && "object" == typeof root && logMessage(source, root, !0, !1),
                                                                    root;
                                                            try {
                                                                if (!1 === function (source, root, prunePaths, requiredPaths, stack, nativeObjects) {
                                                                    if (!root)
                                                                        return !1;
                                                                    var shouldProcess, { nativeStringify: nativeStringify } = nativeObjects;
                                                                    if (0 === prunePaths.length && requiredPaths.length > 0) {
                                                                        var rootString = nativeStringify(root);
                                                                        if (toRegExp(requiredPaths.join("")).test(rootString))
                                                                            return logMessage(source, `${window.location.hostname}\n${nativeStringify(root, null, 2)}\nStack trace:\n${(new Error).stack}`, !0),
                                                                                root && "object" == typeof root && logMessage(source, root, !0, !1),
                                                                                shouldProcess = !1
                                                                    }
                                                                    if (stack && !matchStackTrace(stack, (new Error).stack || ""))
                                                                        return shouldProcess = !1;
                                                                    for (var _ret, wildcardSymbols = [".*.", "*.", ".*", ".[].", "[].", ".[]"], _loop = function () {
                                                                        var requiredPath = requiredPaths[i]
                                                                            , lastNestedPropName = requiredPath.split(".").pop()
                                                                            , hasWildcard = wildcardSymbols.some((function (symbol) {
                                                                                return requiredPath.includes(symbol)
                                                                            }
                                                                            ))
                                                                            , details = getWildcardPropertyInChain(root, requiredPath, hasWildcard);
                                                                        if (!details.length)
                                                                            return {
                                                                                v: shouldProcess = !1
                                                                            };
                                                                        shouldProcess = !hasWildcard;
                                                                        for (var j = 0; j < details.length; j += 1) {
                                                                            var hasRequiredProp = "string" == typeof lastNestedPropName && void 0 !== details[j].base[lastNestedPropName];
                                                                            shouldProcess = hasWildcard ? hasRequiredProp || shouldProcess : hasRequiredProp && shouldProcess
                                                                        }
                                                                    }, i = 0; i < requiredPaths.length; i += 1)
                                                                        if (_ret = _loop())
                                                                            return _ret.v;
                                                                    return shouldProcess
                                                                }(source, root, prunePaths, requiredPaths, stack, nativeObjects))
                                                                    return root;
                                                                prunePaths.forEach((function (path) {
                                                                    getWildcardPropertyInChain(root, path, !0).forEach((function (ownerObj) {
                                                                        void 0 !== ownerObj && ownerObj.base && (delete ownerObj.base[ownerObj.prop],
                                                                            hit(source))
                                                                    }
                                                                    ))
                                                                }
                                                                ))
                                                            } catch (e) {
                                                                logMessage(source, e)
                                                            }
                                                            return root
                                                        }(source, jsonContent, prunePaths, requiredPaths, stack = "", {
                                                            nativeStringify: nativeStringify
                                                        });
                                                        try {
                                                            var { responseType: responseType } = thisArg;
                                                            switch (responseType) {
                                                                case "":
                                                                case "text":
                                                                    modifiedContent = nativeStringify(modifiedContent);
                                                                    break;
                                                                case "arraybuffer":
                                                                    modifiedContent = (new TextEncoder).encode(nativeStringify(modifiedContent)).buffer;
                                                                    break;
                                                                case "blob":
                                                                    modifiedContent = new Blob([nativeStringify(modifiedContent)])
                                                            }
                                                        } catch (error) {
                                                            logMessage(source, `Response body cannot be converted to reponse type: '${content}'`),
                                                                modifiedContent = content
                                                        }
                                                    }
                                                } catch (error) {
                                                    logMessage(source, `Response body cannot be converted to json: '${content}'`),
                                                        modifiedContent = content
                                                }
                                            Object.defineProperties(thisArg, {
                                                readyState: {
                                                    value: readyState,
                                                    writable: !1
                                                },
                                                responseURL: {
                                                    value: responseURL,
                                                    writable: !1
                                                },
                                                responseXML: {
                                                    value: responseXML,
                                                    writable: !1
                                                },
                                                status: {
                                                    value: status,
                                                    writable: !1
                                                },
                                                statusText: {
                                                    value: statusText,
                                                    writable: !1
                                                },
                                                response: {
                                                    value: modifiedContent,
                                                    writable: !1
                                                },
                                                responseText: {
                                                    value: modifiedContent,
                                                    writable: !1
                                                }
                                            }),
                                                setTimeout((function () {
                                                    var stateEvent = new Event("readystatechange");
                                                    thisArg.dispatchEvent(stateEvent);
                                                    var loadEvent = new Event("load");
                                                    thisArg.dispatchEvent(loadEvent);
                                                    var loadEndEvent = new Event("loadend");
                                                    thisArg.dispatchEvent(loadEndEvent)
                                                }
                                                ), 1),
                                                hit(source)
                                        }
                                    }
                                }
                                )),
                                    nativeOpen.apply(forgedRequest, [xhrDataLocal.method, xhrDataLocal.url, Boolean(xhrDataLocal.async)]);
                                try {
                                    if (thisArg.collectedHeaders && thisArg.collectedHeaders.length) {
                                        thisArg.collectedHeaders.forEach((function (header) {
                                            try {
                                                forgedRequest.setRequestHeader(header[0], header[1])
                                            } catch (e) { }
                                        }));
                                    }
                                } catch (e) { }
                                thisArg.collectedHeaders = [];
                                try {
                                    nativeSend.call(forgedRequest, args)
                                } catch (_unused) {
                                    try { return Reflect.apply(target, thisArg, args); } catch (e) { return; }
                                }
                            }
                        };
                        if (window.__ADSHIELD_FLAGS.xhrProxy === true) {
                            XMLHttpRequest.prototype.open = new Proxy(XMLHttpRequest.prototype.open, openHandler),
                                XMLHttpRequest.prototype.send = new Proxy(XMLHttpRequest.prototype.send, sendHandler)
                        }
                    }
                }
                ).apply(this, updatedArgs),
                    source.uniqueId && Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: "done",
                        enumerable: !1,
                        writable: !1,
                        configurable: !1
                    })
            } catch (e) {
                console.log(e)
            }
        }
        )({
            "name": "json-prune-xhr-response",
            "args": ["playerResponse.adPlacements playerResponse.playerAds playerResponse.adSlots adPlacements playerAds adSlots", "", "/playlist\\?list=|\\/player(?!.*(get_drm_license))|watch\\?[tv]=|get_watch\\?/"]
        }, ["playerResponse.adPlacements playerResponse.playerAds playerResponse.adSlots adPlacements playerAds adSlots", "", "/playlist\\?list=|\\/player(?!.*(get_drm_license))|watch\\?[tv]=|get_watch\\?/"]);
        ; (function jsonPruneFetchResponse(source, args) {
            const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId && "done" === Window.prototype.toString[uniqueIdentifier])
                return;
            function hit(source) {
                window.postMessage({
                    source: 'YT_AD_CLEANER',
                    type: 'INCREMENT_COUNTER',
                    key: 'adBlockCount'
                }, '*');
                if (source.verbose) {
                    try {
                        var trace = console.trace.bind(console)
                            , label = "[ABY] ";
                        "corelibs" === source.engine ? label += source.ruleText : (source.domainName && (label += `${source.domainName}`),
                            source.args ? label += `#%#//scriptlet('${source.name}', '${source.args.join("', '")}')` : label += `#%#//scriptlet('${source.name}')`),
                            trace && trace(label)
                    } catch (e) { }
                    "function" == typeof window.__debug && window.__debug(source)
                }
            }
            function logMessage(source, message) {
                var forced = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                    , convertMessageToString = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
                    , { name: name, verbose: verbose } = source;
                if (forced || verbose) {
                    var nativeConsole = console.log;
                    convertMessageToString ? nativeConsole(`${name}: ${message}`) : nativeConsole(`${name}:`, message)
                }
            }
            function objectToString(obj) {
                return obj && "object" == typeof obj ? function (obj) {
                    return 0 === Object.keys(obj).length && !obj.prototype
                }(obj) ? "{}" : Object.entries(obj).map((function (pair) {
                    var key = pair[0]
                        , value = pair[1]
                        , recordValueStr = value;
                    return value instanceof Object && (recordValueStr = `{ ${objectToString(value)} }`),
                        `${key}:"${recordValueStr}"`
                }
                )).join(" ") : String(obj)
            }
            function getPrunePath(props) {
                return "string" == typeof props && void 0 !== props && "" !== props ? props.split(/ +/) : []
            }
            function toRegExp(rawInput) {
                var input = rawInput || "";
                if ("" === input)
                    return new RegExp(".?");
                var regExpStr, flagsStr, delimiterIndex = input.lastIndexOf("/"), flagsPart = input.substring(delimiterIndex + 1), regExpPart = input.substring(0, delimiterIndex + 1), flags = (flagsStr = flagsPart,
                    (regExpStr = regExpPart).startsWith("/") && regExpStr.endsWith("/") && !regExpStr.endsWith("\\/") && function (flag) {
                        if (!flag)
                            return !1;
                        try {
                            return new RegExp("", flag),
                                !0
                        } catch (ex) {
                            return !1
                        }
                    }(flagsStr) ? flagsStr : "");
                if (input.startsWith("/") && input.endsWith("/") || flags)
                    return new RegExp((flags ? regExpPart : input).slice(1, -1), flags);
                var escaped = input.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(escaped)
            }
            function getWildcardPropertyInChain(base, chain) {
                var lookThrough = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                    , output = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : []
                    , pos = chain.indexOf(".");
                if (-1 === pos) {
                    if ("*" === chain || "[]" === chain)
                        for (var key in base)
                            Object.prototype.hasOwnProperty.call(base, key) && output.push({
                                base: base,
                                prop: key
                            });
                    else
                        output.push({
                            base: base,
                            prop: chain
                        });
                    return output
                }
                var prop = chain.slice(0, pos);
                if ("[]" === prop && Array.isArray(base) || "*" === prop && base instanceof Object) {
                    var nextProp = chain.slice(pos + 1);
                    Object.keys(base).forEach((function (key) {
                        getWildcardPropertyInChain(base[key], nextProp, lookThrough, output)
                    }
                    ))
                }
                Array.isArray(base) && base.forEach((function (key) {
                    void 0 !== key && getWildcardPropertyInChain(key, chain, lookThrough, output)
                }
                ));
                var nextBase = base[prop];
                return chain = chain.slice(pos + 1),
                    void 0 !== nextBase && getWildcardPropertyInChain(nextBase, chain, lookThrough, output),
                    output
            }
            function restoreRegExpValues(array) {
                if (array.length)
                    try {
                        var stringPattern = "";
                        stringPattern = 1 === array.length ? `(${array[0]})` : array.reduce((function (accumulator, currentValue, currentIndex) {
                            return 1 === currentIndex ? `(${accumulator}),(${currentValue})` : `${accumulator},(${currentValue})`
                        }
                        ));
                        var regExpGroup = new RegExp(stringPattern);
                        array.toString().replace(regExpGroup, "")
                    } catch (error) {
                        var message = `Failed to restore RegExp values: ${error}`;
                        console.log(message)
                    }
            }
            const updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                (function (source, propsToRemove, obligatoryProps) {
                    var propsToMatch = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : ""
                        , stack = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : "";
                    if ("undefined" != typeof fetch && "undefined" != typeof Proxy && "undefined" != typeof Response) {
                        var prunePaths = getPrunePath(propsToRemove)
                            , requiredPaths = getPrunePath(obligatoryProps)
                            , nativeStringify = window.JSON.stringify
                            , nativeRequestClone = window.Request.prototype.clone
                            , nativeResponseClone = window.Response.prototype.clone
                            , nativeFetch = window.fetch
                            , fetchHandler = {
                                apply: async function (target, thisArg, args) {
                                    var startTime = performance.now();
                                    // BYPASS: Don't intercept YouTube API requests - let them pass through cleanly for SPA navigation
                                    try {
                                        var requestUrl = args[0] instanceof Request ? args[0].url : String(args[0]);
                                        // BYPASS most YouTube API traffic, but allow /youtubei/v1/player to be processed
                                        // so we can prune ad fields from the playerResponse.
                                        if ((requestUrl.includes('/youtubei/') && !requestUrl.includes('/youtubei/v1/player')) || requestUrl.includes('/api/stats/') || requestUrl.includes('/qoe') || requestUrl.includes('googlevideo.com')) {
                                            return nativeFetch.apply(null, args);
                                        }
                                    } catch (e) { }

                                    var elapsed = performance.now() - startTime;
                                    if (elapsed > 5) {
                                        console.warn('[AdShield] Fetch handler URL check slow:', elapsed.toFixed(1), 'ms');
                                    }

                                    var originalResponse, clonedResponse, json, fetchData = function (args, nativeRequestClone) {
                                        var fetchUrl, fetchInit, request, entries, fetchPropsObj = {}, resource = args[0];
                                        if (resource instanceof Request) {
                                            var realData = nativeRequestClone.call(resource)
                                                , requestData = (request = realData,
                                                    entries = ["url", "method", "headers", "body", "credentials", "cache", "redirect", "referrer", "referrerPolicy", "integrity", "keepalive", "signal", "mode"].map((function (key) {
                                                        return [key, request[key]]
                                                    }
                                                    )),
                                                    Object.fromEntries(entries));
                                            fetchUrl = requestData.url,
                                                fetchInit = requestData
                                        } else
                                            fetchUrl = resource,
                                                fetchInit = args[1];
                                        return fetchPropsObj.url = fetchUrl,
                                            fetchInit instanceof Object && Object.keys(fetchInit).forEach((function (prop) {
                                                fetchPropsObj[prop] = fetchInit[prop]
                                            }
                                            )),
                                            fetchPropsObj
                                    }(args, nativeRequestClone);
                                    if (!function (source, propsToMatch, requestData) {
                                        if ("" === propsToMatch || "*" === propsToMatch)
                                            return !0;
                                        var isMatched, PROPS_DIVIDER, PAIRS_MARKER, isRequestProp, propsObj, data, parsedData = (PROPS_DIVIDER = " ",
                                            PAIRS_MARKER = ":",
                                            isRequestProp = function (prop) {
                                                return ["url", "method", "headers", "body", "credentials", "cache", "redirect", "referrer", "referrerPolicy", "integrity", "keepalive", "signal", "mode"].includes(prop)
                                            }
                                            ,
                                            propsObj = {},
                                            propsToMatch.split(PROPS_DIVIDER).forEach((function (prop) {
                                                var dividerInd = prop.indexOf(PAIRS_MARKER)
                                                    , key = prop.slice(0, dividerInd);
                                                if (isRequestProp(key)) {
                                                    var value = prop.slice(dividerInd + 1);
                                                    propsObj[key] = value
                                                } else
                                                    propsObj.url = prop
                                            }
                                            )),
                                            propsObj);
                                        if (data = parsedData,
                                            Object.values(data).every((function (value) {
                                                return function (input) {
                                                    var isValid, FORWARD_SLASH = "/", str = function (str) {
                                                        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                                                    }(input);
                                                    input[0] === FORWARD_SLASH && input[input.length - 1] === FORWARD_SLASH && (str = input.slice(1, -1));
                                                    try {
                                                        isValid = new RegExp(str),
                                                            isValid = !0
                                                    } catch (e) {
                                                        isValid = !1
                                                    }
                                                    return isValid
                                                }(value)
                                            }
                                            ))) {
                                            var matchData = function (data) {
                                                var matchData = {};
                                                return Object.keys(data).forEach((function (key) {
                                                    matchData[key] = toRegExp(data[key])
                                                }
                                                )),
                                                    matchData
                                            }(parsedData);
                                            isMatched = Object.keys(matchData).every((function (matchKey) {
                                                var matchValue = matchData[matchKey]
                                                    , dataValue = requestData[matchKey];
                                                return Object.prototype.hasOwnProperty.call(requestData, matchKey) && "string" == typeof dataValue && (null == matchValue ? void 0 : matchValue.test(dataValue))
                                            }
                                            ))
                                        } else
                                            logMessage(source, `Invalid parameter: ${propsToMatch}`),
                                                isMatched = !1;
                                        return isMatched
                                    }(source, propsToMatch, fetchData))
                                        try { return Reflect.apply(target, thisArg, args); } catch (e) { return nativeFetch.apply(null, args); }
                                    try {
                                        originalResponse = await nativeFetch.apply(null, args),
                                            clonedResponse = nativeResponseClone.call(originalResponse)
                                    } catch (_unused) {
                                        logMessage(source, `Could not make an original fetch request: ${fetchData.url}`);
                                        try { return Reflect.apply(target, thisArg, args); } catch (e) { return nativeFetch.apply(null, args); }
                                    }
                                    try {
                                        json = await originalResponse.json()
                                    } catch (e) {
                                        var message = `Response body can't be converted to json: ${objectToString(fetchData)}`;
                                        return logMessage(source, message),
                                            clonedResponse
                                    }
                                    var modifiedJson = function (source, root, prunePaths, requiredPaths, stack, nativeObjects) {
                                        var { nativeStringify: nativeStringify } = nativeObjects;
                                        if (0 === prunePaths.length && 0 === requiredPaths.length)
                                            return logMessage(source, `${window.location.hostname}\n${nativeStringify(root, null, 2)}\nStack trace:\n${(new Error).stack}`, !0),
                                                root && "object" == typeof root && logMessage(source, root, !0, !1),
                                                root;
                                        try {
                                            if (!1 === function (source, root, prunePaths, requiredPaths, stack, nativeObjects) {
                                                if (!root)
                                                    return !1;
                                                var shouldProcess, { nativeStringify: nativeStringify } = nativeObjects;
                                                if (0 === prunePaths.length && requiredPaths.length > 0) {
                                                    var rootString = nativeStringify(root);
                                                    if (toRegExp(requiredPaths.join("")).test(rootString))
                                                        return logMessage(source, `${window.location.hostname}\n${nativeStringify(root, null, 2)}\nStack trace:\n${(new Error).stack}`, !0),
                                                            root && "object" == typeof root && logMessage(source, root, !0, !1),
                                                            shouldProcess = !1
                                                }
                                                if (stack && !function (stackMatch, stackTrace) {
                                                    if (!stackMatch || "" === stackMatch)
                                                        return !0;
                                                    var regExpValues = function () {
                                                        try {
                                                            for (var arrayOfRegexpValues = [], index = 1; index < 10; index += 1) {
                                                                var value = `$${index}`;
                                                                if (!RegExp[value])
                                                                    break;
                                                                arrayOfRegexpValues.push(RegExp[value])
                                                            }
                                                            return arrayOfRegexpValues
                                                        } catch (error) {
                                                            return []
                                                        }
                                                    }();
                                                    if (function (stackMatch, stackTrace) {
                                                        var INLINE_SCRIPT_STRING = "inlineScript"
                                                            , INJECTED_SCRIPT_STRING = "injectedScript"
                                                            , INJECTED_SCRIPT_MARKER = "<anonymous>"
                                                            , isInlineScript = function (match) {
                                                                return match.includes(INLINE_SCRIPT_STRING)
                                                            }
                                                            , isInjectedScript = function (match) {
                                                                return match.includes(INJECTED_SCRIPT_STRING)
                                                            };
                                                        if (!isInlineScript(stackMatch) && !isInjectedScript(stackMatch))
                                                            return !1;
                                                        var documentURL = window.location.href
                                                            , pos = documentURL.indexOf("#");
                                                        -1 !== pos && (documentURL = documentURL.slice(0, pos));
                                                        var stackLines = stackTrace.split("\n").slice(2).map((function (line) {
                                                            return line.trim()
                                                        }
                                                        )).map((function (line) {
                                                            var stack, getStackTraceValues = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(line);
                                                            if (getStackTraceValues) {
                                                                var _stackURL, _stackURL2, stackURL = getStackTraceValues[2], stackLine = getStackTraceValues[3], stackCol = getStackTraceValues[4];
                                                                if (null !== (_stackURL = stackURL) && void 0 !== _stackURL && _stackURL.startsWith("(") && (stackURL = stackURL.slice(1)),
                                                                    null !== (_stackURL2 = stackURL) && void 0 !== _stackURL2 && _stackURL2.startsWith(INJECTED_SCRIPT_MARKER)) {
                                                                    var _stackFunction;
                                                                    stackURL = INJECTED_SCRIPT_STRING;
                                                                    var stackFunction = void 0 !== getStackTraceValues[1] ? getStackTraceValues[1].slice(0, -1) : line.slice(0, getStackTraceValues.index).trim();
                                                                    null !== (_stackFunction = stackFunction) && void 0 !== _stackFunction && _stackFunction.startsWith("at") && (stackFunction = stackFunction.slice(2).trim()),
                                                                        stack = `${stackFunction} ${stackURL}${stackLine}${stackCol}`.trim()
                                                                } else
                                                                    stack = stackURL === documentURL ? `${INLINE_SCRIPT_STRING}${stackLine}${stackCol}`.trim() : `${stackURL}${stackLine}${stackCol}`.trim()
                                                            } else
                                                                stack = line;
                                                            return stack
                                                        }
                                                        ));
                                                        if (stackLines)
                                                            for (var index = 0; index < stackLines.length; index += 1) {
                                                                if (isInlineScript(stackMatch) && stackLines[index].startsWith(INLINE_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                                                    return !0;
                                                                if (isInjectedScript(stackMatch) && stackLines[index].startsWith(INJECTED_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                                                    return !0
                                                            }
                                                        return !1
                                                    }(stackMatch, stackTrace))
                                                        return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                                            !0;
                                                    var stackRegexp = toRegExp(stackMatch)
                                                        , refinedStackTrace = stackTrace.split("\n").slice(2).map((function (line) {
                                                            return line.trim()
                                                        }
                                                        )).join("\n");
                                                    return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                                        function () {
                                                            var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, "test")
                                                                , nativeRegexTest = null == descriptor ? void 0 : descriptor.value;
                                                            if (descriptor && "function" == typeof descriptor.value)
                                                                return nativeRegexTest;
                                                            throw new Error("RegExp.prototype.test is not a function")
                                                        }().call(stackRegexp, refinedStackTrace)
                                                }(stack, (new Error).stack || ""))
                                                    return shouldProcess = !1;
                                                for (var _ret, wildcardSymbols = [".*.", "*.", ".*", ".[].", "[].", ".[]"], _loop = function () {
                                                    var requiredPath = requiredPaths[i]
                                                        , lastNestedPropName = requiredPath.split(".").pop()
                                                        , hasWildcard = wildcardSymbols.some((function (symbol) {
                                                            return requiredPath.includes(symbol)
                                                        }
                                                        ))
                                                        , details = getWildcardPropertyInChain(root, requiredPath, hasWildcard);
                                                    if (!details.length)
                                                        return {
                                                            v: shouldProcess = !1
                                                        };
                                                    shouldProcess = !hasWildcard;
                                                    for (var j = 0; j < details.length; j += 1) {
                                                        var hasRequiredProp = "string" == typeof lastNestedPropName && void 0 !== details[j].base[lastNestedPropName];
                                                        shouldProcess = hasWildcard ? hasRequiredProp || shouldProcess : hasRequiredProp && shouldProcess
                                                    }
                                                }, i = 0; i < requiredPaths.length; i += 1)
                                                    if (_ret = _loop())
                                                        return _ret.v;
                                                return shouldProcess
                                            }(source, root, prunePaths, requiredPaths, stack, nativeObjects))
                                                return root;
                                            prunePaths.forEach((function (path) {
                                                getWildcardPropertyInChain(root, path, !0).forEach((function (ownerObj) {
                                                    void 0 !== ownerObj && ownerObj.base && (delete ownerObj.base[ownerObj.prop],
                                                        hit(source))
                                                }
                                                ))
                                            }
                                            ))
                                        } catch (e) {
                                            logMessage(source, e)
                                        }
                                        return root
                                    }(source, json, prunePaths, requiredPaths, stack, {
                                        nativeStringify: nativeStringify,
                                        nativeRequestClone: nativeRequestClone,
                                        nativeResponseClone: nativeResponseClone,
                                        nativeFetch: nativeFetch
                                    })
                                        , forgedResponse = function (response, textContent) {
                                            var { bodyUsed: bodyUsed, headers: headers, ok: ok, redirected: redirected, status: status, statusText: statusText, type: type, url: url } = response
                                                , forgedResponse = new Response(textContent, {
                                                    status: status,
                                                    statusText: statusText,
                                                    headers: headers
                                                });
                                            return Object.defineProperties(forgedResponse, {
                                                url: {
                                                    value: url
                                                },
                                                type: {
                                                    value: type
                                                },
                                                ok: {
                                                    value: ok
                                                },
                                                bodyUsed: {
                                                    value: bodyUsed
                                                },
                                                redirected: {
                                                    value: redirected
                                                }
                                            }),
                                                forgedResponse
                                        }(originalResponse, nativeStringify(modifiedJson));
                                    return hit(source),
                                        forgedResponse
                                }
                            };
                        if (window.__ADSHIELD_FLAGS.fetchProxy === true) {
                            window.fetch = new Proxy(window.fetch, fetchHandler)
                        }
                    }
                }
                ).apply(this, updatedArgs),
                    source.uniqueId && Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: "done",
                        enumerable: !1,
                        writable: !1,
                        configurable: !1
                    })
            } catch (e) {
                console.log(e)
            }
        }
        )({
            "name": "json-prune-fetch-response",
            "args": ["playerResponse.adPlacements playerResponse.playerAds playerResponse.adSlots adPlacements playerAds adSlots", "", "/playlist\\?list=|player\\?|watch\\?[tv]=|get_watch\\?/"]
        }, ["playerResponse.adPlacements playerResponse.playerAds playerResponse.adSlots adPlacements playerAds adSlots", "", "/playlist\\?list=|player\\?|watch\\?[tv]=|get_watch\\?/"]);
        ; (function adjustSetTimeout(source, args) {
            const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId && "done" === Window.prototype.toString[uniqueIdentifier])
                return;
            function nativeIsNaN(num) {
                return (Number.isNaN || window.isNaN)(num)
            }
            const updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                (function (source, matchCallback, matchDelay, boost) {
                    var nativeSetTimeout = window.setTimeout
                        , matchRegexp = function (rawInput) {
                            var input = rawInput || ""
                                , FORWARD_SLASH = "/";
                            if ("" === input)
                                return new RegExp(".?");
                            var regExpStr, flagsStr, delimiterIndex = input.lastIndexOf(FORWARD_SLASH), flagsPart = input.substring(delimiterIndex + 1), regExpPart = input.substring(0, delimiterIndex + 1), isValidRegExpFlag = function (flag) {
                                if (!flag)
                                    return !1;
                                try {
                                    return new RegExp("", flag),
                                        !0
                                } catch (ex) {
                                    return !1
                                }
                            }, flags = (flagsStr = flagsPart,
                                (regExpStr = regExpPart).startsWith(FORWARD_SLASH) && regExpStr.endsWith(FORWARD_SLASH) && !regExpStr.endsWith("\\/") && isValidRegExpFlag(flagsStr) ? flagsStr : "");
                            if (input.startsWith(FORWARD_SLASH) && input.endsWith(FORWARD_SLASH) || flags)
                                return new RegExp((flags ? regExpPart : input).slice(1, -1), flags);
                            var escaped = input.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                            return new RegExp(escaped)
                        }(matchCallback);
                    window.setTimeout = function (callback, delay) {
                        if (function (callback) {
                            return callback instanceof Function || "string" == typeof callback
                        }(callback))
                            matchRegexp.test(callback.toString()) && (realDelay = delay,
                                function (delay) {
                                    return "*" === delay
                                }(inputDelay = matchDelay) || realDelay === function (delay) {
                                    var DEFAULT_DELAY = 1e3
                                        , parsedDelay = parseInt(delay, 10);
                                    return nativeIsNaN(parsedDelay) ? DEFAULT_DELAY : parsedDelay
                                }(inputDelay)) && (delay *= function (boost) {
                                    var num, DEFAULT_MULTIPLIER = .05, MIN_MULTIPLIER = .001, MAX_MULTIPLIER = 50, parsedBoost = parseFloat(boost), boostMultiplier = nativeIsNaN(parsedBoost) || (num = parsedBoost,
                                        !(Number.isFinite || window.isFinite)(num)) ? DEFAULT_MULTIPLIER : parsedBoost;
                                    return boostMultiplier < MIN_MULTIPLIER && (boostMultiplier = MIN_MULTIPLIER),
                                        boostMultiplier > MAX_MULTIPLIER && (boostMultiplier = MAX_MULTIPLIER),
                                        boostMultiplier
                                }(boost),
                                    function (source) {
                                        var ABY_PREFIX = "[ABY]";
                                        if (source.verbose) {
                                            try {
                                                var trace = console.trace.bind(console)
                                                    , label = `${ABY_PREFIX} `;
                                                "corelibs" === source.engine ? label += source.ruleText : (source.domainName && (label += `${source.domainName}`),
                                                    source.args ? label += `#%#//scriptlet('${source.name}', '${source.args.join("', '")}')` : label += `#%#//scriptlet('${source.name}')`),
                                                    trace && trace(label)
                                            } catch (e) { }
                                            "function" == typeof window.__debug && window.__debug(source)
                                        }
                                    }(source));
                        else {
                            var message = `Scriptlet can't be applied because of invalid callback: '${String(callback)}'`;
                            !function (source, message) {
                                var forced = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                                    , convertMessageToString = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
                                    , { name: name, verbose: verbose } = source;
                                if (forced || verbose) {
                                    var nativeConsole = console.log;
                                    convertMessageToString ? nativeConsole(`${name}: ${message}`) : nativeConsole(`${name}:`, message)
                                }
                            }(source, message)
                        }
                        for (var inputDelay, realDelay, _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++)
                            args[_key - 2] = arguments[_key];
                        return nativeSetTimeout.apply(window, [callback, delay, ...args])
                    }
                }
                ).apply(this, updatedArgs),
                    source.uniqueId && Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: "done",
                        enumerable: !1,
                        writable: !1,
                        configurable: !1
                    })
            } catch (e) {
                console.log(e)
            }
        }
        )({
            "name": "adjust-setTimeout",
            "args": ["__DISABLED_ADSHIELD_NOOP__", "17000", "1"]
        }, ["__DISABLED_ADSHIELD_NOOP__", "17000", "1"]);
        // DISABLED: This was speeding up 17000ms timers (boost 0.001), which can break YouTube SPA navigation.
        ; (function trustedReplaceOutboundText(source, args) {
            const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId && "done" === Window.prototype.toString[uniqueIdentifier])
                return;
            function getPropertyInChain(base, chain) {
                var pos = chain.indexOf(".");
                if (-1 === pos)
                    return {
                        base: base,
                        prop: chain
                    };
                var prop = chain.slice(0, pos);
                if (null === base)
                    return {
                        base: base,
                        prop: prop,
                        chain: chain
                    };
                var obj, nextBase = base[prop];
                return chain = chain.slice(pos + 1),
                    (base instanceof Object || "object" == typeof base) && (obj = base,
                        0 === Object.keys(obj).length && !obj.prototype) || null === nextBase ? {
                        base: base,
                        prop: prop,
                        chain: chain
                    } : void 0 !== nextBase ? getPropertyInChain(nextBase, chain) : (Object.defineProperty(base, prop, {
                        configurable: !0
                    }),
                    {
                        base: base,
                        prop: prop,
                        chain: chain
                    })
            }
            function logMessage(source, message) {
                var forced = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                    , convertMessageToString = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
                    , { name: name, verbose: verbose } = source;
                if (forced || verbose) {
                    var nativeConsole = console.log;
                    convertMessageToString ? nativeConsole(`${name}: ${message}`) : nativeConsole(`${name}:`, message)
                }
            }
            function toRegExp(rawInput) {
                var input = rawInput || "";
                if ("" === input)
                    return new RegExp(".?");
                var regExpStr, flagsStr, delimiterIndex = input.lastIndexOf("/"), flagsPart = input.substring(delimiterIndex + 1), regExpPart = input.substring(0, delimiterIndex + 1), flags = (flagsStr = flagsPart,
                    (regExpStr = regExpPart).startsWith("/") && regExpStr.endsWith("/") && !regExpStr.endsWith("\\/") && function (flag) {
                        if (!flag)
                            return !1;
                        try {
                            return new RegExp("", flag),
                                !0
                        } catch (ex) {
                            return !1
                        }
                    }(flagsStr) ? flagsStr : "");
                if (input.startsWith("/") && input.endsWith("/") || flags)
                    return new RegExp((flags ? regExpPart : input).slice(1, -1), flags);
                var escaped = input.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(escaped)
            }
            function restoreRegExpValues(array) {
                if (array.length)
                    try {
                        var stringPattern = "";
                        stringPattern = 1 === array.length ? `(${array[0]})` : array.reduce((function (accumulator, currentValue, currentIndex) {
                            return 1 === currentIndex ? `(${accumulator}),(${currentValue})` : `${accumulator},(${currentValue})`
                        }
                        ));
                        var regExpGroup = new RegExp(stringPattern);
                        array.toString().replace(regExpGroup, "")
                    } catch (error) {
                        var message = `Failed to restore RegExp values: ${error}`;
                        console.log(message)
                    }
            }
            const updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                (function (source, methodPath) {
                    var textToReplace = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : ""
                        , replacement = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : ""
                        , decodeMethod = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : ""
                        , stack = arguments.length > 5 && void 0 !== arguments[5] ? arguments[5] : ""
                        , logContent = arguments.length > 6 && void 0 !== arguments[6] ? arguments[6] : "";
                    if (methodPath) {
                        var getPathParts = getPropertyInChain
                            , { base: base, chain: chain, prop: prop } = getPathParts(window, methodPath);
                        if (void 0 === chain) {
                            var nativeMethod = base[prop];
                            if (nativeMethod && "function" == typeof nativeMethod) {
                                var decodeAndReplaceContent = function (content, pattern, textReplacement, decode, log) {
                                    if ("base64" === decode)
                                        try {
                                            if (!function (str) {
                                                try {
                                                    if ("" === str)
                                                        return !1;
                                                    var decodedString = atob(str)
                                                        , encodedString = btoa(decodedString)
                                                        , stringWithoutPadding = str.replace(/=+$/, "");
                                                    return encodedString.replace(/=+$/, "") === stringWithoutPadding
                                                } catch (e) {
                                                    return !1
                                                }
                                            }(content))
                                                return logMessage(source, `Text content is not a valid base64 encoded string: ${content}`),
                                                    content;
                                            var decodedContent = atob(content);
                                            log && logMessage(source, `Decoded text content: ${decodedContent}`);
                                            var modifiedContent = textToReplace ? decodedContent.replace(pattern, textReplacement) : decodedContent;
                                            return log && logMessage(source, modifiedContent !== decodedContent ? `Modified decoded text content: ${modifiedContent}` : "Decoded text content was not modified"),
                                                btoa(modifiedContent)
                                        } catch (e) {
                                            return content
                                        }
                                    return content.replace(pattern, textReplacement)
                                }
                                    , logOriginalContent = !textToReplace || !!logContent
                                    , logModifiedContent = !!logContent
                                    , logDecodedContent = !!decodeMethod && !!logContent
                                    , isMatchingSuspended = !1
                                    , objectHandler = {
                                        apply: function (target, thisArg, argumentsList) {
                                            if (isMatchingSuspended)
                                                return Reflect.apply(target, thisArg, argumentsList);
                                            isMatchingSuspended = !0,
                                                function (source) {
                                                    var ABY_PREFIX = "[ABY]";
                                                    if (source.verbose) {
                                                        try {
                                                            var trace = console.trace.bind(console)
                                                                , label = `${ABY_PREFIX} `;
                                                            "corelibs" === source.engine ? label += source.ruleText : (source.domainName && (label += `${source.domainName}`),
                                                                source.args ? label += `#%#//scriptlet('${source.name}', '${source.args.join("', '")}')` : label += `#%#//scriptlet('${source.name}')`),
                                                                trace && trace(label)
                                                        } catch (e) { }
                                                        "function" == typeof window.__debug && window.__debug(source)
                                                    }
                                                }(source);
                                            var result = Reflect.apply(target, thisArg, argumentsList);
                                            if (stack && !function (stackMatch, stackTrace) {
                                                if (!stackMatch || "" === stackMatch)
                                                    return !0;
                                                var regExpValues = function () {
                                                    try {
                                                        for (var arrayOfRegexpValues = [], index = 1; index < 10; index += 1) {
                                                            var value = `$${index}`;
                                                            if (!RegExp[value])
                                                                break;
                                                            arrayOfRegexpValues.push(RegExp[value])
                                                        }
                                                        return arrayOfRegexpValues
                                                    } catch (error) {
                                                        return []
                                                    }
                                                }();
                                                if (function (stackMatch, stackTrace) {
                                                    var INLINE_SCRIPT_STRING = "inlineScript"
                                                        , INJECTED_SCRIPT_STRING = "injectedScript"
                                                        , INJECTED_SCRIPT_MARKER = "<anonymous>"
                                                        , isInlineScript = function (match) {
                                                            return match.includes(INLINE_SCRIPT_STRING)
                                                        }
                                                        , isInjectedScript = function (match) {
                                                            return match.includes(INJECTED_SCRIPT_STRING)
                                                        };
                                                    if (!isInlineScript(stackMatch) && !isInjectedScript(stackMatch))
                                                        return !1;
                                                    var documentURL = window.location.href
                                                        , pos = documentURL.indexOf("#");
                                                    -1 !== pos && (documentURL = documentURL.slice(0, pos));
                                                    var stackLines = stackTrace.split("\n").slice(2).map((function (line) {
                                                        return line.trim()
                                                    }
                                                    )).map((function (line) {
                                                        var stack, getStackTraceValues = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(line);
                                                        if (getStackTraceValues) {
                                                            var _stackURL, _stackURL2, stackURL = getStackTraceValues[2], stackLine = getStackTraceValues[3], stackCol = getStackTraceValues[4];
                                                            if (null !== (_stackURL = stackURL) && void 0 !== _stackURL && _stackURL.startsWith("(") && (stackURL = stackURL.slice(1)),
                                                                null !== (_stackURL2 = stackURL) && void 0 !== _stackURL2 && _stackURL2.startsWith(INJECTED_SCRIPT_MARKER)) {
                                                                var _stackFunction;
                                                                stackURL = INJECTED_SCRIPT_STRING;
                                                                var stackFunction = void 0 !== getStackTraceValues[1] ? getStackTraceValues[1].slice(0, -1) : line.slice(0, getStackTraceValues.index).trim();
                                                                null !== (_stackFunction = stackFunction) && void 0 !== _stackFunction && _stackFunction.startsWith("at") && (stackFunction = stackFunction.slice(2).trim()),
                                                                    stack = `${stackFunction} ${stackURL}${stackLine}${stackCol}`.trim()
                                                            } else
                                                                stack = stackURL === documentURL ? `${INLINE_SCRIPT_STRING}${stackLine}${stackCol}`.trim() : `${stackURL}${stackLine}${stackCol}`.trim()
                                                        } else
                                                            stack = line;
                                                        return stack
                                                    }
                                                    ));
                                                    if (stackLines)
                                                        for (var index = 0; index < stackLines.length; index += 1) {
                                                            if (isInlineScript(stackMatch) && stackLines[index].startsWith(INLINE_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                                                return !0;
                                                            if (isInjectedScript(stackMatch) && stackLines[index].startsWith(INJECTED_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                                                return !0
                                                        }
                                                    return !1
                                                }(stackMatch, stackTrace))
                                                    return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                                        !0;
                                                var stackRegexp = toRegExp(stackMatch)
                                                    , refinedStackTrace = stackTrace.split("\n").slice(2).map((function (line) {
                                                        return line.trim()
                                                    }
                                                    )).join("\n");
                                                return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                                    function () {
                                                        var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, "test")
                                                            , nativeRegexTest = null == descriptor ? void 0 : descriptor.value;
                                                        if (descriptor && "function" == typeof descriptor.value)
                                                            return nativeRegexTest;
                                                        throw new Error("RegExp.prototype.test is not a function")
                                                    }().call(stackRegexp, refinedStackTrace)
                                            }(stack, (new Error).stack || ""))
                                                return result;
                                            if ("string" == typeof result) {
                                                logOriginalContent && logMessage(source, `Original text content: ${result}`);
                                                var patternRegexp = toRegExp(textToReplace)
                                                    , modifiedContent = textToReplace || logDecodedContent ? decodeAndReplaceContent(result, patternRegexp, replacement, decodeMethod, logContent) : result;
                                                return logModifiedContent && logMessage(source, modifiedContent !== result ? `Modified text content: ${modifiedContent}` : "Text content was not modified"),
                                                    isMatchingSuspended = !1,
                                                    modifiedContent
                                            }
                                            return isMatchingSuspended = !1,
                                                logMessage(source, "Content is not a string"),
                                                result
                                        }
                                    };
                                base[prop] = new Proxy(nativeMethod, objectHandler)
                            } else
                                logMessage(source, `Could not retrieve the method: ${methodPath}`)
                        } else
                            logMessage(source, `Could not reach the end of the prop chain: ${methodPath}`)
                    }
                }
                ).apply(this, updatedArgs),
                    source.uniqueId && Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: "done",
                        enumerable: !1,
                        writable: !1,
                        configurable: !1
                    })
            } catch (e) {
                console.log(e)
            }
        }
        )({
            "name": "trusted-replace-outbound-text",
            "args": ["JSON.stringify", "__DISABLED_ADSHIELD_NOOP__", "__DISABLED_ADSHIELD_NOOP__"]
        }, ["JSON.stringify", "__DISABLED_ADSHIELD_NOOP__", "__DISABLED_ADSHIELD_NOOP__"]);
        // DISABLED: This was replacing "clientScreen":"WATCH" with "ADUNIT" globally via JSON.stringify, breaking SPA navigation
        ; (function trustedReplaceOutboundText(source, args) {
            const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId && "done" === Window.prototype.toString[uniqueIdentifier])
                return;
            function getPropertyInChain(base, chain) {
                var pos = chain.indexOf(".");
                if (-1 === pos)
                    return {
                        base: base,
                        prop: chain
                    };
                var prop = chain.slice(0, pos);
                if (null === base)
                    return {
                        base: base,
                        prop: prop,
                        chain: chain
                    };
                var obj, nextBase = base[prop];
                return chain = chain.slice(pos + 1),
                    (base instanceof Object || "object" == typeof base) && (obj = base,
                        0 === Object.keys(obj).length && !obj.prototype) || null === nextBase ? {
                        base: base,
                        prop: prop,
                        chain: chain
                    } : void 0 !== nextBase ? getPropertyInChain(nextBase, chain) : (Object.defineProperty(base, prop, {
                        configurable: !0
                    }),
                    {
                        base: base,
                        prop: prop,
                        chain: chain
                    })
            }
            function logMessage(source, message) {
                var forced = arguments.length > 2 && void 0 !== arguments[2] && arguments[2]
                    , convertMessageToString = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3]
                    , { name: name, verbose: verbose } = source;
                if (forced || verbose) {
                    var nativeConsole = console.log;
                    convertMessageToString ? nativeConsole(`${name}: ${message}`) : nativeConsole(`${name}:`, message)
                }
            }
            function toRegExp(rawInput) {
                var input = rawInput || "";
                if ("" === input)
                    return new RegExp(".?");
                var regExpStr, flagsStr, delimiterIndex = input.lastIndexOf("/"), flagsPart = input.substring(delimiterIndex + 1), regExpPart = input.substring(0, delimiterIndex + 1), flags = (flagsStr = flagsPart,
                    (regExpStr = regExpPart).startsWith("/") && regExpStr.endsWith("/") && !regExpStr.endsWith("\\/") && function (flag) {
                        if (!flag)
                            return !1;
                        try {
                            return new RegExp("", flag),
                                !0
                        } catch (ex) {
                            return !1
                        }
                    }(flagsStr) ? flagsStr : "");
                if (input.startsWith("/") && input.endsWith("/") || flags)
                    return new RegExp((flags ? regExpPart : input).slice(1, -1), flags);
                var escaped = input.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(escaped)
            }
            function restoreRegExpValues(array) {
                if (array.length)
                    try {
                        var stringPattern = "";
                        stringPattern = 1 === array.length ? `(${array[0]})` : array.reduce((function (accumulator, currentValue, currentIndex) {
                            return 1 === currentIndex ? `(${accumulator}),(${currentValue})` : `${accumulator},(${currentValue})`
                        }
                        ));
                        var regExpGroup = new RegExp(stringPattern);
                        array.toString().replace(regExpGroup, "")
                    } catch (error) {
                        var message = `Failed to restore RegExp values: ${error}`;
                        console.log(message)
                    }
            }
            const updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                (function (source, methodPath) {
                    var textToReplace = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : ""
                        , replacement = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : ""
                        , decodeMethod = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : ""
                        , stack = arguments.length > 5 && void 0 !== arguments[5] ? arguments[5] : ""
                        , logContent = arguments.length > 6 && void 0 !== arguments[6] ? arguments[6] : "";
                    if (methodPath) {
                        var getPathParts = getPropertyInChain
                            , { base: base, chain: chain, prop: prop } = getPathParts(window, methodPath);
                        if (void 0 === chain) {
                            var nativeMethod = base[prop];
                            if (nativeMethod && "function" == typeof nativeMethod) {
                                var decodeAndReplaceContent = function (content, pattern, textReplacement, decode, log) {
                                    if ("base64" === decode)
                                        try {
                                            if (!function (str) {
                                                try {
                                                    if ("" === str)
                                                        return !1;
                                                    var decodedString = atob(str)
                                                        , encodedString = btoa(decodedString)
                                                        , stringWithoutPadding = str.replace(/=+$/, "");
                                                    return encodedString.replace(/=+$/, "") === stringWithoutPadding
                                                } catch (e) {
                                                    return !1
                                                }
                                            }(content))
                                                return logMessage(source, `Text content is not a valid base64 encoded string: ${content}`),
                                                    content;
                                            var decodedContent = atob(content);
                                            log && logMessage(source, `Decoded text content: ${decodedContent}`);
                                            var modifiedContent = textToReplace ? decodedContent.replace(pattern, textReplacement) : decodedContent;
                                            return log && logMessage(source, modifiedContent !== decodedContent ? `Modified decoded text content: ${modifiedContent}` : "Decoded text content was not modified"),
                                                btoa(modifiedContent)
                                        } catch (e) {
                                            return content
                                        }
                                    return content.replace(pattern, textReplacement)
                                }
                                    , logOriginalContent = !textToReplace || !!logContent
                                    , logModifiedContent = !!logContent
                                    , logDecodedContent = !!decodeMethod && !!logContent
                                    , isMatchingSuspended = !1
                                    , objectHandler = {
                                        apply: function (target, thisArg, argumentsList) {
                                            if (isMatchingSuspended)
                                                return Reflect.apply(target, thisArg, argumentsList);
                                            isMatchingSuspended = !0,
                                                function (source) {
                                                    var ABY_PREFIX = "[ABY]";
                                                    if (source.verbose) {
                                                        try {
                                                            var trace = console.trace.bind(console)
                                                                , label = `${ABY_PREFIX} `;
                                                            "corelibs" === source.engine ? label += source.ruleText : (source.domainName && (label += `${source.domainName}`),
                                                                source.args ? label += `#%#//scriptlet('${source.name}', '${source.args.join("', '")}')` : label += `#%#//scriptlet('${source.name}')`),
                                                                trace && trace(label)
                                                        } catch (e) { }
                                                        "function" == typeof window.__debug && window.__debug(source)
                                                    }
                                                }(source);
                                            var result = Reflect.apply(target, thisArg, argumentsList);
                                            if (stack && !function (stackMatch, stackTrace) {
                                                if (!stackMatch || "" === stackMatch)
                                                    return !0;
                                                var regExpValues = function () {
                                                    try {
                                                        for (var arrayOfRegexpValues = [], index = 1; index < 10; index += 1) {
                                                            var value = `$${index}`;
                                                            if (!RegExp[value])
                                                                break;
                                                            arrayOfRegexpValues.push(RegExp[value])
                                                        }
                                                        return arrayOfRegexpValues
                                                    } catch (error) {
                                                        return []
                                                    }
                                                }();
                                                if (function (stackMatch, stackTrace) {
                                                    var INLINE_SCRIPT_STRING = "inlineScript"
                                                        , INJECTED_SCRIPT_STRING = "injectedScript"
                                                        , INJECTED_SCRIPT_MARKER = "<anonymous>"
                                                        , isInlineScript = function (match) {
                                                            return match.includes(INLINE_SCRIPT_STRING)
                                                        }
                                                        , isInjectedScript = function (match) {
                                                            return match.includes(INJECTED_SCRIPT_STRING)
                                                        };
                                                    if (!isInlineScript(stackMatch) && !isInjectedScript(stackMatch))
                                                        return !1;
                                                    var documentURL = window.location.href
                                                        , pos = documentURL.indexOf("#");
                                                    -1 !== pos && (documentURL = documentURL.slice(0, pos));
                                                    var stackLines = stackTrace.split("\n").slice(2).map((function (line) {
                                                        return line.trim()
                                                    }
                                                    )).map((function (line) {
                                                        var stack, getStackTraceValues = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(line);
                                                        if (getStackTraceValues) {
                                                            var _stackURL, _stackURL2, stackURL = getStackTraceValues[2], stackLine = getStackTraceValues[3], stackCol = getStackTraceValues[4];
                                                            if (null !== (_stackURL = stackURL) && void 0 !== _stackURL && _stackURL.startsWith("(") && (stackURL = stackURL.slice(1)),
                                                                null !== (_stackURL2 = stackURL) && void 0 !== _stackURL2 && _stackURL2.startsWith(INJECTED_SCRIPT_MARKER)) {
                                                                var _stackFunction;
                                                                stackURL = INJECTED_SCRIPT_STRING;
                                                                var stackFunction = void 0 !== getStackTraceValues[1] ? getStackTraceValues[1].slice(0, -1) : line.slice(0, getStackTraceValues.index).trim();
                                                                null !== (_stackFunction = stackFunction) && void 0 !== _stackFunction && _stackFunction.startsWith("at") && (stackFunction = stackFunction.slice(2).trim()),
                                                                    stack = `${stackFunction} ${stackURL}${stackLine}${stackCol}`.trim()
                                                            } else
                                                                stack = stackURL === documentURL ? `${INLINE_SCRIPT_STRING}${stackLine}${stackCol}`.trim() : `${stackURL}${stackLine}${stackCol}`.trim()
                                                        } else
                                                            stack = line;
                                                        return stack
                                                    }
                                                    ));
                                                    if (stackLines)
                                                        for (var index = 0; index < stackLines.length; index += 1) {
                                                            if (isInlineScript(stackMatch) && stackLines[index].startsWith(INLINE_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                                                return !0;
                                                            if (isInjectedScript(stackMatch) && stackLines[index].startsWith(INJECTED_SCRIPT_STRING) && stackLines[index].match(toRegExp(stackMatch)))
                                                                return !0
                                                        }
                                                    return !1
                                                }(stackMatch, stackTrace))
                                                    return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                                        !0;
                                                var stackRegexp = toRegExp(stackMatch)
                                                    , refinedStackTrace = stackTrace.split("\n").slice(2).map((function (line) {
                                                        return line.trim()
                                                    }
                                                    )).join("\n");
                                                return regExpValues.length && regExpValues[0] !== RegExp.$1 && restoreRegExpValues(regExpValues),
                                                    function () {
                                                        var descriptor = Object.getOwnPropertyDescriptor(RegExp.prototype, "test")
                                                            , nativeRegexTest = null == descriptor ? void 0 : descriptor.value;
                                                        if (descriptor && "function" == typeof descriptor.value)
                                                            return nativeRegexTest;
                                                        throw new Error("RegExp.prototype.test is not a function")
                                                    }().call(stackRegexp, refinedStackTrace)
                                            }(stack, (new Error).stack || ""))
                                                return result;
                                            if ("string" == typeof result) {
                                                logOriginalContent && logMessage(source, `Original text content: ${result}`);
                                                var patternRegexp = toRegExp(textToReplace)
                                                    , modifiedContent = textToReplace || logDecodedContent ? decodeAndReplaceContent(result, patternRegexp, replacement, decodeMethod, logContent) : result;
                                                return logModifiedContent && logMessage(source, modifiedContent !== result ? `Modified text content: ${modifiedContent}` : "Text content was not modified"),
                                                    isMatchingSuspended = !1,
                                                    modifiedContent
                                            }
                                            return isMatchingSuspended = !1,
                                                logMessage(source, "Content is not a string"),
                                                result
                                        }
                                    };
                                base[prop] = new Proxy(nativeMethod, objectHandler)
                            } else
                                logMessage(source, `Could not retrieve the method: ${methodPath}`)
                        } else
                            logMessage(source, `Could not reach the end of the prop chain: ${methodPath}`)
                    }
                }
                ).apply(this, updatedArgs),
                    source.uniqueId && Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: "done",
                        enumerable: !1,
                        writable: !1,
                        configurable: !1
                    })
            } catch (e) {
                console.log(e)
            }
        }
        )({
            "name": "trusted-replace-outbound-text",
            "args": ["JSON.stringify", "__DISABLED_ADSHIELD_NOOP_2__", "__DISABLED_ADSHIELD_NOOP_2__"]
        }, ["JSON.stringify", "__DISABLED_ADSHIELD_NOOP_2__", "__DISABLED_ADSHIELD_NOOP_2__"]);
        // DISABLED: This was injecting clientScreen:ADUNIT via JSON.stringify, breaking SPA navigation
        (() => {
            window.JSON.parse = new Proxy(JSON.parse, {
                apply(r, e, t) {
                    const n = Reflect.apply(r, e, t);
                    if (!location.pathname.startsWith("/shorts/"))
                        return n;
                    const a = n?.entries;
                    return a && Array.isArray(a) && (n.entries = n.entries.filter((r => {
                        if (!r?.command?.reelWatchEndpoint?.adClientParams?.isAd)
                            return r
                    }
                    ))),
                        n
                }
            });
        }
        )();
        ; (() => {
            let t = document.location.href
                , e = []
                , n = []
                , o = ""
                , r = !1;
            const i = Array.prototype.push
                , a = {
                    apply: (t, o, a) => (window.yt?.config_?.EXPERIMENT_FLAGS?.html5_enable_ssap_entity_id && a[0] && a[0] !== window && "number" == typeof a[0].start && a[0].end && "ssap" === a[0].namespace && a[0].id && (r || 0 !== a[0]?.start || n.includes(a[0].id) || (e.length = 0,
                        n.length = 0,
                        r = !0,
                        i.call(e, a[0]),
                        i.call(n, a[0].id)),
                        r && 0 !== a[0]?.start && !n.includes(a[0].id) && (i.call(e, a[0]),
                            i.call(n, a[0].id))),
                        Reflect.apply(t, o, a))
                };
            window.Array.prototype.push = new Proxy(window.Array.prototype.push, a),
                document.addEventListener("DOMContentLoaded", (function () {
                    if (!window.yt?.config_?.EXPERIMENT_FLAGS?.html5_enable_ssap_entity_id)
                        return;
                    const i = () => {
                        const t = document.querySelector("video");
                        if (t && e.length) {
                            const i = Math.round(t.duration)
                                , a = Math.round(e.at(-1).end / 1e3)
                                , c = n.join(",");
                            if (!1 === t.loop && o !== c && i && i === a) {
                                const n = e.at(-1).start / 1e3;
                                t.currentTime < n && (t.currentTime = n,
                                    r = !1,
                                    o = c)
                            } else if (!0 === t.loop && i && i === a) {
                                const n = e.at(-1).start / 1e3;
                                t.currentTime < n && (t.currentTime = n,
                                    r = !1,
                                    o = c)
                            }
                        }
                    }
                        ;
                    i();
                    new MutationObserver((() => {
                        t !== document.location.href && (t = document.location.href,
                            e.length = 0,
                            n.length = 0,
                            r = !1),
                            i()
                    }
                    )).observe(document, {
                        childList: !0,
                        subtree: !0
                    })
                }
                ))
        }
        )();
        ; (() => {
            // Promise.then proxy DISABLED - was causing overhead with no benefit
            // The blockedFuncNames were never being matched in practice
            // Keep this code commented for reference if needed later
            /*
            const blockedFuncNames = ['onAbnormalityDetected', 'onErrorCallback', 'adblockDetected', 'onAdBlockDetected'];
            const t = {
                apply: (t, o, n) => {
                    const e = n[0];
                    if (typeof e === 'function' && e.name && blockedFuncNames.includes(e.name)) {
                        n[0] = function() {};
                    }
                    return Reflect.apply(t, o, n);
                }
            };
            window.Promise.prototype.then = new Proxy(window.Promise.prototype.then, t);
            */
        }
        )();
        ; (() => {
            const startScriptOnVisibleState = t => {
                const e = () => {
                    "visible" === document.visibilityState && (document.removeEventListener("visibilitychange", e),
                        t())
                }
                    ;
                document.addEventListener("visibilitychange", e),
                    e()
            }
                , callback = () => {
                    (() => {
                        let requestProxyCount = 0;
                        let requestProxyModified = 0;

                        // Log stats every 5 seconds
                        setInterval(() => {
                            if (window.__ADSHIELD_DEBUG && requestProxyCount > 0) {
                                console.log(`[AdShield] Request proxy stats: ${requestProxyCount} calls, ${requestProxyModified} modified`);
                                requestProxyCount = 0;
                                requestProxyModified = 0;
                            }
                        }, 5000);

                        const e = {
                            construct: (e, t, c) => {
                                // DISABLED: clientScreen:ADUNIT modification was breaking SPA navigation
                                // The json-prune scriptlets handle ad removal from responses instead
                                return Reflect.construct(e, t, c);
                            }
                        };
                        window.Request = new Proxy(window.Request, e)
                    }
                    )();
                }
                ;
            startScriptOnVisibleState(callback);
        }
        )();
        ;
    } catch (e) {
        console.log(e)
    }
}
)();
