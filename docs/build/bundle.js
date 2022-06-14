
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    // unfortunately this can't be a constant as that wouldn't be tree-shakeable
    // so we cache the result instead
    let crossorigin;
    function is_crossorigin() {
        if (crossorigin === undefined) {
            crossorigin = false;
            try {
                if (typeof window !== 'undefined' && window.parent) {
                    void window.parent.document;
                }
            }
            catch (error) {
                crossorigin = true;
            }
        }
        return crossorigin;
    }
    function add_resize_listener(node, fn) {
        const computed_style = getComputedStyle(node);
        if (computed_style.position === 'static') {
            node.style.position = 'relative';
        }
        const iframe = element('iframe');
        iframe.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
            'overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: -1;');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        const crossorigin = is_crossorigin();
        let unsubscribe;
        if (crossorigin) {
            iframe.src = "data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}</script>";
            unsubscribe = listen(window, 'message', (event) => {
                if (event.source === iframe.contentWindow)
                    fn();
            });
        }
        else {
            iframe.src = 'about:blank';
            iframe.onload = () => {
                unsubscribe = listen(iframe.contentWindow, 'resize', fn);
            };
        }
        append(node, iframe);
        return () => {
            if (crossorigin) {
                unsubscribe();
            }
            else if (unsubscribe && iframe.contentWindow) {
                unsubscribe();
            }
            detach(iframe);
        };
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
        if (!rules[name]) {
            rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            managed_styles.forEach(info => {
                const { stylesheet } = info;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                info.rules = {};
            });
            managed_styles.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = (program.b - t);
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.46.4' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }

    var ustc = "fa20";
    var beacons = {
    	"exc-_default-s": "f101",
    	"exc-_default": "f102",
    	"sym-_default-s": "f167",
    	"sym-_default": "f168",
    	"sym-d": "f168",
    	"sym-d-s": "f167",
    	"sym-default": "f168",
    	"sym-default-s": "f167",
    	"exc-d": "f102",
    	"exc-d-s": "f101",
    	"exc-default": "f102",
    	"exc-default-s": "f101",
    	"cur-default": "f168",
    	"cur-default-s": "f167",
    	"exc-axieinfinity-s": "f103",
    	"exc-axieinfinity": "f104",
    	"exc-bibox-s": "f105",
    	"exc-bibox": "f106",
    	"exc-binance-s": "f107",
    	"exc-binance": "f108",
    	"exc-bisq-s": "f109",
    	"exc-bisq": "f10a",
    	"exc-bitbay-s": "f10b",
    	"exc-bitbay": "f10c",
    	"exc-bitfinex-s": "f10d",
    	"exc-bitfinex": "f10e",
    	"exc-bitflyer-s": "f10f",
    	"exc-bitflyer": "f110",
    	"exc-bithumb-s": "f111",
    	"exc-bithumb": "f112",
    	"exc-bitmex-s": "f113",
    	"exc-bitmex": "f114",
    	"exc-bitso-s": "f115",
    	"exc-bitso": "f116",
    	"exc-bitsquare-s": "f117",
    	"exc-bitsquare": "f118",
    	"exc-bitstamp-s": "f119",
    	"exc-bitstamp": "f11a",
    	"exc-bittrex-s": "f11b",
    	"exc-bittrex": "f11c",
    	"exc-bitvc-s": "f11d",
    	"exc-bitvc": "f11e",
    	"exc-btcchina-s": "f11f",
    	"exc-btcchina": "f120",
    	"exc-btce-s": "f121",
    	"exc-btce": "f122",
    	"exc-bybit-s": "f123",
    	"exc-bybit": "f124",
    	"exc-cexio-s": "f125",
    	"exc-cexio": "f126",
    	"exc-cme-s": "f127",
    	"exc-cme": "f128",
    	"exc-coinbase-s": "f129",
    	"exc-coinbase": "f12a",
    	"exc-coinbasepro-s": "f12b",
    	"exc-coinbasepro": "f12c",
    	"exc-coinone-s": "f12d",
    	"exc-coinone": "f12e",
    	"exc-comex-s": "f12f",
    	"exc-comex": "f130",
    	"exc-cryptofacilities-s": "f131",
    	"exc-cryptofacilities": "f132",
    	"exc-deribit-s": "f133",
    	"exc-deribit": "f134",
    	"exc-dex-aggregated-s": "f135",
    	"exc-dex-aggregated": "f136",
    	"exc-gateio-s": "f137",
    	"exc-gateio": "f138",
    	"exc-hitbtc-s": "f139",
    	"exc-hitbtc": "f13a",
    	"exc-kucoin-s": "f13b",
    	"exc-kucoin": "f13c",
    	"exc-liquid-s": "f13d",
    	"exc-liquid": "f13e",
    	"exc-luno-s": "f13f",
    	"exc-luno": "f140",
    	"exc-mtgox-s": "f141",
    	"exc-mtgox": "f142",
    	"exc-mxc-s": "f143",
    	"exc-mxc": "f144",
    	"exc-nbatopshop-s": "f145",
    	"exc-nbatopshop": "f146",
    	"exc-nymex-s": "f147",
    	"exc-nymex": "f148",
    	"exc-okcoin-s": "f149",
    	"exc-okcoin": "f14a",
    	"exc-okx-s": "f14b",
    	"exc-okx": "f14c",
    	"exc-opensea-s": "f14d",
    	"exc-opensea": "f14e",
    	"exc-poloniex-s": "f14f",
    	"exc-poloniex": "f150",
    	"exc-qryptos-s": "f151",
    	"exc-qryptos": "f152",
    	"exc-quadrigacx-s": "f153",
    	"exc-quadrigacx": "f154",
    	"exc-quick-s": "f155",
    	"exc-quick": "f156",
    	"exc-quoine-s": "f157",
    	"exc-quoine": "f158",
    	"exc-rarible-s": "f159",
    	"exc-rarible": "f15a",
    	"exc-totle-s": "f15b",
    	"exc-totle": "f15c",
    	"exc-upbit-s": "f15d",
    	"exc-upbit": "f15e",
    	"exc-vaultofsatoshi-s": "f15f",
    	"exc-vaultofsatoshi": "f160",
    	"exc-wex-s": "f161",
    	"exc-wex": "f162",
    	"exc-zaif-s": "f163",
    	"exc-zaif": "f164",
    	"exc-zonda-s": "f165",
    	"exc-zonda": "f166",
    	"sym-1inch-s": "f169",
    	"sym-1inch": "f16a",
    	"sym-1st-s": "f16b",
    	"sym-1st": "f16c",
    	"sym-6a-s": "f16d",
    	"sym-6a": "f16e",
    	"sym-6b-s": "f16f",
    	"sym-6b": "f170",
    	"sym-6c-s": "f171",
    	"sym-6c": "f172",
    	"sym-6e-s": "f173",
    	"sym-6e": "f174",
    	"sym-6j-s": "f175",
    	"sym-6j": "f176",
    	"sym-6l-s": "f177",
    	"sym-6l": "f178",
    	"sym-6m-s": "f179",
    	"sym-6m": "f17a",
    	"sym-6n-s": "f17b",
    	"sym-6n": "f17c",
    	"sym-6s-s": "f17d",
    	"sym-6s": "f17e",
    	"sym-a38-s": "f17f",
    	"sym-a38": "f180",
    	"sym-aac-s": "f181",
    	"sym-aac": "f182",
    	"sym-aave-s": "f183",
    	"sym-aave": "f184",
    	"sym-abbc-s": "f185",
    	"sym-abbc": "f186",
    	"sym-abt-s": "f187",
    	"sym-abt": "f188",
    	"sym-abyss-s": "f189",
    	"sym-abyss": "f18a",
    	"sym-aca-s": "f18b",
    	"sym-aca": "f18c",
    	"sym-acat-s": "f18d",
    	"sym-acat": "f18e",
    	"sym-ach-s": "f18f",
    	"sym-ach": "f190",
    	"sym-act-s": "f191",
    	"sym-act": "f192",
    	"sym-ad0-s": "f193",
    	"sym-ad0": "f194",
    	"sym-ada-s": "f195",
    	"sym-ada": "f196",
    	"sym-adel-s": "f197",
    	"sym-adel": "f198",
    	"sym-adh-s": "f199",
    	"sym-adh": "f19a",
    	"sym-adm-s": "f19b",
    	"sym-adm": "f19c",
    	"sym-ado-s": "f19d",
    	"sym-ado": "f19e",
    	"sym-adt-s": "f19f",
    	"sym-adt": "f1a0",
    	"sym-adx-s": "f1a1",
    	"sym-adx": "f1a2",
    	"sym-ae-s": "f1a3",
    	"sym-ae": "f1a4",
    	"sym-aed-s": "f1a5",
    	"sym-aed": "f1a6",
    	"sym-aeon-s": "f1a7",
    	"sym-aeon": "f1a8",
    	"sym-aep-s": "f1a9",
    	"sym-aep": "f1aa",
    	"sym-aergo-s": "f1ab",
    	"sym-aergo": "f1ac",
    	"sym-agi-s": "f1ad",
    	"sym-agi": "f1ae",
    	"sym-agld-s": "f1af",
    	"sym-agld": "f1b0",
    	"sym-aid-s": "f1b1",
    	"sym-aid": "f1b2",
    	"sym-aion-s": "f1b3",
    	"sym-aion": "f1b4",
    	"sym-air-s": "f1b5",
    	"sym-air": "f1b6",
    	"sym-akro-s": "f1b7",
    	"sym-akro": "f1b8",
    	"sym-akt-s": "f1b9",
    	"sym-akt": "f1ba",
    	"sym-alcx-s": "f1bb",
    	"sym-alcx": "f1bc",
    	"sym-aleph-s": "f1bd",
    	"sym-aleph": "f1be",
    	"sym-algo-s": "f1bf",
    	"sym-algo": "f1c0",
    	"sym-ali-s": "f1c1",
    	"sym-ali": "f1c2",
    	"sym-alice-s": "f1c3",
    	"sym-alice": "f1c4",
    	"sym-alpha-s": "f1c5",
    	"sym-alpha": "f1c6",
    	"sym-amb-s": "f1c7",
    	"sym-amb": "f1c8",
    	"sym-amlt-s": "f1c9",
    	"sym-amlt": "f1ca",
    	"sym-amp-s": "f1cb",
    	"sym-amp": "f1cc",
    	"sym-ampl-s": "f1cd",
    	"sym-ampl": "f1ce",
    	"sym-anc-s": "f1cf",
    	"sym-anc": "f1d0",
    	"sym-anct-s": "f1d1",
    	"sym-anct": "f1d2",
    	"sym-ankr-s": "f1d3",
    	"sym-ankr": "f1d4",
    	"sym-ant-s": "f1d5",
    	"sym-ant": "f1d6",
    	"sym-ape-s": "f1d7",
    	"sym-ape": "f1d8",
    	"sym-api3-s": "f1d9",
    	"sym-api3": "f1da",
    	"sym-apis-s": "f1db",
    	"sym-apis": "f1dc",
    	"sym-appc-s": "f1dd",
    	"sym-appc": "f1de",
    	"sym-ar-s": "f1df",
    	"sym-ar": "f1e0",
    	"sym-ardr-s": "f1e1",
    	"sym-ardr": "f1e2",
    	"sym-ark-s": "f1e3",
    	"sym-ark": "f1e4",
    	"sym-arn-s": "f1e5",
    	"sym-arn": "f1e6",
    	"sym-arpa-s": "f1e7",
    	"sym-arpa": "f1e8",
    	"sym-art-s": "f1e9",
    	"sym-art": "f1ea",
    	"sym-aspt-s": "f1eb",
    	"sym-aspt": "f1ec",
    	"sym-ast-s": "f1ed",
    	"sym-ast": "f1ee",
    	"sym-astr-s": "f1ef",
    	"sym-astr": "f1f0",
    	"sym-at-s": "f1f1",
    	"sym-at": "f1f2",
    	"sym-atlas-s": "f1f3",
    	"sym-atlas": "f1f4",
    	"sym-atm-s": "f1f5",
    	"sym-atm": "f1f6",
    	"sym-atom-s": "f1f7",
    	"sym-atom": "f1f8",
    	"sym-atp-s": "f1f9",
    	"sym-atp": "f1fa",
    	"sym-atri-s": "f1fb",
    	"sym-atri": "f1fc",
    	"sym-auction-s": "f1fd",
    	"sym-auction": "f1fe",
    	"sym-aud-s": "f1ff",
    	"sym-aud": "f200",
    	"sym-audio-s": "f201",
    	"sym-audio": "f202",
    	"sym-aup-s": "f203",
    	"sym-aup": "f204",
    	"sym-aury-s": "f205",
    	"sym-aury": "f206",
    	"sym-ausd-s": "f207",
    	"sym-ausd": "f208",
    	"sym-auto-s": "f209",
    	"sym-auto": "f20a",
    	"sym-ava-s": "f20b",
    	"sym-ava": "f20c",
    	"sym-avax-s": "f20d",
    	"sym-avax": "f20e",
    	"sym-avt-s": "f20f",
    	"sym-avt": "f210",
    	"sym-axp-s": "f211",
    	"sym-axp": "f212",
    	"sym-axs-s": "f213",
    	"sym-axs": "f214",
    	"sym-b": "f215",
    	"sym-b0-s": "f216",
    	"sym-b0": "f217",
    	"sym-b2g-s": "f218",
    	"sym-b2g": "f219",
    	"sym-bab-s": "f21a",
    	"sym-bab": "f21b",
    	"sym-badger-s": "f21c",
    	"sym-badger": "f21d",
    	"sym-bake-s": "f21e",
    	"sym-bake": "f21f",
    	"sym-bal-s": "f220",
    	"sym-bal": "f221",
    	"sym-banca-s": "f222",
    	"sym-banca": "f223",
    	"sym-band-s": "f224",
    	"sym-band": "f225",
    	"sym-bat-s": "f226",
    	"sym-bat": "f227",
    	"sym-bay-s": "f228",
    	"sym-bay": "f229",
    	"sym-bbc-s": "f22a",
    	"sym-bbc": "f22b",
    	"sym-bcc-s": "f22c",
    	"sym-bcc": "f22d",
    	"sym-bcd-s": "f22e",
    	"sym-bcd": "f22f",
    	"sym-bch-s": "f230",
    	"sym-bch": "f231",
    	"sym-bci-s": "f232",
    	"sym-bci": "f233",
    	"sym-bcn-s": "f234",
    	"sym-bcn": "f235",
    	"sym-bcpt-s": "f236",
    	"sym-bcpt": "f237",
    	"sym-bcu-s": "f238",
    	"sym-bcu": "f239",
    	"sym-bcv-s": "f23a",
    	"sym-bcv": "f23b",
    	"sym-bcy-s": "f23c",
    	"sym-bcy": "f23d",
    	"sym-bdg-s": "f23e",
    	"sym-bdg": "f23f",
    	"sym-beam-s": "f240",
    	"sym-beam": "f241",
    	"sym-beet-s": "f242",
    	"sym-beet": "f243",
    	"sym-bel-s": "f244",
    	"sym-bel": "f245",
    	"sym-bela-s": "f246",
    	"sym-bela": "f247",
    	"sym-berry-s": "f248",
    	"sym-berry": "f249",
    	"sym-beta-s": "f24a",
    	"sym-beta": "f24b",
    	"sym-betr-s": "f24c",
    	"sym-betr": "f24d",
    	"sym-bez-s": "f24e",
    	"sym-bez": "f24f",
    	"sym-bft-s": "f250",
    	"sym-bft": "f251",
    	"sym-bfx-s": "f252",
    	"sym-bfx": "f253",
    	"sym-bhd-s": "f254",
    	"sym-bhd": "f255",
    	"sym-bht-s": "f256",
    	"sym-bht": "f257",
    	"sym-bico-s": "f258",
    	"sym-bico": "f259",
    	"sym-bit-s": "f25a",
    	"sym-bit": "f25b",
    	"sym-bitb-s": "f25c",
    	"sym-bitb": "f25d",
    	"sym-bix-s": "f25e",
    	"sym-bix": "f25f",
    	"sym-bk-s": "f260",
    	"sym-bk": "f261",
    	"sym-bkx-s": "f262",
    	"sym-bkx": "f263",
    	"sym-blk-s": "f264",
    	"sym-blk": "f265",
    	"sym-block-s": "f266",
    	"sym-block": "f267",
    	"sym-blok-s": "f268",
    	"sym-blok": "f269",
    	"sym-blt-s": "f26a",
    	"sym-blt": "f26b",
    	"sym-blz-s": "f26c",
    	"sym-blz": "f26d",
    	"sym-bmc-s": "f26e",
    	"sym-bmc": "f26f",
    	"sym-bnb-s": "f270",
    	"sym-bnb": "f271",
    	"sym-bnc-s": "f272",
    	"sym-bnc": "f273",
    	"sym-bnk-s": "f274",
    	"sym-bnk": "f275",
    	"sym-bnt-s": "f276",
    	"sym-bnt": "f277",
    	"sym-bo-s": "f278",
    	"sym-bo": "f279",
    	"sym-bond-s": "f27a",
    	"sym-bond": "f27b",
    	"sym-boo-s": "f27c",
    	"sym-boo": "f27d",
    	"sym-bor-s": "f27e",
    	"sym-bor": "f27f",
    	"sym-bora-s": "f280",
    	"sym-bora": "f281",
    	"sym-bos-s": "f282",
    	"sym-bos": "f283",
    	"sym-box-s": "f284",
    	"sym-box": "f285",
    	"sym-brd-s": "f286",
    	"sym-brd": "f287",
    	"sym-breed-s": "f288",
    	"sym-breed": "f289",
    	"sym-brg-s": "f28a",
    	"sym-brg": "f28b",
    	"sym-brick-s": "f28c",
    	"sym-brick": "f28d",
    	"sym-bsd-s": "f28e",
    	"sym-bsd": "f28f",
    	"sym-bsv-s": "f290",
    	"sym-bsv": "f291",
    	"sym-bsx-s": "f292",
    	"sym-bsx": "f293",
    	"sym-bt1-s": "f294",
    	"sym-bt1": "f295",
    	"sym-bt2-s": "f296",
    	"sym-bt2": "f297",
    	"sym-btc-s": "f298",
    	"sym-btc": "f299",
    	"sym-btcd-s": "f29a",
    	"sym-btcd": "f29b",
    	"sym-btcfx-s": "f29c",
    	"sym-btcfx": "f29d",
    	"sym-btcp-s": "f29e",
    	"sym-btcp": "f29f",
    	"sym-btg-s": "f2a0",
    	"sym-btg": "f2a1",
    	"sym-btm-s": "f2a2",
    	"sym-btm": "f2a3",
    	"sym-btn-s": "f2a4",
    	"sym-btn": "f2a5",
    	"sym-bto-s": "f2a6",
    	"sym-bto": "f2a7",
    	"sym-btrst-s": "f2a8",
    	"sym-btrst": "f2a9",
    	"sym-bts-s": "f2aa",
    	"sym-bts": "f2ab",
    	"sym-btt-s": "f2ac",
    	"sym-btt": "f2ad",
    	"sym-btu-s": "f2ae",
    	"sym-btu": "f2af",
    	"sym-btx-s": "f2b0",
    	"sym-btx": "f2b1",
    	"sym-burger-s": "f2b2",
    	"sym-burger": "f2b3",
    	"sym-burst-s": "f2b4",
    	"sym-burst": "f2b5",
    	"sym-bus-s": "f2b6",
    	"sym-bus": "f2b7",
    	"sym-busd-s": "f2b8",
    	"sym-busd": "f2b9",
    	"sym-bwx-s": "f2ba",
    	"sym-bwx": "f2bb",
    	"sym-bz-s": "f2bc",
    	"sym-bz": "f2bd",
    	"sym-bzrx-s": "f2be",
    	"sym-bzrx": "f2bf",
    	"sym-c-s": "f2c0",
    	"sym-c": "f2c1",
    	"sym-c20-s": "f2c2",
    	"sym-c20": "f2c3",
    	"sym-c98-s": "f2c4",
    	"sym-c98": "f2c5",
    	"sym-cad-s": "f2c6",
    	"sym-cad": "f2c7",
    	"sym-cake-s": "f2c8",
    	"sym-cake": "f2c9",
    	"sym-cas-s": "f2ca",
    	"sym-cas": "f2cb",
    	"sym-cat-s": "f2cc",
    	"sym-cat": "f2cd",
    	"sym-cbc-s": "f2ce",
    	"sym-cbc": "f2cf",
    	"sym-cbt-s": "f2d0",
    	"sym-cbt": "f2d1",
    	"sym-cdt-s": "f2d2",
    	"sym-cdt": "f2d3",
    	"sym-cel-s": "f2d4",
    	"sym-cel": "f2d5",
    	"sym-celo-s": "f2d6",
    	"sym-celo": "f2d7",
    	"sym-celr-s": "f2d8",
    	"sym-celr": "f2d9",
    	"sym-cennz-s": "f2da",
    	"sym-cennz": "f2db",
    	"sym-cfg-s": "f2dc",
    	"sym-cfg": "f2dd",
    	"sym-cfi-s": "f2de",
    	"sym-cfi": "f2df",
    	"sym-cfx-s": "f2e0",
    	"sym-cfx": "f2e1",
    	"sym-cgt-s": "f2e2",
    	"sym-cgt": "f2e3",
    	"sym-chat-s": "f2e4",
    	"sym-chat": "f2e5",
    	"sym-chf-s": "f2e6",
    	"sym-chf": "f2e7",
    	"sym-chp-s": "f2e8",
    	"sym-chp": "f2e9",
    	"sym-chr-s": "f2ea",
    	"sym-chr": "f2eb",
    	"sym-chsb-s": "f2ec",
    	"sym-chsb": "f2ed",
    	"sym-chx-s": "f2ee",
    	"sym-chx": "f2ef",
    	"sym-chz-s": "f2f0",
    	"sym-chz": "f2f1",
    	"sym-ckb-s": "f2f2",
    	"sym-ckb": "f2f3",
    	"sym-cl-s": "f2f4",
    	"sym-cl": "f2f5",
    	"sym-clam-s": "f2f6",
    	"sym-clam": "f2f7",
    	"sym-cln-s": "f2f8",
    	"sym-cln": "f2f9",
    	"sym-clo-s": "f2fa",
    	"sym-clo": "f2fb",
    	"sym-cloak-s": "f2fc",
    	"sym-cloak": "f2fd",
    	"sym-clv-s": "f2fe",
    	"sym-clv": "f2ff",
    	"sym-cmct-s": "f300",
    	"sym-cmct": "f301",
    	"sym-cmt-s": "f302",
    	"sym-cmt": "f303",
    	"sym-cnd-s": "f304",
    	"sym-cnd": "f305",
    	"sym-cnn-s": "f306",
    	"sym-cnn": "f307",
    	"sym-cnx-s": "f308",
    	"sym-cnx": "f309",
    	"sym-cny-s": "f30a",
    	"sym-cny": "f30b",
    	"sym-cob-s": "f30c",
    	"sym-cob": "f30d",
    	"sym-cocos-s": "f30e",
    	"sym-cocos": "f30f",
    	"sym-comp-s": "f310",
    	"sym-comp": "f311",
    	"sym-cope-s": "f312",
    	"sym-cope": "f313",
    	"sym-cos-s": "f314",
    	"sym-cos": "f315",
    	"sym-cosm-s": "f316",
    	"sym-cosm": "f317",
    	"sym-coss-s": "f318",
    	"sym-coss": "f319",
    	"sym-coti-s": "f31a",
    	"sym-coti": "f31b",
    	"sym-cov-s": "f31c",
    	"sym-cov": "f31d",
    	"sym-cova-s": "f31e",
    	"sym-cova": "f31f",
    	"sym-cpt-s": "f320",
    	"sym-cpt": "f321",
    	"sym-cpx-s": "f322",
    	"sym-cpx": "f323",
    	"sym-cqt-s": "f324",
    	"sym-cqt": "f325",
    	"sym-cra-s": "f326",
    	"sym-cra": "f327",
    	"sym-crab-s": "f328",
    	"sym-crab": "f329",
    	"sym-crc-s": "f32a",
    	"sym-crc": "f32b",
    	"sym-cre-s": "f32c",
    	"sym-cre": "f32d",
    	"sym-cream-s": "f32e",
    	"sym-cream": "f32f",
    	"sym-cring-s": "f330",
    	"sym-cring": "f331",
    	"sym-cro-s": "f332",
    	"sym-cro": "f333",
    	"sym-crpt-s": "f334",
    	"sym-crpt": "f335",
    	"sym-cru-s": "f336",
    	"sym-cru": "f337",
    	"sym-crv-s": "f338",
    	"sym-crv": "f339",
    	"sym-crw-s": "f33a",
    	"sym-crw": "f33b",
    	"sym-csm-s": "f33c",
    	"sym-csm": "f33d",
    	"sym-csx-s": "f33e",
    	"sym-csx": "f33f",
    	"sym-ctc-s": "f340",
    	"sym-ctc": "f341",
    	"sym-ctk-s": "f342",
    	"sym-ctk": "f343",
    	"sym-ctsi-s": "f344",
    	"sym-ctsi": "f345",
    	"sym-ctxc-s": "f346",
    	"sym-ctxc": "f347",
    	"sym-cult-s": "f348",
    	"sym-cult": "f349",
    	"sym-cur-s": "f34a",
    	"sym-cur": "f34b",
    	"sym-cvc-s": "f34c",
    	"sym-cvc": "f34d",
    	"sym-cvcoin-s": "f34e",
    	"sym-cvcoin": "f34f",
    	"sym-cvnt-s": "f350",
    	"sym-cvnt": "f351",
    	"sym-cvp-s": "f352",
    	"sym-cvp": "f353",
    	"sym-cvt-s": "f354",
    	"sym-cvt": "f355",
    	"sym-cvx-s": "f356",
    	"sym-cvx": "f357",
    	"sym-cw-s": "f358",
    	"sym-cw": "f359",
    	"sym-cyc-s": "f35a",
    	"sym-cyc": "f35b",
    	"sym-dac-s": "f35c",
    	"sym-dac": "f35d",
    	"sym-dacs-s": "f35e",
    	"sym-dacs": "f35f",
    	"sym-dadi-s": "f360",
    	"sym-dadi": "f361",
    	"sym-dag-s": "f362",
    	"sym-dag": "f363",
    	"sym-dai-s": "f364",
    	"sym-dai": "f365",
    	"sym-dao-s": "f366",
    	"sym-dao": "f367",
    	"sym-dar-s": "f368",
    	"sym-dar": "f369",
    	"sym-dash-s": "f36a",
    	"sym-dash": "f36b",
    	"sym-dat-s": "f36c",
    	"sym-dat": "f36d",
    	"sym-data-s": "f36e",
    	"sym-data": "f36f",
    	"sym-datx-s": "f370",
    	"sym-datx": "f371",
    	"sym-dbc-s": "f372",
    	"sym-dbc": "f373",
    	"sym-dbet-s": "f374",
    	"sym-dbet": "f375",
    	"sym-dbix-s": "f376",
    	"sym-dbix": "f377",
    	"sym-dcn-s": "f378",
    	"sym-dcn": "f379",
    	"sym-dcr-s": "f37a",
    	"sym-dcr": "f37b",
    	"sym-dct-s": "f37c",
    	"sym-dct": "f37d",
    	"sym-ddd-s": "f37e",
    	"sym-ddd": "f37f",
    	"sym-dego-s": "f380",
    	"sym-dego": "f381",
    	"sym-dent-s": "f382",
    	"sym-dent": "f383",
    	"sym-dext-s": "f384",
    	"sym-dext": "f385",
    	"sym-dgb-s": "f386",
    	"sym-dgb": "f387",
    	"sym-dgd-s": "f388",
    	"sym-dgd": "f389",
    	"sym-dgtx-s": "f38a",
    	"sym-dgtx": "f38b",
    	"sym-dgx-s": "f38c",
    	"sym-dgx": "f38d",
    	"sym-dhx-s": "f38e",
    	"sym-dhx": "f38f",
    	"sym-dia-s": "f390",
    	"sym-dia": "f391",
    	"sym-dice-s": "f392",
    	"sym-dice": "f393",
    	"sym-dim-s": "f394",
    	"sym-dim": "f395",
    	"sym-dlt-s": "f396",
    	"sym-dlt": "f397",
    	"sym-dmd-s": "f398",
    	"sym-dmd": "f399",
    	"sym-dmt-s": "f39a",
    	"sym-dmt": "f39b",
    	"sym-dnt-s": "f39c",
    	"sym-dnt": "f39d",
    	"sym-dock-s": "f39e",
    	"sym-dock": "f39f",
    	"sym-dodo-s": "f3a0",
    	"sym-dodo": "f3a1",
    	"sym-doge-s": "f3a2",
    	"sym-doge": "f3a3",
    	"sym-dose-s": "f3a4",
    	"sym-dose": "f3a5",
    	"sym-dot-s": "f3a6",
    	"sym-dot": "f3a7",
    	"sym-dpx-s": "f3a8",
    	"sym-dpx": "f3a9",
    	"sym-dpy-s": "f3aa",
    	"sym-dpy": "f3ab",
    	"sym-dream-s": "f3ac",
    	"sym-dream": "f3ad",
    	"sym-drep-s": "f3ae",
    	"sym-drep": "f3af",
    	"sym-drg-s": "f3b0",
    	"sym-drg": "f3b1",
    	"sym-drgn-s": "f3b2",
    	"sym-drgn": "f3b3",
    	"sym-drt-s": "f3b4",
    	"sym-drt": "f3b5",
    	"sym-dta-s": "f3b6",
    	"sym-dta": "f3b7",
    	"sym-dtb-s": "f3b8",
    	"sym-dtb": "f3b9",
    	"sym-dtr-s": "f3ba",
    	"sym-dtr": "f3bb",
    	"sym-dusk-s": "f3bc",
    	"sym-dusk": "f3bd",
    	"sym-dx-s": "f3be",
    	"sym-dx": "f3bf",
    	"sym-dydx-s": "f3c0",
    	"sym-dydx": "f3c1",
    	"sym-dyn-s": "f3c2",
    	"sym-dyn": "f3c3",
    	"sym-easy": "f3c4",
    	"sym-ecom-s": "f3c5",
    	"sym-ecom": "f3c6",
    	"sym-edc-s": "f3c7",
    	"sym-edc": "f3c8",
    	"sym-edg-s": "f3c9",
    	"sym-edg": "f3ca",
    	"sym-edo-s": "f3cb",
    	"sym-edo": "f3cc",
    	"sym-edp-s": "f3cd",
    	"sym-edp": "f3ce",
    	"sym-edr-s": "f3cf",
    	"sym-edr": "f3d0",
    	"sym-efi-s": "f3d1",
    	"sym-efi": "f3d2",
    	"sym-egld-s": "f3d3",
    	"sym-egld": "f3d4",
    	"sym-egt-s": "f3d5",
    	"sym-egt": "f3d6",
    	"sym-ehr-s": "f3d7",
    	"sym-ehr": "f3d8",
    	"sym-eko-s": "f3d9",
    	"sym-eko": "f3da",
    	"sym-ekt-s": "f3db",
    	"sym-ekt": "f3dc",
    	"sym-ela-s": "f3dd",
    	"sym-ela": "f3de",
    	"sym-elec-s": "f3df",
    	"sym-elec": "f3e0",
    	"sym-elf-s": "f3e1",
    	"sym-elf": "f3e2",
    	"sym-em-s": "f3e3",
    	"sym-em": "f3e4",
    	"sym-emc-s": "f3e5",
    	"sym-emc": "f3e6",
    	"sym-emc2-s": "f3e7",
    	"sym-emc2": "f3e8",
    	"sym-eng-s": "f3e9",
    	"sym-eng": "f3ea",
    	"sym-enj-s": "f3eb",
    	"sym-enj": "f3ec",
    	"sym-ens-s": "f3ed",
    	"sym-ens": "f3ee",
    	"sym-eos-s": "f3ef",
    	"sym-eos": "f3f0",
    	"sym-eosdac-s": "f3f1",
    	"sym-eosdac": "f3f2",
    	"sym-eq-s": "f3f3",
    	"sym-eq": "f3f4",
    	"sym-erd-s": "f3f5",
    	"sym-erd": "f3f6",
    	"sym-ern-s": "f3f7",
    	"sym-ern": "f3f8",
    	"sym-es": "f3f9",
    	"sym-es-s": "f3fa",
    	"sym-esd-s": "f3fb",
    	"sym-esd": "f3fc",
    	"sym-etc-s": "f3fd",
    	"sym-etc": "f3fe",
    	"sym-eth-s": "f3ff",
    	"sym-eth": "f400",
    	"sym-ethup-s": "f401",
    	"sym-ethup": "f402",
    	"sym-etn-s": "f403",
    	"sym-etn": "f404",
    	"sym-etp-s": "f405",
    	"sym-etp": "f406",
    	"sym-eur-s": "f407",
    	"sym-eur": "f408",
    	"sym-eurs-s": "f409",
    	"sym-eurs": "f40a",
    	"sym-eurt-s": "f40b",
    	"sym-eurt": "f40c",
    	"sym-evn-s": "f40d",
    	"sym-evn": "f40e",
    	"sym-evx-s": "f40f",
    	"sym-evx": "f410",
    	"sym-ewt-s": "f411",
    	"sym-ewt": "f412",
    	"sym-exp-s": "f413",
    	"sym-exp": "f414",
    	"sym-exrd-s": "f415",
    	"sym-exrd": "f416",
    	"sym-exy-s": "f417",
    	"sym-exy": "f418",
    	"sym-ez-s": "f419",
    	"sym-ez": "f41a",
    	"sym-fair-s": "f41b",
    	"sym-fair": "f41c",
    	"sym-farm-s": "f41d",
    	"sym-farm": "f41e",
    	"sym-fct-s": "f41f",
    	"sym-fct": "f420",
    	"sym-fdz-s": "f421",
    	"sym-fdz": "f422",
    	"sym-fee-s": "f423",
    	"sym-fee": "f424",
    	"sym-fet-s": "f425",
    	"sym-fet": "f426",
    	"sym-fida-s": "f427",
    	"sym-fida": "f428",
    	"sym-fil-s": "f429",
    	"sym-fil": "f42a",
    	"sym-fio-s": "f42b",
    	"sym-fio": "f42c",
    	"sym-firo-s": "f42d",
    	"sym-firo": "f42e",
    	"sym-fis-s": "f42f",
    	"sym-fis": "f430",
    	"sym-fldc-s": "f431",
    	"sym-fldc": "f432",
    	"sym-flo-s": "f433",
    	"sym-flo": "f434",
    	"sym-floki-s": "f435",
    	"sym-floki": "f436",
    	"sym-flow-s": "f437",
    	"sym-flow": "f438",
    	"sym-flr-s": "f439",
    	"sym-flr": "f43a",
    	"sym-fluz-s": "f43b",
    	"sym-fluz": "f43c",
    	"sym-fnb-s": "f43d",
    	"sym-fnb": "f43e",
    	"sym-foam-s": "f43f",
    	"sym-foam": "f440",
    	"sym-for-s": "f441",
    	"sym-for": "f442",
    	"sym-forth-s": "f443",
    	"sym-forth": "f444",
    	"sym-fota-s": "f445",
    	"sym-fota": "f446",
    	"sym-fox-s": "f447",
    	"sym-fox": "f448",
    	"sym-fpis-s": "f449",
    	"sym-fpis": "f44a",
    	"sym-frax-s": "f44b",
    	"sym-frax": "f44c",
    	"sym-front-s": "f44d",
    	"sym-front": "f44e",
    	"sym-fsn-s": "f44f",
    	"sym-fsn": "f450",
    	"sym-ftc-s": "f451",
    	"sym-ftc": "f452",
    	"sym-fti-s": "f453",
    	"sym-fti": "f454",
    	"sym-ftm-s": "f455",
    	"sym-ftm": "f456",
    	"sym-ftt-s": "f457",
    	"sym-ftt": "f458",
    	"sym-ftx-s": "f459",
    	"sym-ftx": "f45a",
    	"sym-fuel-s": "f45b",
    	"sym-fuel": "f45c",
    	"sym-fun-s": "f45d",
    	"sym-fun": "f45e",
    	"sym-fx-s": "f45f",
    	"sym-fx": "f460",
    	"sym-fxc-s": "f461",
    	"sym-fxc": "f462",
    	"sym-fxs-s": "f463",
    	"sym-fxs": "f464",
    	"sym-fxt-s": "f465",
    	"sym-fxt": "f466",
    	"sym-gal-s": "f467",
    	"sym-gal": "f468",
    	"sym-gala-s": "f469",
    	"sym-gala": "f46a",
    	"sym-game-s": "f46b",
    	"sym-game": "f46c",
    	"sym-gamee-s": "f46d",
    	"sym-gamee": "f46e",
    	"sym-gard-s": "f46f",
    	"sym-gard": "f470",
    	"sym-gari-s": "f471",
    	"sym-gari": "f472",
    	"sym-gas-s": "f473",
    	"sym-gas": "f474",
    	"sym-gbc-s": "f475",
    	"sym-gbc": "f476",
    	"sym-gbp-s": "f477",
    	"sym-gbp": "f478",
    	"sym-gbx-s": "f479",
    	"sym-gbx": "f47a",
    	"sym-gbyte-s": "f47b",
    	"sym-gbyte": "f47c",
    	"sym-gc-s": "f47d",
    	"sym-gc": "f47e",
    	"sym-gcc-s": "f47f",
    	"sym-gcc": "f480",
    	"sym-ge-s": "f481",
    	"sym-ge": "f482",
    	"sym-geist-s": "f483",
    	"sym-geist": "f484",
    	"sym-gen-s": "f485",
    	"sym-gen": "f486",
    	"sym-gene-s": "f487",
    	"sym-gene": "f488",
    	"sym-gens-s": "f489",
    	"sym-gens": "f48a",
    	"sym-get-s": "f48b",
    	"sym-get": "f48c",
    	"sym-ghst-s": "f48d",
    	"sym-ghst": "f48e",
    	"sym-glc-s": "f48f",
    	"sym-glc": "f490",
    	"sym-gld-s": "f491",
    	"sym-gld": "f492",
    	"sym-glm-s": "f493",
    	"sym-glm": "f494",
    	"sym-glmr-s": "f495",
    	"sym-glmr": "f496",
    	"sym-gmat-s": "f497",
    	"sym-gmat": "f498",
    	"sym-gmt-s": "f499",
    	"sym-gmt": "f49a",
    	"sym-gmt2-s": "f49b",
    	"sym-gmt2": "f49c",
    	"sym-gno-s": "f49d",
    	"sym-gno": "f49e",
    	"sym-gnt-s": "f49f",
    	"sym-gnt": "f4a0",
    	"sym-gnx-s": "f4a1",
    	"sym-gnx": "f4a2",
    	"sym-go-s": "f4a3",
    	"sym-go": "f4a4",
    	"sym-gods-s": "f4a5",
    	"sym-gods": "f4a6",
    	"sym-got-s": "f4a7",
    	"sym-got": "f4a8",
    	"sym-grc-s": "f4a9",
    	"sym-grc": "f4aa",
    	"sym-grin-s": "f4ab",
    	"sym-grin": "f4ac",
    	"sym-grs-s": "f4ad",
    	"sym-grs": "f4ae",
    	"sym-grt-s": "f4af",
    	"sym-grt": "f4b0",
    	"sym-gsc-s": "f4b1",
    	"sym-gsc": "f4b2",
    	"sym-gst-s": "f4b3",
    	"sym-gst": "f4b4",
    	"sym-gt-s": "f4b5",
    	"sym-gt": "f4b6",
    	"sym-gtc-s": "f4b7",
    	"sym-gtc": "f4b8",
    	"sym-gtc2-s": "f4b9",
    	"sym-gtc2": "f4ba",
    	"sym-gto-s": "f4bb",
    	"sym-gto": "f4bc",
    	"sym-gup-s": "f4bd",
    	"sym-gup": "f4be",
    	"sym-gusd-s": "f4bf",
    	"sym-gusd": "f4c0",
    	"sym-gvt-s": "f4c1",
    	"sym-gvt": "f4c2",
    	"sym-gxc-s": "f4c3",
    	"sym-gxc": "f4c4",
    	"sym-gxs-s": "f4c5",
    	"sym-gxs": "f4c6",
    	"sym-hard-s": "f4c7",
    	"sym-hard": "f4c8",
    	"sym-hbar-s": "f4c9",
    	"sym-hbar": "f4ca",
    	"sym-hc-s": "f4cb",
    	"sym-hc": "f4cc",
    	"sym-hdx-s": "f4cd",
    	"sym-hdx": "f4ce",
    	"sym-hedg-s": "f4cf",
    	"sym-hedg": "f4d0",
    	"sym-hegic-s": "f4d1",
    	"sym-hegic": "f4d2",
    	"sym-hex-s": "f4d3",
    	"sym-hex": "f4d4",
    	"sym-hft-s": "f4d5",
    	"sym-hft": "f4d6",
    	"sym-hg-s": "f4d7",
    	"sym-hg": "f4d8",
    	"sym-hgs-s": "f4d9",
    	"sym-hgs": "f4da",
    	"sym-hh-s": "f4db",
    	"sym-hh": "f4dc",
    	"sym-high-s": "f4dd",
    	"sym-high": "f4de",
    	"sym-hit-s": "f4df",
    	"sym-hit": "f4e0",
    	"sym-hive-s": "f4e1",
    	"sym-hive": "f4e2",
    	"sym-hkd-s": "f4e3",
    	"sym-hkd": "f4e4",
    	"sym-hmq-s": "f4e5",
    	"sym-hmq": "f4e6",
    	"sym-hns-s": "f4e7",
    	"sym-hns": "f4e8",
    	"sym-ho-s": "f4e9",
    	"sym-ho": "f4ea",
    	"sym-hopr-s": "f4eb",
    	"sym-hopr": "f4ec",
    	"sym-hot-s": "f4ed",
    	"sym-hot": "f4ee",
    	"sym-hp-s": "f4ef",
    	"sym-hp": "f4f0",
    	"sym-hpb-s": "f4f1",
    	"sym-hpb": "f4f2",
    	"sym-hpc-s": "f4f3",
    	"sym-hpc": "f4f4",
    	"sym-hpt-s": "f4f5",
    	"sym-hpt": "f4f6",
    	"sym-hrc-s": "f4f7",
    	"sym-hrc": "f4f8",
    	"sym-hsc-s": "f4f9",
    	"sym-hsc": "f4fa",
    	"sym-hsr-s": "f4fb",
    	"sym-hsr": "f4fc",
    	"sym-hst-s": "f4fd",
    	"sym-hst": "f4fe",
    	"sym-ht-s": "f4ff",
    	"sym-ht": "f500",
    	"sym-html-s": "f501",
    	"sym-html": "f502",
    	"sym-htt-s": "f503",
    	"sym-htt": "f504",
    	"sym-huc-s": "f505",
    	"sym-huc": "f506",
    	"sym-hunt-s": "f507",
    	"sym-hunt": "f508",
    	"sym-hvn-s": "f509",
    	"sym-hvn": "f50a",
    	"sym-hxro-s": "f50b",
    	"sym-hxro": "f50c",
    	"sym-hyc-s": "f50d",
    	"sym-hyc": "f50e",
    	"sym-hydra-s": "f50f",
    	"sym-hydra": "f510",
    	"sym-hydro-s": "f511",
    	"sym-hydro": "f512",
    	"sym-icn-s": "f513",
    	"sym-icn": "f514",
    	"sym-icos-s": "f515",
    	"sym-icos": "f516",
    	"sym-icp-s": "f517",
    	"sym-icp": "f518",
    	"sym-icx-s": "f519",
    	"sym-icx": "f51a",
    	"sym-idex-s": "f51b",
    	"sym-idex": "f51c",
    	"sym-idh-s": "f51d",
    	"sym-idh": "f51e",
    	"sym-idr-s": "f51f",
    	"sym-idr": "f520",
    	"sym-ift-s": "f521",
    	"sym-ift": "f522",
    	"sym-ignis-s": "f523",
    	"sym-ignis": "f524",
    	"sym-ihf-s": "f525",
    	"sym-ihf": "f526",
    	"sym-iht-s": "f527",
    	"sym-iht": "f528",
    	"sym-ilc-s": "f529",
    	"sym-ilc": "f52a",
    	"sym-ilv-s": "f52b",
    	"sym-ilv": "f52c",
    	"sym-imx-s": "f52d",
    	"sym-imx": "f52e",
    	"sym-incnt-s": "f52f",
    	"sym-incnt": "f530",
    	"sym-ind-s": "f531",
    	"sym-ind": "f532",
    	"sym-indi-s": "f533",
    	"sym-indi": "f534",
    	"sym-inj-s": "f535",
    	"sym-inj": "f536",
    	"sym-ink-s": "f537",
    	"sym-ink": "f538",
    	"sym-inr-s": "f539",
    	"sym-inr": "f53a",
    	"sym-ins-s": "f53b",
    	"sym-ins": "f53c",
    	"sym-int-s": "f53d",
    	"sym-int": "f53e",
    	"sym-intr-s": "f53f",
    	"sym-intr": "f540",
    	"sym-ioc-s": "f541",
    	"sym-ioc": "f542",
    	"sym-ion-s": "f543",
    	"sym-ion": "f544",
    	"sym-iost-s": "f545",
    	"sym-iost": "f546",
    	"sym-iot-s": "f547",
    	"sym-iot": "f548",
    	"sym-iotx-s": "f549",
    	"sym-iotx": "f54a",
    	"sym-iq-s": "f54b",
    	"sym-iq": "f54c",
    	"sym-iris-s": "f54d",
    	"sym-iris": "f54e",
    	"sym-itc-s": "f54f",
    	"sym-itc": "f550",
    	"sym-ivy-s": "f551",
    	"sym-ivy": "f552",
    	"sym-ixt-s": "f553",
    	"sym-ixt": "f554",
    	"sym-jasmy-s": "f555",
    	"sym-jasmy": "f556",
    	"sym-jnt-s": "f557",
    	"sym-jnt": "f558",
    	"sym-joe-s": "f559",
    	"sym-joe": "f55a",
    	"sym-jpeg-s": "f55b",
    	"sym-jpeg": "f55c",
    	"sym-jpy-s": "f55d",
    	"sym-jpy": "f55e",
    	"sym-jst-s": "f55f",
    	"sym-jst": "f560",
    	"sym-juno-s": "f561",
    	"sym-juno": "f562",
    	"sym-just-s": "f563",
    	"sym-just": "f564",
    	"sym-juv-s": "f565",
    	"sym-juv": "f566",
    	"sym-kan-s": "f567",
    	"sym-kan": "f568",
    	"sym-kar-s": "f569",
    	"sym-kar": "f56a",
    	"sym-kava-s": "f56b",
    	"sym-kava": "f56c",
    	"sym-kbc-s": "f56d",
    	"sym-kbc": "f56e",
    	"sym-kcash-s": "f56f",
    	"sym-kcash": "f570",
    	"sym-kda-s": "f571",
    	"sym-kda": "f572",
    	"sym-keep-s": "f573",
    	"sym-keep": "f574",
    	"sym-key-s": "f575",
    	"sym-key": "f576",
    	"sym-kick-s": "f577",
    	"sym-kick": "f578",
    	"sym-kilt-s": "f579",
    	"sym-kilt": "f57a",
    	"sym-kin-s": "f57b",
    	"sym-kin": "f57c",
    	"sym-kint-s": "f57d",
    	"sym-kint": "f57e",
    	"sym-klay-s": "f57f",
    	"sym-klay": "f580",
    	"sym-kma-s": "f581",
    	"sym-kma": "f582",
    	"sym-kmd-s": "f583",
    	"sym-kmd": "f584",
    	"sym-knc-s": "f585",
    	"sym-knc": "f586",
    	"sym-kore-s": "f587",
    	"sym-kore": "f588",
    	"sym-kp3r-s": "f589",
    	"sym-kp3r": "f58a",
    	"sym-krm-s": "f58b",
    	"sym-krm": "f58c",
    	"sym-krw-s": "f58d",
    	"sym-krw": "f58e",
    	"sym-ksm-s": "f58f",
    	"sym-ksm": "f590",
    	"sym-ksx-s": "f591",
    	"sym-ksx": "f592",
    	"sym-kyl-s": "f593",
    	"sym-kyl": "f594",
    	"sym-la-s": "f595",
    	"sym-la": "f596",
    	"sym-lak-s": "f597",
    	"sym-lak": "f598",
    	"sym-lamb-s": "f599",
    	"sym-lamb": "f59a",
    	"sym-latx-s": "f59b",
    	"sym-latx": "f59c",
    	"sym-layr-s": "f59d",
    	"sym-layr": "f59e",
    	"sym-lba-s": "f59f",
    	"sym-lba": "f5a0",
    	"sym-lbc-s": "f5a1",
    	"sym-lbc": "f5a2",
    	"sym-lcc-s": "f5a3",
    	"sym-lcc": "f5a4",
    	"sym-lcx-s": "f5a5",
    	"sym-lcx": "f5a6",
    	"sym-ldo-s": "f5a7",
    	"sym-ldo": "f5a8",
    	"sym-lend-s": "f5a9",
    	"sym-lend": "f5aa",
    	"sym-leo-s": "f5ab",
    	"sym-leo": "f5ac",
    	"sym-leoc-s": "f5ad",
    	"sym-leoc": "f5ae",
    	"sym-let-s": "f5af",
    	"sym-let": "f5b0",
    	"sym-life-s": "f5b1",
    	"sym-life": "f5b2",
    	"sym-lina-s": "f5b3",
    	"sym-lina": "f5b4",
    	"sym-link-s": "f5b5",
    	"sym-link": "f5b6",
    	"sym-lit-s": "f5b7",
    	"sym-lit": "f5b8",
    	"sym-lmc-s": "f5b9",
    	"sym-lmc": "f5ba",
    	"sym-lml-s": "f5bb",
    	"sym-lml": "f5bc",
    	"sym-lnc-s": "f5bd",
    	"sym-lnc": "f5be",
    	"sym-lnd-s": "f5bf",
    	"sym-lnd": "f5c0",
    	"sym-loc-s": "f5c1",
    	"sym-loc": "f5c2",
    	"sym-loka-s": "f5c3",
    	"sym-loka": "f5c4",
    	"sym-looks-s": "f5c5",
    	"sym-looks": "f5c6",
    	"sym-loom-s": "f5c7",
    	"sym-loom": "f5c8",
    	"sym-lpt-s": "f5c9",
    	"sym-lpt": "f5ca",
    	"sym-lqty-s": "f5cb",
    	"sym-lqty": "f5cc",
    	"sym-lrc-s": "f5cd",
    	"sym-lrc": "f5ce",
    	"sym-lrn-s": "f5cf",
    	"sym-lrn": "f5d0",
    	"sym-lsk-s": "f5d1",
    	"sym-lsk": "f5d2",
    	"sym-ltc-s": "f5d3",
    	"sym-ltc": "f5d4",
    	"sym-lto-s": "f5d5",
    	"sym-lto": "f5d6",
    	"sym-lun-s": "f5d7",
    	"sym-lun": "f5d8",
    	"sym-luna-s": "f5d9",
    	"sym-luna": "f5da",
    	"sym-luna2-s": "f5db",
    	"sym-luna2": "f5dc",
    	"sym-lxt-s": "f5dd",
    	"sym-lxt": "f5de",
    	"sym-lym-s": "f5df",
    	"sym-lym": "f5e0",
    	"sym-m2k-s": "f5e1",
    	"sym-m2k": "f5e2",
    	"sym-ma-s": "f5e3",
    	"sym-ma": "f5e4",
    	"sym-magic-s": "f5e5",
    	"sym-magic": "f5e6",
    	"sym-maid-s": "f5e7",
    	"sym-maid": "f5e8",
    	"sym-man-s": "f5e9",
    	"sym-man": "f5ea",
    	"sym-mana-s": "f5eb",
    	"sym-mana": "f5ec",
    	"sym-maps-s": "f5ed",
    	"sym-maps": "f5ee",
    	"sym-mask-s": "f5ef",
    	"sym-mask": "f5f0",
    	"sym-mass-s": "f5f1",
    	"sym-mass": "f5f2",
    	"sym-math-s": "f5f3",
    	"sym-math": "f5f4",
    	"sym-matic-s": "f5f5",
    	"sym-matic": "f5f6",
    	"sym-mbl-s": "f5f7",
    	"sym-mbl": "f5f8",
    	"sym-mbt-s": "f5f9",
    	"sym-mbt": "f5fa",
    	"sym-mc-s": "f5fb",
    	"sym-mc": "f5fc",
    	"sym-mco-s": "f5fd",
    	"sym-mco": "f5fe",
    	"sym-mda-s": "f5ff",
    	"sym-mda": "f600",
    	"sym-mds-s": "f601",
    	"sym-mds": "f602",
    	"sym-mdt-s": "f603",
    	"sym-mdt": "f604",
    	"sym-mdx-s": "f605",
    	"sym-mdx": "f606",
    	"sym-med-s": "f607",
    	"sym-med": "f608",
    	"sym-mer-s": "f609",
    	"sym-mer": "f60a",
    	"sym-mes-s": "f60b",
    	"sym-mes": "f60c",
    	"sym-met-s": "f60d",
    	"sym-met": "f60e",
    	"sym-meta-s": "f60f",
    	"sym-meta": "f610",
    	"sym-mft-s": "f611",
    	"sym-mft": "f612",
    	"sym-mgc-s": "f613",
    	"sym-mgc": "f614",
    	"sym-mgo-s": "f615",
    	"sym-mgo": "f616",
    	"sym-mhc-s": "f617",
    	"sym-mhc": "f618",
    	"sym-mina-s": "f619",
    	"sym-mina": "f61a",
    	"sym-mir-s": "f61b",
    	"sym-mir": "f61c",
    	"sym-mith-s": "f61d",
    	"sym-mith": "f61e",
    	"sym-mitx-s": "f61f",
    	"sym-mitx": "f620",
    	"sym-mjp-s": "f621",
    	"sym-mjp": "f622",
    	"sym-mkr-s": "f623",
    	"sym-mkr": "f624",
    	"sym-mln-s": "f625",
    	"sym-mln": "f626",
    	"sym-mngo-s": "f627",
    	"sym-mngo": "f628",
    	"sym-mnx-s": "f629",
    	"sym-mnx": "f62a",
    	"sym-moac-s": "f62b",
    	"sym-moac": "f62c",
    	"sym-mob-s": "f62d",
    	"sym-mob": "f62e",
    	"sym-mobi-s": "f62f",
    	"sym-mobi": "f630",
    	"sym-moc-s": "f631",
    	"sym-moc": "f632",
    	"sym-mod-s": "f633",
    	"sym-mod": "f634",
    	"sym-mona-s": "f635",
    	"sym-mona": "f636",
    	"sym-moon-s": "f637",
    	"sym-moon": "f638",
    	"sym-morph-s": "f639",
    	"sym-morph": "f63a",
    	"sym-movr-s": "f63b",
    	"sym-movr": "f63c",
    	"sym-mpl-s": "f63d",
    	"sym-mpl": "f63e",
    	"sym-mrk-s": "f63f",
    	"sym-mrk": "f640",
    	"sym-msol-s": "f641",
    	"sym-msol": "f642",
    	"sym-msp-s": "f643",
    	"sym-msp": "f644",
    	"sym-mta-s": "f645",
    	"sym-mta": "f646",
    	"sym-mtc-s": "f647",
    	"sym-mtc": "f648",
    	"sym-mth-s": "f649",
    	"sym-mth": "f64a",
    	"sym-mtl-s": "f64b",
    	"sym-mtl": "f64c",
    	"sym-mtn-s": "f64d",
    	"sym-mtn": "f64e",
    	"sym-mtx-s": "f64f",
    	"sym-mtx": "f650",
    	"sym-mue-s": "f651",
    	"sym-mue": "f652",
    	"sym-multi-s": "f653",
    	"sym-multi": "f654",
    	"sym-mv-s": "f655",
    	"sym-mv": "f656",
    	"sym-mx-s": "f657",
    	"sym-mx": "f658",
    	"sym-mxc-s": "f659",
    	"sym-mxc": "f65a",
    	"sym-mxm-s": "f65b",
    	"sym-mxm": "f65c",
    	"sym-mxn-s": "f65d",
    	"sym-mxn": "f65e",
    	"sym-myr-s": "f65f",
    	"sym-myr": "f660",
    	"sym-n9l-s": "f661",
    	"sym-n9l": "f662",
    	"sym-nanj-s": "f663",
    	"sym-nanj": "f664",
    	"sym-nano-s": "f665",
    	"sym-nano": "f666",
    	"sym-nas-s": "f667",
    	"sym-nas": "f668",
    	"sym-naut-s": "f669",
    	"sym-naut": "f66a",
    	"sym-nav-s": "f66b",
    	"sym-nav": "f66c",
    	"sym-ncash-s": "f66d",
    	"sym-ncash": "f66e",
    	"sym-nct-s": "f66f",
    	"sym-nct": "f670",
    	"sym-near-s": "f671",
    	"sym-near": "f672",
    	"sym-nebl-s": "f673",
    	"sym-nebl": "f674",
    	"sym-nec-s": "f675",
    	"sym-nec": "f676",
    	"sym-neo-s": "f677",
    	"sym-neo": "f678",
    	"sym-neos-s": "f679",
    	"sym-neos": "f67a",
    	"sym-nest-s": "f67b",
    	"sym-nest": "f67c",
    	"sym-neu-s": "f67d",
    	"sym-neu": "f67e",
    	"sym-new-s": "f67f",
    	"sym-new": "f680",
    	"sym-nexo-s": "f681",
    	"sym-nexo": "f682",
    	"sym-nft-s": "f683",
    	"sym-nft": "f684",
    	"sym-ng-s": "f685",
    	"sym-ng": "f686",
    	"sym-ngc-s": "f687",
    	"sym-ngc": "f688",
    	"sym-ngn-s": "f689",
    	"sym-ngn": "f68a",
    	"sym-nim-s": "f68b",
    	"sym-nim": "f68c",
    	"sym-niy-s": "f68d",
    	"sym-niy": "f68e",
    	"sym-nkd-s": "f68f",
    	"sym-nkd": "f690",
    	"sym-nkn-s": "f691",
    	"sym-nkn": "f692",
    	"sym-nlc2-s": "f693",
    	"sym-nlc2": "f694",
    	"sym-nlg-s": "f695",
    	"sym-nlg": "f696",
    	"sym-nmc-s": "f697",
    	"sym-nmc": "f698",
    	"sym-nmr-s": "f699",
    	"sym-nmr": "f69a",
    	"sym-nn-s": "f69b",
    	"sym-nn": "f69c",
    	"sym-noah-s": "f69d",
    	"sym-noah": "f69e",
    	"sym-nodl-s": "f69f",
    	"sym-nodl": "f6a0",
    	"sym-note-s": "f6a1",
    	"sym-note": "f6a2",
    	"sym-npg-s": "f6a3",
    	"sym-npg": "f6a4",
    	"sym-nplc-s": "f6a5",
    	"sym-nplc": "f6a6",
    	"sym-npxs-s": "f6a7",
    	"sym-npxs": "f6a8",
    	"sym-nq-s": "f6a9",
    	"sym-nq": "f6aa",
    	"sym-nrg-s": "f6ab",
    	"sym-nrg": "f6ac",
    	"sym-ntk-s": "f6ad",
    	"sym-ntk": "f6ae",
    	"sym-nu-s": "f6af",
    	"sym-nu": "f6b0",
    	"sym-nuls-s": "f6b1",
    	"sym-nuls": "f6b2",
    	"sym-nvc-s": "f6b3",
    	"sym-nvc": "f6b4",
    	"sym-nxc-s": "f6b5",
    	"sym-nxc": "f6b6",
    	"sym-nxs-s": "f6b7",
    	"sym-nxs": "f6b8",
    	"sym-nxt-s": "f6b9",
    	"sym-nxt": "f6ba",
    	"sym-nym-s": "f6bb",
    	"sym-nym": "f6bc",
    	"sym-o-s": "f6bd",
    	"sym-o": "f6be",
    	"sym-oax-s": "f6bf",
    	"sym-oax": "f6c0",
    	"sym-ocean-s": "f6c1",
    	"sym-ocean": "f6c2",
    	"sym-ocn-s": "f6c3",
    	"sym-ocn": "f6c4",
    	"sym-ode-s": "f6c5",
    	"sym-ode": "f6c6",
    	"sym-ogn-s": "f6c7",
    	"sym-ogn": "f6c8",
    	"sym-ogo-s": "f6c9",
    	"sym-ogo": "f6ca",
    	"sym-ok-s": "f6cb",
    	"sym-ok": "f6cc",
    	"sym-okb-s": "f6cd",
    	"sym-okb": "f6ce",
    	"sym-om-s": "f6cf",
    	"sym-om": "f6d0",
    	"sym-omg-s": "f6d1",
    	"sym-omg": "f6d2",
    	"sym-omni-s": "f6d3",
    	"sym-omni": "f6d4",
    	"sym-one-s": "f6d5",
    	"sym-one": "f6d6",
    	"sym-ong-s": "f6d7",
    	"sym-ong": "f6d8",
    	"sym-onot-s": "f6d9",
    	"sym-onot": "f6da",
    	"sym-ont-s": "f6db",
    	"sym-ont": "f6dc",
    	"sym-ooki-s": "f6dd",
    	"sym-ooki": "f6de",
    	"sym-orbs-s": "f6df",
    	"sym-orbs": "f6e0",
    	"sym-orca-s": "f6e1",
    	"sym-orca": "f6e2",
    	"sym-orme-s": "f6e3",
    	"sym-orme": "f6e4",
    	"sym-orn-s": "f6e5",
    	"sym-orn": "f6e6",
    	"sym-ors-s": "f6e7",
    	"sym-ors": "f6e8",
    	"sym-osmo-s": "f6e9",
    	"sym-osmo": "f6ea",
    	"sym-ost-s": "f6eb",
    	"sym-ost": "f6ec",
    	"sym-otn-s": "f6ed",
    	"sym-otn": "f6ee",
    	"sym-oxt-s": "f6ef",
    	"sym-oxt": "f6f0",
    	"sym-oxy-s": "f6f1",
    	"sym-oxy": "f6f2",
    	"sym-pai-s": "f6f3",
    	"sym-pai": "f6f4",
    	"sym-pal-s": "f6f5",
    	"sym-pal": "f6f6",
    	"sym-paper-s": "f6f7",
    	"sym-paper": "f6f8",
    	"sym-para-s": "f6f9",
    	"sym-para": "f6fa",
    	"sym-part-s": "f6fb",
    	"sym-part": "f6fc",
    	"sym-pasc-s": "f6fd",
    	"sym-pasc": "f6fe",
    	"sym-pat-s": "f6ff",
    	"sym-pat": "f700",
    	"sym-pax-s": "f701",
    	"sym-pax": "f702",
    	"sym-paxg-s": "f703",
    	"sym-paxg": "f704",
    	"sym-pay-s": "f705",
    	"sym-pay": "f706",
    	"sym-pbt-s": "f707",
    	"sym-pbt": "f708",
    	"sym-pcl-s": "f709",
    	"sym-pcl": "f70a",
    	"sym-pcx-s": "f70b",
    	"sym-pcx": "f70c",
    	"sym-pdex-s": "f70d",
    	"sym-pdex": "f70e",
    	"sym-people-s": "f70f",
    	"sym-people": "f710",
    	"sym-perl-s": "f711",
    	"sym-perl": "f712",
    	"sym-perp-s": "f713",
    	"sym-perp": "f714",
    	"sym-pha-s": "f715",
    	"sym-pha": "f716",
    	"sym-phb-s": "f717",
    	"sym-phb": "f718",
    	"sym-php-s": "f719",
    	"sym-php": "f71a",
    	"sym-phx-s": "f71b",
    	"sym-phx": "f71c",
    	"sym-pi-s": "f71d",
    	"sym-pi": "f71e",
    	"sym-pica-s": "f71f",
    	"sym-pica": "f720",
    	"sym-pink-s": "f721",
    	"sym-pink": "f722",
    	"sym-pivx-s": "f723",
    	"sym-pivx": "f724",
    	"sym-pkt-s": "f725",
    	"sym-pkt": "f726",
    	"sym-pl-s": "f727",
    	"sym-pl": "f728",
    	"sym-pla-s": "f729",
    	"sym-pla": "f72a",
    	"sym-plbt-s": "f72b",
    	"sym-plbt": "f72c",
    	"sym-plm-s": "f72d",
    	"sym-plm": "f72e",
    	"sym-pln-s": "f72f",
    	"sym-pln": "f730",
    	"sym-plr-s": "f731",
    	"sym-plr": "f732",
    	"sym-ply-s": "f733",
    	"sym-ply": "f734",
    	"sym-pma-s": "f735",
    	"sym-pma": "f736",
    	"sym-png-s": "f737",
    	"sym-png": "f738",
    	"sym-pnt-s": "f739",
    	"sym-pnt": "f73a",
    	"sym-poa-s": "f73b",
    	"sym-poa": "f73c",
    	"sym-poe-s": "f73d",
    	"sym-poe": "f73e",
    	"sym-polis-s": "f73f",
    	"sym-polis": "f740",
    	"sym-pols-s": "f741",
    	"sym-pols": "f742",
    	"sym-poly-s": "f743",
    	"sym-poly": "f744",
    	"sym-pond-s": "f745",
    	"sym-pond": "f746",
    	"sym-pot-s": "f747",
    	"sym-pot": "f748",
    	"sym-powr-s": "f749",
    	"sym-powr": "f74a",
    	"sym-ppc-s": "f74b",
    	"sym-ppc": "f74c",
    	"sym-ppt-s": "f74d",
    	"sym-ppt": "f74e",
    	"sym-pra-s": "f74f",
    	"sym-pra": "f750",
    	"sym-pre-s": "f751",
    	"sym-pre": "f752",
    	"sym-prg-s": "f753",
    	"sym-prg": "f754",
    	"sym-pro-s": "f755",
    	"sym-pro": "f756",
    	"sym-prq-s": "f757",
    	"sym-prq": "f758",
    	"sym-pst-s": "f759",
    	"sym-pst": "f75a",
    	"sym-pstake-s": "f75b",
    	"sym-pstake": "f75c",
    	"sym-pton-s": "f75d",
    	"sym-pton": "f75e",
    	"sym-pundix-s": "f75f",
    	"sym-pundix": "f760",
    	"sym-pvt-s": "f761",
    	"sym-pvt": "f762",
    	"sym-pxg-s": "f763",
    	"sym-pxg": "f764",
    	"sym-pyr-s": "f765",
    	"sym-pyr": "f766",
    	"sym-qash-s": "f767",
    	"sym-qash": "f768",
    	"sym-qau-s": "f769",
    	"sym-qau": "f76a",
    	"sym-qc-s": "f76b",
    	"sym-qc": "f76c",
    	"sym-qi-s": "f76d",
    	"sym-qi": "f76e",
    	"sym-qi2-s": "f76f",
    	"sym-qi2": "f770",
    	"sym-qkc-s": "f771",
    	"sym-qkc": "f772",
    	"sym-qlc-s": "f773",
    	"sym-qlc": "f774",
    	"sym-qnt-s": "f775",
    	"sym-qnt": "f776",
    	"sym-qntu-s": "f777",
    	"sym-qntu": "f778",
    	"sym-qo-s": "f779",
    	"sym-qo": "f77a",
    	"sym-qrdo-s": "f77b",
    	"sym-qrdo": "f77c",
    	"sym-qrl-s": "f77d",
    	"sym-qrl": "f77e",
    	"sym-qsp-s": "f77f",
    	"sym-qsp": "f780",
    	"sym-qtum-s": "f781",
    	"sym-qtum": "f782",
    	"sym-quick-s": "f783",
    	"sym-quick": "f784",
    	"sym-qun-s": "f785",
    	"sym-qun": "f786",
    	"sym-r-s": "f787",
    	"sym-r": "f788",
    	"sym-rad-s": "f789",
    	"sym-rad": "f78a",
    	"sym-radar-s": "f78b",
    	"sym-radar": "f78c",
    	"sym-rads-s": "f78d",
    	"sym-rads": "f78e",
    	"sym-ramp-s": "f78f",
    	"sym-ramp": "f790",
    	"sym-rare-s": "f791",
    	"sym-rare": "f792",
    	"sym-rari-s": "f793",
    	"sym-rari": "f794",
    	"sym-rating-s": "f795",
    	"sym-rating": "f796",
    	"sym-ray-s": "f797",
    	"sym-ray": "f798",
    	"sym-rb-s": "f799",
    	"sym-rb": "f79a",
    	"sym-rbc-s": "f79b",
    	"sym-rbc": "f79c",
    	"sym-rblx-s": "f79d",
    	"sym-rblx": "f79e",
    	"sym-rbn-s": "f79f",
    	"sym-rbn": "f7a0",
    	"sym-rbtc-s": "f7a1",
    	"sym-rbtc": "f7a2",
    	"sym-rby-s": "f7a3",
    	"sym-rby": "f7a4",
    	"sym-rcn-s": "f7a5",
    	"sym-rcn": "f7a6",
    	"sym-rdd-s": "f7a7",
    	"sym-rdd": "f7a8",
    	"sym-rdn-s": "f7a9",
    	"sym-rdn": "f7aa",
    	"sym-real-s": "f7ab",
    	"sym-real": "f7ac",
    	"sym-reef-s": "f7ad",
    	"sym-reef": "f7ae",
    	"sym-rem-s": "f7af",
    	"sym-rem": "f7b0",
    	"sym-ren-s": "f7b1",
    	"sym-ren": "f7b2",
    	"sym-rep-s": "f7b3",
    	"sym-rep": "f7b4",
    	"sym-repv2-s": "f7b5",
    	"sym-repv2": "f7b6",
    	"sym-req-s": "f7b7",
    	"sym-req": "f7b8",
    	"sym-rev-s": "f7b9",
    	"sym-rev": "f7ba",
    	"sym-revv-s": "f7bb",
    	"sym-revv": "f7bc",
    	"sym-rfox-s": "f7bd",
    	"sym-rfox": "f7be",
    	"sym-rfr-s": "f7bf",
    	"sym-rfr": "f7c0",
    	"sym-ric-s": "f7c1",
    	"sym-ric": "f7c2",
    	"sym-rif-s": "f7c3",
    	"sym-rif": "f7c4",
    	"sym-ring-s": "f7c5",
    	"sym-ring": "f7c6",
    	"sym-rlc-s": "f7c7",
    	"sym-rlc": "f7c8",
    	"sym-rly-s": "f7c9",
    	"sym-rly": "f7ca",
    	"sym-rmrk-s": "f7cb",
    	"sym-rmrk": "f7cc",
    	"sym-rndr-s": "f7cd",
    	"sym-rndr": "f7ce",
    	"sym-rntb-s": "f7cf",
    	"sym-rntb": "f7d0",
    	"sym-ron-s": "f7d1",
    	"sym-ron": "f7d2",
    	"sym-rook-s": "f7d3",
    	"sym-rook": "f7d4",
    	"sym-rose-s": "f7d5",
    	"sym-rose": "f7d6",
    	"sym-rox-s": "f7d7",
    	"sym-rox": "f7d8",
    	"sym-rp-s": "f7d9",
    	"sym-rp": "f7da",
    	"sym-rpx-s": "f7db",
    	"sym-rpx": "f7dc",
    	"sym-rsr-s": "f7dd",
    	"sym-rsr": "f7de",
    	"sym-rsv-s": "f7df",
    	"sym-rsv": "f7e0",
    	"sym-rty-s": "f7e1",
    	"sym-rty": "f7e2",
    	"sym-rub-s": "f7e3",
    	"sym-rub": "f7e4",
    	"sym-ruff-s": "f7e5",
    	"sym-ruff": "f7e6",
    	"sym-rune-s": "f7e7",
    	"sym-rune": "f7e8",
    	"sym-rvn-s": "f7e9",
    	"sym-rvn": "f7ea",
    	"sym-rvr-s": "f7eb",
    	"sym-rvr": "f7ec",
    	"sym-rvt-s": "f7ed",
    	"sym-rvt": "f7ee",
    	"sym-sai-s": "f7ef",
    	"sym-sai": "f7f0",
    	"sym-salt-s": "f7f1",
    	"sym-salt": "f7f2",
    	"sym-samo-s": "f7f3",
    	"sym-samo": "f7f4",
    	"sym-san-s": "f7f5",
    	"sym-san": "f7f6",
    	"sym-sand-s": "f7f7",
    	"sym-sand": "f7f8",
    	"sym-sats-s": "f7f9",
    	"sym-sats": "f7fa",
    	"sym-sbd-s": "f7fb",
    	"sym-sbd": "f7fc",
    	"sym-sbr-s": "f7fd",
    	"sym-sbr": "f7fe",
    	"sym-sc-s": "f7ff",
    	"sym-sc": "f800",
    	"sym-scc-s": "f801",
    	"sym-scc": "f802",
    	"sym-scrt-s": "f803",
    	"sym-scrt": "f804",
    	"sym-sdc-s": "f805",
    	"sym-sdc": "f806",
    	"sym-sdn-s": "f807",
    	"sym-sdn": "f808",
    	"sym-seele-s": "f809",
    	"sym-seele": "f80a",
    	"sym-sek-s": "f80b",
    	"sym-sek": "f80c",
    	"sym-sen-s": "f80d",
    	"sym-sen": "f80e",
    	"sym-sent-s": "f80f",
    	"sym-sent": "f810",
    	"sym-sero-s": "f811",
    	"sym-sero": "f812",
    	"sym-sexc-s": "f813",
    	"sym-sexc": "f814",
    	"sym-sfp-s": "f815",
    	"sym-sfp": "f816",
    	"sym-sgb-s": "f817",
    	"sym-sgb": "f818",
    	"sym-sgc-s": "f819",
    	"sym-sgc": "f81a",
    	"sym-sgd-s": "f81b",
    	"sym-sgd": "f81c",
    	"sym-sgn-s": "f81d",
    	"sym-sgn": "f81e",
    	"sym-sgu-s": "f81f",
    	"sym-sgu": "f820",
    	"sym-shib-s": "f821",
    	"sym-shib": "f822",
    	"sym-shift-s": "f823",
    	"sym-shift": "f824",
    	"sym-ship-s": "f825",
    	"sym-ship": "f826",
    	"sym-shping-s": "f827",
    	"sym-shping": "f828",
    	"sym-si-s": "f829",
    	"sym-si": "f82a",
    	"sym-sib-s": "f82b",
    	"sym-sib": "f82c",
    	"sym-sil-s": "f82d",
    	"sym-sil": "f82e",
    	"sym-six-s": "f82f",
    	"sym-six": "f830",
    	"sym-sjcx-s": "f831",
    	"sym-sjcx": "f832",
    	"sym-skl-s": "f833",
    	"sym-skl": "f834",
    	"sym-skm-s": "f835",
    	"sym-skm": "f836",
    	"sym-sku-s": "f837",
    	"sym-sku": "f838",
    	"sym-sky-s": "f839",
    	"sym-sky": "f83a",
    	"sym-slp-s": "f83b",
    	"sym-slp": "f83c",
    	"sym-slr-s": "f83d",
    	"sym-slr": "f83e",
    	"sym-sls-s": "f83f",
    	"sym-sls": "f840",
    	"sym-slt-s": "f841",
    	"sym-slt": "f842",
    	"sym-slv-s": "f843",
    	"sym-slv": "f844",
    	"sym-smart-s": "f845",
    	"sym-smart": "f846",
    	"sym-smn-s": "f847",
    	"sym-smn": "f848",
    	"sym-smt-s": "f849",
    	"sym-smt": "f84a",
    	"sym-snc-s": "f84b",
    	"sym-snc": "f84c",
    	"sym-snet-s": "f84d",
    	"sym-snet": "f84e",
    	"sym-sngls-s": "f84f",
    	"sym-sngls": "f850",
    	"sym-snm-s": "f851",
    	"sym-snm": "f852",
    	"sym-snt-s": "f853",
    	"sym-snt": "f854",
    	"sym-snx-s": "f855",
    	"sym-snx": "f856",
    	"sym-soc-s": "f857",
    	"sym-soc": "f858",
    	"sym-socks-s": "f859",
    	"sym-socks": "f85a",
    	"sym-sol-s": "f85b",
    	"sym-sol": "f85c",
    	"sym-solid-s": "f85d",
    	"sym-solid": "f85e",
    	"sym-solo-s": "f85f",
    	"sym-solo": "f860",
    	"sym-solve-s": "f861",
    	"sym-solve": "f862",
    	"sym-sos-s": "f863",
    	"sym-sos": "f864",
    	"sym-soul-s": "f865",
    	"sym-soul": "f866",
    	"sym-sp-s": "f867",
    	"sym-sp": "f868",
    	"sym-sparta-s": "f869",
    	"sym-sparta": "f86a",
    	"sym-spc-s": "f86b",
    	"sym-spc": "f86c",
    	"sym-spd-s": "f86d",
    	"sym-spd": "f86e",
    	"sym-spell-s": "f86f",
    	"sym-spell": "f870",
    	"sym-sphr-s": "f871",
    	"sym-sphr": "f872",
    	"sym-sphtx-s": "f873",
    	"sym-sphtx": "f874",
    	"sym-spnd-s": "f875",
    	"sym-spnd": "f876",
    	"sym-spnk-s": "f877",
    	"sym-spnk": "f878",
    	"sym-srm-s": "f879",
    	"sym-srm": "f87a",
    	"sym-srn-s": "f87b",
    	"sym-srn": "f87c",
    	"sym-ssp-s": "f87d",
    	"sym-ssp": "f87e",
    	"sym-stacs-s": "f87f",
    	"sym-stacs": "f880",
    	"sym-step-s": "f881",
    	"sym-step": "f882",
    	"sym-stg-s": "f883",
    	"sym-stg": "f884",
    	"sym-stmx-s": "f885",
    	"sym-stmx": "f886",
    	"sym-storm-s": "f887",
    	"sym-storm": "f888",
    	"sym-stpt-s": "f889",
    	"sym-stpt": "f88a",
    	"sym-stq-s": "f88b",
    	"sym-stq": "f88c",
    	"sym-str-s": "f88d",
    	"sym-str": "f88e",
    	"sym-strat-s": "f88f",
    	"sym-strat": "f890",
    	"sym-strax-s": "f891",
    	"sym-strax": "f892",
    	"sym-strk-s": "f893",
    	"sym-strk": "f894",
    	"sym-strong-s": "f895",
    	"sym-strong": "f896",
    	"sym-stx-s": "f897",
    	"sym-stx": "f898",
    	"sym-sub-s": "f899",
    	"sym-sub": "f89a",
    	"sym-sun-s": "f89b",
    	"sym-sun": "f89c",
    	"sym-super-s": "f89d",
    	"sym-super": "f89e",
    	"sym-susd-s": "f89f",
    	"sym-susd": "f8a0",
    	"sym-sushi-s": "f8a1",
    	"sym-sushi": "f8a2",
    	"sym-swftc-s": "f8a3",
    	"sym-swftc": "f8a4",
    	"sym-swm-s": "f8a5",
    	"sym-swm": "f8a6",
    	"sym-swrv-s": "f8a7",
    	"sym-swrv": "f8a8",
    	"sym-swt-s": "f8a9",
    	"sym-swt": "f8aa",
    	"sym-swth-s": "f8ab",
    	"sym-swth": "f8ac",
    	"sym-sxp-s": "f8ad",
    	"sym-sxp": "f8ae",
    	"sym-syn-s": "f8af",
    	"sym-syn": "f8b0",
    	"sym-sys-s": "f8b1",
    	"sym-sys": "f8b2",
    	"sym-t-s": "f8b3",
    	"sym-t": "f8b4",
    	"sym-taas-s": "f8b5",
    	"sym-taas": "f8b6",
    	"sym-tau-s": "f8b7",
    	"sym-tau": "f8b8",
    	"sym-tbtc-s": "f8b9",
    	"sym-tbtc": "f8ba",
    	"sym-tct-s": "f8bb",
    	"sym-tct": "f8bc",
    	"sym-teer-s": "f8bd",
    	"sym-teer": "f8be",
    	"sym-tel-s": "f8bf",
    	"sym-temco-s": "f8c0",
    	"sym-temco": "f8c1",
    	"sym-tfuel-s": "f8c2",
    	"sym-tfuel": "f8c3",
    	"sym-thb-s": "f8c4",
    	"sym-thb": "f8c5",
    	"sym-thc-s": "f8c6",
    	"sym-thc": "f8c7",
    	"sym-theta-s": "f8c8",
    	"sym-theta": "f8c9",
    	"sym-thx-s": "f8ca",
    	"sym-thx": "f8cb",
    	"sym-time-s": "f8cc",
    	"sym-time": "f8cd",
    	"sym-tio-s": "f8ce",
    	"sym-tio": "f8cf",
    	"sym-tix-s": "f8d0",
    	"sym-tix": "f8d1",
    	"sym-tkn-s": "f8d2",
    	"sym-tkn": "f8d3",
    	"sym-tky-s": "f8d4",
    	"sym-tky": "f8d5",
    	"sym-tlm-s": "f8d6",
    	"sym-tlm": "f8d7",
    	"sym-tnb-s": "f8d8",
    	"sym-tnb": "f8d9",
    	"sym-tnc-s": "f8da",
    	"sym-tnc": "f8db",
    	"sym-tnt-s": "f8dc",
    	"sym-tnt": "f8dd",
    	"sym-toke-s": "f8de",
    	"sym-toke": "f8df",
    	"sym-tomb-s": "f8e0",
    	"sym-tomb": "f8e1",
    	"sym-tomo-s": "f8e2",
    	"sym-tomo": "f8e3",
    	"sym-top-s": "f8e4",
    	"sym-top": "f8e5",
    	"sym-torn-s": "f8e6",
    	"sym-torn": "f8e7",
    	"sym-tower-s": "f8e8",
    	"sym-tower": "f8e9",
    	"sym-tpay-s": "f8ea",
    	"sym-tpay": "f8eb",
    	"sym-trac-s": "f8ec",
    	"sym-trac": "f8ed",
    	"sym-trb-s": "f8ee",
    	"sym-trb": "f8ef",
    	"sym-tribe-s": "f8f0",
    	"sym-tribe": "f8f1",
    	"sym-trig-s": "f8f2",
    	"sym-trig": "f8f3",
    	"sym-trio-s": "f8f4",
    	"sym-trio": "f8f5",
    	"sym-troy-s": "f8f6",
    	"sym-troy": "f8f7",
    	"sym-trst-s": "f8f8",
    	"sym-trst": "f8f9",
    	"sym-tru-s": "f8fa",
    	"sym-tru": "f8fb",
    	"sym-true-s": "f8fc",
    	"sym-true": "f8fd",
    	"sym-trx-s": "f8fe",
    	"sym-trx": "f8ff",
    	"sym-try-s": "f900",
    	"sym-try": "f901",
    	"sym-tryb-s": "f902",
    	"sym-tryb": "f903",
    	"sym-tt-s": "f904",
    	"sym-tt": "f905",
    	"sym-ttc-s": "f906",
    	"sym-ttc": "f907",
    	"sym-ttt-s": "f908",
    	"sym-ttt": "f909",
    	"sym-ttu-s": "f90a",
    	"sym-ttu": "f90b",
    	"sym-tube-s": "f90c",
    	"sym-tube": "f90d",
    	"sym-tusd-s": "f90e",
    	"sym-tusd": "f90f",
    	"sym-tvk-s": "f910",
    	"sym-tvk": "f911",
    	"sym-twt-s": "f912",
    	"sym-twt": "f913",
    	"sym-uah-s": "f914",
    	"sym-uah": "f915",
    	"sym-ubq-s": "f916",
    	"sym-ubq": "f917",
    	"sym-ubt-s": "f918",
    	"sym-ubt": "f919",
    	"sym-uft-s": "f91a",
    	"sym-uft": "f91b",
    	"sym-ugas-s": "f91c",
    	"sym-ugas": "f91d",
    	"sym-uip-s": "f91e",
    	"sym-uip": "f91f",
    	"sym-ukg-s": "f920",
    	"sym-ukg": "f921",
    	"sym-uma-s": "f922",
    	"sym-uma": "f923",
    	"sym-unfi-s": "f924",
    	"sym-unfi": "f925",
    	"sym-uni-s": "f926",
    	"sym-uni": "f927",
    	"sym-unq-s": "f928",
    	"sym-unq": "f929",
    	"sym-up-s": "f92a",
    	"sym-up": "f92b",
    	"sym-upp-s": "f92c",
    	"sym-upp": "f92d",
    	"sym-usd-s": "f92e",
    	"sym-usd": "f92f",
    	"sym-usdc-s": "f930",
    	"sym-usdc": "f931",
    	"sym-usds-s": "f932",
    	"sym-usds": "f933",
    	"sym-usk-s": "f934",
    	"sym-usk": "f935",
    	"sym-ust-s": "f936",
    	"sym-ust": "f937",
    	"sym-utk-s": "f938",
    	"sym-utk": "f939",
    	"sym-utnp-s": "f93a",
    	"sym-utnp": "f93b",
    	"sym-utt-s": "f93c",
    	"sym-utt": "f93d",
    	"sym-uuu-s": "f93e",
    	"sym-uuu": "f93f",
    	"sym-ux-s": "f940",
    	"sym-ux": "f941",
    	"sym-vader-s": "f942",
    	"sym-vader": "f943",
    	"sym-vai-s": "f944",
    	"sym-vai": "f945",
    	"sym-vbk-s": "f946",
    	"sym-vbk": "f947",
    	"sym-vdx-s": "f948",
    	"sym-vdx": "f949",
    	"sym-vee-s": "f94a",
    	"sym-vee": "f94b",
    	"sym-vemp-s": "f94c",
    	"sym-vemp": "f94d",
    	"sym-ven-s": "f94e",
    	"sym-ven": "f94f",
    	"sym-veo-s": "f950",
    	"sym-veo": "f951",
    	"sym-veri-s": "f952",
    	"sym-veri": "f953",
    	"sym-vex-s": "f954",
    	"sym-vex": "f955",
    	"sym-vgx-s": "f956",
    	"sym-vgx": "f957",
    	"sym-via-s": "f958",
    	"sym-via": "f959",
    	"sym-vib-s": "f95a",
    	"sym-vib": "f95b",
    	"sym-vibe-s": "f95c",
    	"sym-vibe": "f95d",
    	"sym-vid-s": "f95e",
    	"sym-vid": "f95f",
    	"sym-vidt-s": "f960",
    	"sym-vidt": "f961",
    	"sym-vidy-s": "f962",
    	"sym-vidy": "f963",
    	"sym-vitae-s": "f964",
    	"sym-vitae": "f965",
    	"sym-vite-s": "f966",
    	"sym-vite": "f967",
    	"sym-vlx-s": "f968",
    	"sym-vlx": "f969",
    	"sym-vox-s": "f96a",
    	"sym-vox": "f96b",
    	"sym-voxel-s": "f96c",
    	"sym-voxel": "f96d",
    	"sym-vra-s": "f96e",
    	"sym-vra": "f96f",
    	"sym-vrc-s": "f970",
    	"sym-vrc": "f971",
    	"sym-vrm-s": "f972",
    	"sym-vrm": "f973",
    	"sym-vsys-s": "f974",
    	"sym-vsys": "f975",
    	"sym-vtc-s": "f976",
    	"sym-vtc": "f977",
    	"sym-vtho-s": "f978",
    	"sym-vtho": "f979",
    	"sym-wabi-s": "f97a",
    	"sym-wabi": "f97b",
    	"sym-wan-s": "f97c",
    	"sym-wan": "f97d",
    	"sym-waves-s": "f97e",
    	"sym-waves": "f97f",
    	"sym-wax-s": "f980",
    	"sym-wax": "f981",
    	"sym-wbtc-s": "f982",
    	"sym-wbtc": "f983",
    	"sym-wet-s": "f984",
    	"sym-wet": "f985",
    	"sym-weth-s": "f986",
    	"sym-weth": "f987",
    	"sym-wib-s": "f988",
    	"sym-wib": "f989",
    	"sym-wicc-s": "f98a",
    	"sym-wicc": "f98b",
    	"sym-win-s": "f98c",
    	"sym-win": "f98d",
    	"sym-wing-s": "f98e",
    	"sym-wing": "f98f",
    	"sym-wings-s": "f990",
    	"sym-wings": "f991",
    	"sym-wnxm-s": "f992",
    	"sym-wnxm": "f993",
    	"sym-woo-s": "f994",
    	"sym-woo": "f995",
    	"sym-wpr-s": "f996",
    	"sym-wpr": "f997",
    	"sym-wrx-s": "f998",
    	"sym-wrx": "f999",
    	"sym-wtc-s": "f99a",
    	"sym-wtc": "f99b",
    	"sym-wtt-s": "f99c",
    	"sym-wtt": "f99d",
    	"sym-wwb-s": "f99e",
    	"sym-wwb": "f99f",
    	"sym-wxt-s": "f9a0",
    	"sym-wxt": "f9a1",
    	"sym-xas-s": "f9a2",
    	"sym-xas": "f9a3",
    	"sym-xaur-s": "f9a4",
    	"sym-xaur": "f9a5",
    	"sym-xaut-s": "f9a6",
    	"sym-xaut": "f9a7",
    	"sym-xava-s": "f9a8",
    	"sym-xava": "f9a9",
    	"sym-xbc-s": "f9aa",
    	"sym-xbc": "f9ab",
    	"sym-xcon-s": "f9ac",
    	"sym-xcon": "f9ad",
    	"sym-xcp-s": "f9ae",
    	"sym-xcp": "f9af",
    	"sym-xdefi-s": "f9b0",
    	"sym-xdefi": "f9b1",
    	"sym-xdn-s": "f9b2",
    	"sym-xdn": "f9b3",
    	"sym-xel-s": "f9b4",
    	"sym-xel": "f9b5",
    	"sym-xem-s": "f9b6",
    	"sym-xem": "f9b7",
    	"sym-xes-s": "f9b8",
    	"sym-xes": "f9b9",
    	"sym-xhv-s": "f9ba",
    	"sym-xhv": "f9bb",
    	"sym-xin-s": "f9bc",
    	"sym-xin": "f9bd",
    	"sym-xlm-s": "f9be",
    	"sym-xlm": "f9bf",
    	"sym-xmc-s": "f9c0",
    	"sym-xmc": "f9c1",
    	"sym-xmr-s": "f9c2",
    	"sym-xmr": "f9c3",
    	"sym-xmx-s": "f9c4",
    	"sym-xmx": "f9c5",
    	"sym-xmy-s": "f9c6",
    	"sym-xmy": "f9c7",
    	"sym-xnk-s": "f9c8",
    	"sym-xnk": "f9c9",
    	"sym-xns-s": "f9ca",
    	"sym-xns": "f9cb",
    	"sym-xor-s": "f9cc",
    	"sym-xor": "f9cd",
    	"sym-xos-s": "f9ce",
    	"sym-xos": "f9cf",
    	"sym-xpm-s": "f9d0",
    	"sym-xpm": "f9d1",
    	"sym-xpr-s": "f9d2",
    	"sym-xpr": "f9d3",
    	"sym-xrc-s": "f9d4",
    	"sym-xrc": "f9d5",
    	"sym-xrp-s": "f9d6",
    	"sym-xrp": "f9d7",
    	"sym-xrpx-s": "f9d8",
    	"sym-xrpx": "f9d9",
    	"sym-xrt-s": "f9da",
    	"sym-xrt": "f9db",
    	"sym-xst-s": "f9dc",
    	"sym-xst": "f9dd",
    	"sym-xtp-s": "f9de",
    	"sym-xtp": "f9df",
    	"sym-xtz-s": "f9e0",
    	"sym-xtz": "f9e1",
    	"sym-xtzdown-s": "f9e2",
    	"sym-xtzdown": "f9e3",
    	"sym-xvc-s": "f9e4",
    	"sym-xvc": "f9e5",
    	"sym-xvg-s": "f9e6",
    	"sym-xvg": "f9e7",
    	"sym-xvs-s": "f9e8",
    	"sym-xvs": "f9e9",
    	"sym-xwc-s": "f9ea",
    	"sym-xwc": "f9eb",
    	"sym-xyo-s": "f9ec",
    	"sym-xyo": "f9ed",
    	"sym-xzc-s": "f9ee",
    	"sym-xzc": "f9ef",
    	"sym-yam-s": "f9f0",
    	"sym-yam": "f9f1",
    	"sym-yee-s": "f9f2",
    	"sym-yee": "f9f3",
    	"sym-yeed-s": "f9f4",
    	"sym-yeed": "f9f5",
    	"sym-yfi-s": "f9f6",
    	"sym-yfi": "f9f7",
    	"sym-yfii-s": "f9f8",
    	"sym-yfii": "f9f9",
    	"sym-ygg-s": "f9fa",
    	"sym-ygg": "f9fb",
    	"sym-yoyow-s": "f9fc",
    	"sym-yoyow": "f9fd",
    	"sym-zar-s": "f9fe",
    	"sym-zar": "f9ff",
    	"sym-zcl-s": "fa00",
    	"sym-zcl": "fa01",
    	"sym-zcn-s": "fa02",
    	"sym-zcn": "fa03",
    	"sym-zco-s": "fa04",
    	"sym-zco": "fa05",
    	"sym-zec-s": "fa06",
    	"sym-zec": "fa07",
    	"sym-zen-s": "fa08",
    	"sym-zen": "fa09",
    	"sym-zil-s": "fa0a",
    	"sym-zil": "fa0b",
    	"sym-zks-s": "fa0c",
    	"sym-zks": "fa0d",
    	"sym-zla-s": "fa0e",
    	"sym-zla": "fa0f",
    	"sym-zlk": "fa10",
    	"sym-zondo-s": "fa11",
    	"sym-zondo": "fa12",
    	"sym-zpr-s": "fa13",
    	"sym-zpr": "fa14",
    	"sym-zpt-s": "fa15",
    	"sym-zpt": "fa16",
    	"sym-zrc-s": "fa17",
    	"sym-zrc": "fa18",
    	"sym-zrx-s": "fa19",
    	"sym-zrx": "fa1a",
    	"sym-zsc-s": "fa1b",
    	"sym-zsc": "fa1c",
    	"sym-ztg-s": "fa1d",
    	"sym-ztg": "fa1e",
    	"ustc-s": "fa1f",
    	ustc: ustc,
    	"cur-anct": "f1d2",
    	"cur-anct-s": "f1d1",
    	"cur-aud": "f200",
    	"cur-aud-s": "f1ff",
    	"cur-bnb": "f271",
    	"cur-bnb-s": "f270",
    	"sym-xbt": "f299",
    	"cur-btc": "f299",
    	"sym-xbt-s": "f298",
    	"cur-btc-s": "f298",
    	"cur-busd": "f2b9",
    	"cur-busd-s": "f2b8",
    	"exc-bitz": "f2bd",
    	"cur-bz": "f2bd",
    	"exc-bitz-s": "f2bc",
    	"cur-bz-s": "f2bc",
    	"cur-cad": "f2c7",
    	"cur-cad-s": "f2c6",
    	"cur-chf": "f2e7",
    	"cur-chf-s": "f2e6",
    	"cur-cny": "f30b",
    	"cur-cny-s": "f30a",
    	"sym-cs": "f31f",
    	"sym-cs-s": "f31e",
    	"sym-crm": "f337",
    	"sym-crm-s": "f336",
    	"cur-dai": "f365",
    	"cur-dai-s": "f364",
    	"sym-xdg": "f3a3",
    	"sym-xdg-s": "f3a2",
    	"cur-eos": "f3f0",
    	"cur-eos-s": "f3ef",
    	"sym-eth2": "f400",
    	"sym-eth2s": "f400",
    	"sym-eth2.s": "f400",
    	"cur-eth": "f400",
    	"sym-eth2-s": "f3ff",
    	"sym-eth2s-s": "f3ff",
    	"sym-eth2.s-s": "f3ff",
    	"cur-eth-s": "f3ff",
    	"cur-eur": "f408",
    	"cur-eur-s": "f407",
    	"cur-eurs": "f40a",
    	"cur-eurs-s": "f409",
    	"sym-usdt": "f40c",
    	"cur-usdt": "f40c",
    	"sym-usdt-s": "f40b",
    	"cur-usdt-s": "f40b",
    	"exc-kraken": "f424",
    	"exc-kraken-futures": "f424",
    	"exc-kraken-s": "f423",
    	"exc-kraken-futures-s": "f423",
    	"cur-gbp": "f478",
    	"cur-gbp-s": "f477",
    	"exc-gemini": "f4c0",
    	"cur-gusd": "f4c0",
    	"exc-gemini-s": "f4bf",
    	"cur-gusd-s": "f4bf",
    	"cur-hkd": "f4e4",
    	"cur-hkd-s": "f4e3",
    	"sym-husd": "f500",
    	"exc-huobi": "f500",
    	"cur-ht": "f500",
    	"sym-husd-s": "f4ff",
    	"exc-huobi-s": "f4ff",
    	"cur-ht-s": "f4ff",
    	"cur-idr": "f520",
    	"cur-idr-s": "f51f",
    	"sym-iota": "f548",
    	"sym-iota-s": "f547",
    	"cur-inr": "f53a",
    	"cur-inr-s": "f539",
    	"cur-jpy": "f55e",
    	"cur-jpy-s": "f55d",
    	"cur-krw": "f58e",
    	"cur-krw-s": "f58d",
    	"sym-medx": "f608",
    	"sym-medx-s": "f607",
    	"cur-mxn": "f65e",
    	"cur-mxn-s": "f65d",
    	"cur-myr": "f660",
    	"cur-myr-s": "f65f",
    	"cur-ngn": "f68a",
    	"cur-ngn-s": "f689",
    	"cur-pax": "f702",
    	"cur-pax-s": "f701",
    	"cur-php": "f71a",
    	"cur-php-s": "f719",
    	"cur-pln": "f730",
    	"cur-pln-s": "f72f",
    	"cur-qash": "f768",
    	"cur-qash-s": "f767",
    	"cur-rub": "f7e4",
    	"cur-rur": "f7e4",
    	"cur-rub-s": "f7e3",
    	"cur-rur-s": "f7e3",
    	"sym-steem": "f7fc",
    	"sym-steem-s": "f7fb",
    	"sym-xsc": "f800",
    	"sym-xsc-s": "f7ff",
    	"cur-sgd": "f81c",
    	"cur-sgd-s": "f81b",
    	"sym-storj": "f832",
    	"sym-storj-s": "f831",
    	"sym-tel": "f8b6",
    	"cur-trx": "f8ff",
    	"cur-trx-s": "f8fe",
    	"cur-tusd": "f90f",
    	"cur-tusd-s": "f90e",
    	"cur-usd": "f92f",
    	"cur-usd-s": "f92e",
    	"cur-usdc": "f931",
    	"cur-usdc-s": "f930",
    	"sym-vet": "f94f",
    	"sym-vet-s": "f94e",
    	"sym-waxp": "f981",
    	"sym-waxp-s": "f980",
    	"cur-xlm": "f9bf",
    	"cur-xlm-s": "f9be",
    	"cur-xmr": "f9c3",
    	"cur-xmr-s": "f9c2",
    	"cur-xrp": "f9d7",
    	"cur-xrp-s": "f9d6",
    	"cur-zar": "f9ff",
    	"cur-zar-s": "f9fe",
    	"exc-binance-us": "f108",
    	"exc-binance-us-s": "f107",
    	"exc-mexbt": "f11e",
    	"exc-mexbt-s": "f11d",
    	"exc-coinbase-pro": "f12c",
    	"exc-gdax": "f12c",
    	"exc-coinbase-pro-s": "f12b",
    	"exc-gdax-s": "f12b",
    	"exc-quadriga": "f154",
    	"exc-quadriga-s": "f153",
    	"cur-crc": "f32b",
    	"cur-crc-s": "f32a",
    	"cur-lak": "f598",
    	"cur-lak-s": "f597",
    	"cur-sek": "f80c",
    	"cur-sek-s": "f80b",
    	"cur-thb": "f8c5",
    	"cur-thb-s": "f8c4",
    	"cur-try": "f901",
    	"cur-try-s": "f900",
    	"cur-uah": "f915",
    	"cur-uah-s": "f914",
    	"exc-ftx": "f458",
    	"exc-ftx-s": "f457",
    	"exc-ftx-us": "f458",
    	"exc-ftx-us-s": "f457",
    	"sym-cgld": "f2d7",
    	"sym-cgld-s": "f2d6",
    	"exc-uniswap-v2": "f927",
    	"exc-uniswap-v2-s": "f926",
    	"sym-kshib": "f822",
    	"sym-kshib-s": "f821",
    	"sym-easy-s": "f3c4",
    	"sym-srare": "f792",
    	"sym-srare-s": "f791",
    	"sym-ape.2": "f1d8",
    	"sym-ape.2-s": "f1d7"
    };

    var _default = "";
    var d = "";
    var axieinfinity = "";
    var bibox = "";
    var binance = "Binance";
    var bisq = "Bisq";
    var bitbay = "";
    var bitfinex = "Bitfinex";
    var bitflyer = "bitFlyer";
    var bithumb = "Bithumb";
    var bitmex = "BitMEX";
    var bitso = "";
    var bitsquare = "";
    var bitstamp = "Bitstamp";
    var bittrex = "Bittrex";
    var bitvc = "BitVC";
    var btcchina = "";
    var btce = "";
    var bybit = "";
    var cexio = "CEX.IO";
    var cme = "CME (Beta)";
    var coinbase = "";
    var coinbasepro = "";
    var coinone = "Coinone";
    var comex = "COMEX (Beta)";
    var cryptofacilities = "";
    var deribit = "Deribit";
    var gateio = "Gate.io";
    var hitbtc = "HitBTC";
    var kucoin = "";
    var liquid = "Liquid";
    var luno = "Luno";
    var mtgox = "Mt. Gox";
    var mxc = "MXC";
    var nbatopshop = "";
    var nymex = "NYMEX (Beta)";
    var okcoin = "OKCoin";
    var okx = "OKX";
    var opensea = "";
    var poloniex = "Poloniex";
    var qryptos = "";
    var quadrigacx = "";
    var quick = "QuickSwap";
    var quoine = "Quoine";
    var rarible = "";
    var totle = "";
    var upbit = "";
    var vaultofsatoshi = "";
    var wex = "WEX";
    var zaif = "";
    var zonda = "Zonda";
    var a38 = "Aluminum A380 Alloy (Patts) Futures";
    var aac = "Acute Angle Cloud";
    var aave = "Aave";
    var abbc = "ABBC Coin";
    var abt = "Arcblock";
    var abyss = "The Abyss";
    var aca = "Acala Token";
    var acat = "Alphacat";
    var ach = "Alchemy Pay";
    var act = "Achain";
    var ad0 = "";
    var ada = "Cardano";
    var adel = "";
    var adh = "AdHive";
    var adm = "ADAMANT Messenger";
    var ado = "";
    var adt = "adToken";
    var adx = "Ambire Adex";
    var ae = "Aeternity";
    var aed = "";
    var aeon = "Aeon";
    var aep = "Aluminium European Premium Duty-Unpaid (Metal Bulletin) Futures";
    var aergo = "Aergo";
    var agi = "SingularityNET";
    var agld = "Adventure Gold";
    var aid = "AIDUS TOKEN";
    var aion = "Aion";
    var air = "Altair";
    var akro = "Akropolis";
    var akt = "Akash Network";
    var alcx = "Alchemix";
    var aleph = "Aleph.im";
    var algo = "Algorand";
    var ali = "Aluminum Futures";
    var alice = "Alice";
    var alpha = "Alpha Finance Lab";
    var amb = "Ambrosus";
    var amlt = "AMLT";
    var amp = "Amp";
    var ampl = "Ampleforth";
    var anc = "Anchor Protocol";
    var anct = "Anchor";
    var ankr = "Ankr Network";
    var ant = "Aragon";
    var ape = "ApeCoin";
    var api3 = "API3";
    var apis = "APIS";
    var appc = "AppCoins";
    var ar = "Arweave";
    var ardr = "Ardor";
    var ark = "Ark";
    var arn = "Aeron";
    var arpa = "ARPA Chain";
    var art = "Maecenas";
    var aspt = "";
    var ast = "AirSwap";
    var astr = "Astar Network";
    var at = "Artfinity";
    var atlas = "Star Atlas";
    var atm = "Atletico Madrid Fan Token";
    var atom = "Cosmos";
    var atp = "Atlas Protocol";
    var atri = "Atari Token";
    var auction = "Bounce Token";
    var aud = "Australian Dollar";
    var audio = "Audius";
    var aup = "Aluminum MW U.S. Transaction Premium Platts (25MT) Futures";
    var aury = "Aurory";
    var ausd = "Acala Dollar";
    var auto = "Cube";
    var ava = "Travala.com";
    var avax = "Avalanche";
    var avt = "Aventus";
    var axp = "aXpire";
    var axs = "Axie Infinity Shards";
    var b = "";
    var b0 = "";
    var b2g = "Bitcoiin";
    var bab = "";
    var badger = "Badger DAO";
    var bake = "BakeryToken";
    var bal = "Balancer";
    var banca = "Banca";
    var band = "Band Protocol";
    var bat = "Basic Attention Token";
    var bay = "BitBay";
    var bbc = "TraDove B2BCoin";
    var bcc = "Bitcoin Core Chain Split Token";
    var bcd = "Bitcoin Diamond";
    var bch = "Bitcoin Cash";
    var bci = "Bitcoin Interest";
    var bcn = "Bytecoin";
    var bcpt = "BlockMason Credit Protocol";
    var bcu = "Bitcoin Unlimited Token";
    var bcv = "BitCapitalVendor";
    var bcy = "Bitcrystals";
    var bdg = "BitDegree";
    var beam = "Beam";
    var beet = "Beetle Coin";
    var bel = "Bella Protocol";
    var bela = "Bela";
    var berry = "Rentberry";
    var beta = "Beta Finance";
    var betr = "BetterBetting";
    var bez = "Bezop";
    var bft = "BnkToTheFuture";
    var bfx = "BFX";
    var bhd = "BitcoinHD";
    var bht = "BHEX Token";
    var bico = "BICONOMY";
    var bit = "BitDAO";
    var bitb = "Bean Cash";
    var bix = "Bibox Token";
    var bk = "";
    var bkx = "Bankex";
    var blk = "BlackCoin";
    var block = "Blocknet";
    var blok = "Bloktopia";
    var blt = "Bloom";
    var blz = "Bluzelle";
    var bmc = "Blackmoon";
    var bnb = "Binance Coin";
    var bnc = "Bifrost";
    var bnk = "Bankera";
    var bnt = "Bancor";
    var bo = "";
    var bond = "BarnBridge";
    var boo = "Spookyswap";
    var bor = "BoringDAO";
    var bora = "BORA";
    var bos = "BOScoin";
    var box = "BOX Token";
    var brd = "Bread";
    var breed = "BreederDAO";
    var brg = "Bridge Oracle";
    var brick = "";
    var bsd = "BitSend";
    var bsv = "BitcoinSV";
    var bsx = "Basilisk";
    var bt1 = "BT1";
    var bt2 = "BT2";
    var btc = "Bitcoin";
    var btcd = "BitcoinDark";
    var btcfx = "Bitcoin Forex";
    var btcp = "Bitcoin Private";
    var btg = "Bitcoin Gold";
    var btm = "Bitmark";
    var btn = "BitNewChain";
    var bto = "Bottos";
    var btrst = "Braintrust";
    var bts = "BitShares";
    var btt = "BitTorrent";
    var btu = "BTU Protocol";
    var btx = "Bitcore";
    var burger = "Burger Swap";
    var burst = "Burst";
    var bus = "U.S. Midwest Busheling Ferrous Scrap (AMM) Futures";
    var busd = "Binance USD";
    var bwx = "Blue Whale Token";
    var bz = "Bit-Z Token";
    var bzrx = "bZx Protocol";
    var c = "";
    var c20 = "CRYPTO20";
    var c98 = "Coin98";
    var cad = "Canadian Dollar";
    var cake = "PancakeSwap";
    var cas = "Cashaa";
    var cat = "BitClave";
    var cbc = "CashBet Coin";
    var cbt = "CommerceBlock";
    var cdt = "Blox";
    var cel = "Celsius";
    var celo = "Celo";
    var celr = "Celer Network";
    var cennz = "Centrality";
    var cfg = "Centrifuge";
    var cfi = "Cofound.it";
    var cfx = "Conflux Network";
    var cgt = "";
    var chat = "ChatCoin";
    var chf = "Swiss franc";
    var chp = "CoinPoker";
    var chr = "Chromia";
    var chsb = "SwissBorg";
    var chx = "Own";
    var chz = "Chiliz";
    var ckb = "Nervos Network";
    var cl = "Crude Oil Futures";
    var clam = "Clams";
    var cln = "Colu Local Network";
    var clo = "Callisto Network";
    var cloak = "CloakCoin";
    var clv = "Clover Finance";
    var cmct = "Crowd Machine";
    var cmt = "CyberMiles";
    var cnd = "Cindicator";
    var cnn = "Content Neutrality Network";
    var cnx = "Cryptonex";
    var cny = "Chinese yuan";
    var cob = "Cobalt Metal (Fastmarkets) Futures";
    var cocos = "Cocos-BCX";
    var comp = "Compound";
    var cope = "Cope";
    var cos = "COS";
    var cosm = "Cosmo Coin";
    var coss = "COSS";
    var coti = "COTI";
    var cov = "Covesting";
    var cova = "COVA";
    var cpt = "Cryptaur";
    var cpx = "Apex";
    var cqt = "Covalent";
    var cra = "";
    var crab = "Crab Network";
    var crc = "";
    var cre = "Carry";
    var cream = "Cream Finance";
    var cring = "";
    var cro = "Cronos";
    var crpt = "Crypterium";
    var cru = "Crust Network";
    var crv = "Curve";
    var crw = "Crown";
    var csm = "Crust Shadow";
    var csx = "";
    var ctc = "Creditcoin";
    var ctk = "CertiK";
    var ctsi = "Cartesi";
    var ctxc = "Cortex";
    var cult = "Cult DAO";
    var cur = "";
    var cvc = "Civic";
    var cvcoin = "CVCoin";
    var cvnt = "Content Value Network";
    var cvp = "PowerPool";
    var cvt = "CyberVein";
    var cvx = "Convex Finance";
    var cw = "";
    var cyc = "Cyclone Protocol";
    var dac = "Davinci Coin";
    var dacs = "DACSEE";
    var dadi = "DADI";
    var dag = "Constellation";
    var dai = "Multi Collateral DAI";
    var dao = "Decentralized Autonomous Organization";
    var dar = "Mines of Dalarnia";
    var dash = "Dash";
    var dat = "Data";
    var data = "Data";
    var datx = "DATx";
    var dbc = "DeepBrain Chain";
    var dbet = "DecentBet";
    var dbix = "DubaiCoin";
    var dcn = "Dentacoin";
    var dcr = "decred";
    var dct = "DECENT";
    var ddd = "Scry.info";
    var dego = "Dego Finance";
    var dent = "Dent";
    var dext = "DEXTools";
    var dgb = "DigiByte";
    var dgd = "DigixDAO";
    var dgtx = "Digitex Futures";
    var dgx = "Digix Gold Token";
    var dhx = "";
    var dia = "DIA";
    var dice = "Etheroll";
    var dim = "DIMCOIN";
    var dlt = "Agrello";
    var dmd = "Diamond";
    var dmt = "DMarket";
    var dnt = "district0x";
    var dock = "Dock";
    var dodo = "DODO";
    var doge = "Dogecoin";
    var dose = "DOSE";
    var dot = "Polkadot";
    var dpx = "Dopex";
    var dpy = "Delphy";
    var dream = "DreamTeam Token";
    var drep = "DREP";
    var drg = "Dragon Coins";
    var drgn = "Dragonchain";
    var drt = "DomRaider";
    var dta = "DATA";
    var dtb = "Databits";
    var dtr = "Dynamic Trading Rights";
    var dusk = "Dusk Network";
    var dx = "DxChain Token";
    var dydx = "dYdX";
    var dyn = "Dynamic";
    var easy = "";
    var ecom = "Omnitude";
    var edc = "EDC Blockchain";
    var edg = "Edgeless";
    var edo = "Eidoo";
    var edp = "Aluminium European Premium Duty-Paid (Metal Bulletin) Futures";
    var edr = "Endor Protocol";
    var efi = "Efinity";
    var egld = "Elrond";
    var egt = "Egretia";
    var ehr = "North Euro Hot-Rolled Coil Steel (Argus) Futures";
    var eko = "EchoLink";
    var ekt = "EDUCare";
    var ela = "Elastos";
    var elec = "Electrify.Asia";
    var elf = "aelf";
    var em = "Eminer";
    var emc = "Emercoin";
    var emc2 = "Einsteinium";
    var eng = "Enigma";
    var enj = "Enjin Coin";
    var ens = "Ethereum Naming Service";
    var eos = "EOS";
    var eosdac = "eosDAC";
    var eq = "";
    var erd = "Elrond";
    var ern = "Ethernity Chain";
    var es = "E-mini S&P 500 Futures";
    var esd = "Empty Set Dollar";
    var etc = "Ethereum Classic";
    var eth = "Ethereum";
    var ethup = "Ethereum Up";
    var etn = "Electroneum";
    var etp = "Metaverse ETP";
    var eur = "Euro";
    var eurs = "STASIS EURS";
    var eurt = "Tether Euro";
    var evn = "Envion";
    var evx = "Everex";
    var ewt = "Energy Web Token";
    var exp = "Expanse";
    var exrd = "Radix";
    var exy = "";
    var ez = "EasyFi";
    var fair = "FairCoin";
    var farm = "Harvest Finance";
    var fct = "Factom";
    var fdz = "Friendz";
    var fee = "";
    var fet = "Fetch.ai";
    var fida = "Bonfida";
    var fil = "Filecoin";
    var fio = "FIO Protocol";
    var firo = "Firo";
    var fis = "StaFi Protocol";
    var fldc = "FoldingCoin";
    var flo = "FlorinCoin";
    var floki = "Floki Inu";
    var flow = "Flow";
    var flr = "";
    var fluz = "Fluz Fluz";
    var fnb = "FNB Protocol";
    var foam = "FOAM";
    var forth = "Ampleforth Governance Token";
    var fota = "Fortuna";
    var fox = "Fox Token";
    var fpis = "";
    var frax = "Frax";
    var front = "Frontier";
    var fsn = "Fusion";
    var ftc = "Feathercoin";
    var fti = "FansTime";
    var ftm = "Fantom";
    var ftt = "FTX Token";
    var ftx = "FintruX Network";
    var fuel = "Etherparty";
    var fun = "FunFair";
    var fx = "Function X";
    var fxc = "Flexacoin";
    var fxs = "Frax Share";
    var fxt = "FuzeX";
    var gal = "Galatasaray Fan Token";
    var gala = "Gala";
    var game = "GameCredits";
    var gamee = "";
    var gard = "Hashgard";
    var gari = "Gari Network";
    var gas = "Gas";
    var gbc = "Gold Bits Coin";
    var gbp = "British Pound";
    var gbx = "GoByte";
    var gbyte = "Obyte";
    var gc = "Gold Futures";
    var gcc = "Global Cryptocurrency";
    var ge = "Eurodollar";
    var geist = "Geist Finance";
    var gen = "DAOstack";
    var gene = "Parkgene";
    var gens = "";
    var get = "GET Protocol";
    var ghst = "Aavegotchi";
    var glc = "GoldCoin";
    var gld = "GoldCoin";
    var glm = "Golem";
    var glmr = "Moonbeam";
    var gmat = "GoWithMi";
    var gmt = "STEPN";
    var gmt2 = "GoMining token";
    var gno = "Gnosis";
    var gnt = "Golem";
    var gnx = "Genaro Network";
    var go = "GoChain";
    var gods = "Gods Unchained";
    var got = "ParkinGo";
    var grc = "GridCoin";
    var grin = "GRIN";
    var grs = "Groestlcoin";
    var grt = "The Graph";
    var gsc = "Global Social Chain";
    var gst = "";
    var gt = "Gatechain Token";
    var gtc = "Gitcoin";
    var gtc2 = "";
    var gto = "Gifto";
    var gup = "Matchpool";
    var gusd = "Gemini Dollar";
    var gvt = "Genesis Vision";
    var gxc = "GXChain";
    var gxs = "GXChain";
    var hard = "Kava Lend";
    var hbar = "Hedera";
    var hc = "HyperCash";
    var hdx = "";
    var hedg = "HedgeTrade";
    var hegic = "Hegic";
    var hex = "HEX";
    var hft = "Hashflow";
    var hg = "Copper Futures";
    var hgs = "Copper Financial Futures";
    var hh = "Natural Gas (Henry Hub) Last-day Financial Futures";
    var high = "Highstreet";
    var hit = "HitChain";
    var hive = "Hive";
    var hkd = "Hong Kong Dollar";
    var hmq = "Humaniq";
    var hns = "Handshake";
    var ho = "";
    var hopr = "HOPR Token";
    var hot = "Holochain";
    var hp = "";
    var hpb = "High Performance Blockchain";
    var hpc = "Happycoin";
    var hpt = "Huobi Pool Token";
    var hrc = "U.S. Midwest Domestic Hot-Rolled Coil Steel (CRU) Index Futures";
    var hsc = "HashCoin";
    var hsr = "Hshare";
    var hst = "Decision Token";
    var ht = "Huobi Token";
    var html = "HTMLCOIN";
    var htt = "";
    var huc = "HunterCoin";
    var hunt = "HUNT";
    var hvn = "Hive Project";
    var hxro = "Hxro";
    var hyc = "HYCON";
    var hydra = "Hydro Protocol";
    var hydro = "Hydro";
    var icn = "Iconomi";
    var icos = "ICOS";
    var icp = "Internet Computer";
    var icx = "ICON";
    var idex = "IDEX";
    var idh = "indaHash";
    var idr = "Indonesian Rupiah";
    var ift = "InvestFeed";
    var ignis = "Ignis";
    var ihf = "Invictus Hyperion Fund";
    var iht = "IHT Real Estate Protocol";
    var ilc = "ILCoin";
    var ilv = "Illuvium";
    var imx = "Immutable X";
    var incnt = "Incent";
    var ind = "Indorse Token";
    var indi = "";
    var inj = "Injective Protocol";
    var ink = "Ink";
    var inr = "Indian Rupee";
    var ins = "INS Ecosystem";
    var int = "Internet Node Token";
    var intr = "Interlay";
    var ioc = "I/O Coin";
    var ion = "ION";
    var iost = "IOST";
    var iot = "";
    var iotx = "IoTeX";
    var iq = "Everipedia";
    var iris = "IRISnet";
    var itc = "IoT Chain";
    var ivy = "Ivy";
    var ixt = "iXledger";
    var jasmy = "JasmyCoin";
    var jnt = "Jibrel Network";
    var joe = "Trader Joe";
    var jpeg = "";
    var jpy = "Japanese Yen";
    var jst = "JUST";
    var juno = "";
    var just = "";
    var juv = "Juventus Fan Token";
    var kan = "BitKan";
    var kar = "Karura";
    var kava = "Kava";
    var kbc = "Karatgold Coin";
    var kcash = "Kcash";
    var kda = "Kadena";
    var keep = "Keep Network";
    var key = "Selfkey";
    var kick = "Kick Token";
    var kilt = "KILT Protocol";
    var kin = "Kin";
    var kint = "Kintsugi";
    var klay = "Klaytn";
    var kma = "";
    var kmd = "Komodo";
    var knc = "Kyber Network";
    var kore = "Kore";
    var kp3r = "Keep3R";
    var krm = "Karma";
    var krw = "South Korean Won";
    var ksm = "Kusama";
    var ksx = "";
    var kyl = "Kylin";
    var la = "LATOKEN";
    var lak = "";
    var lamb = "Lambda";
    var latx = "LatiumX";
    var layr = "Composable Finance";
    var lba = "Cred";
    var lbc = "LBRY Credits";
    var lcc = "Litecoin Cash";
    var lcx = "LCX";
    var ldo = "Lido DAO Token";
    var lend = "Aave";
    var leo = "LEO Token";
    var leoc = "LEOcoin";
    var life = "LIFE";
    var lina = "Linear";
    var link = "ChainLink";
    var lit = "Litentry";
    var lmc = "LoMoCoin";
    var lml = "Lisk Machine Learning";
    var lnc = "Linker Coin";
    var lnd = "Lendingblock";
    var loc = "LockTrip";
    var loka = "League of Kingdoms Arena";
    var looks = "LooksRare";
    var loom = "Loom Network";
    var lpt = "Livepeer";
    var lqty = "Liquity";
    var lrc = "Loopring";
    var lrn = "Loopring [NEO]";
    var lsk = "Lisk";
    var ltc = "Litecoin";
    var lto = "LTO Network";
    var lun = "Lunyr";
    var luna = "Terra Classic";
    var luna2 = "Terra 2.0";
    var lxt = "Litex";
    var lym = "Lympo";
    var m2k = "Micro E-mini Russell 2000 Index";
    var ma = "";
    var magic = "";
    var maid = "MaidSafe";
    var man = "Matrix AI Network";
    var mana = "Decentraland";
    var maps = "MAPS";
    var mask = "Mask Network";
    var mass = "Massnet";
    var math = "MATH";
    var matic = "Polygon";
    var mbl = "MovieBloc";
    var mbt = "Micro Bitcoin";
    var mc = "Merit Circle";
    var mco = "Monaco";
    var mda = "Moeda Loyalty Points";
    var mds = "MediShares";
    var mdt = "Measurable Data Token";
    var mdx = "Mdex";
    var med = "MediBloc [QRC20]";
    var mer = "Mercury";
    var mes = "Micro E-mini S&P 500 Index";
    var met = "Metronome";
    var meta = "Metadium";
    var mft = "Mainframe";
    var mgc = "E-micro Gold Futures";
    var mgo = "MobileGo";
    var mhc = "#MetaHash";
    var mina = "Mina";
    var mir = "Mirror Protocol";
    var mith = "Mithril";
    var mitx = "Morpheus Labs";
    var mjp = "Aluminum Japan Premium (Platts) Futures";
    var mkr = "Maker";
    var mln = "waterMelon";
    var mngo = "Mango Markets";
    var mnx = "MinexCoin";
    var moac = "MOAC";
    var mob = "MobileCoin";
    var mobi = "Mobius";
    var moc = "Moss Coin";
    var mod = "Modum";
    var mona = "MonaCoin";
    var moon = "10X Long Bitcoin Token";
    var morph = "Morpheus Network";
    var movr = "Moonriver";
    var mpl = "Maple";
    var mrk = "MARK.SPACE";
    var msol = "Marinade staked SOL";
    var msp = "Mothership";
    var mta = "mStable Governance Token: Meta";
    var mtc = "Docademic";
    var mth = "Monetha";
    var mtl = "Metal";
    var mtn = "Medicalchain";
    var mtx = "Matryx";
    var mue = "MonetaryUnit";
    var multi = "Multichain";
    var mv = "";
    var mx = "MX Token";
    var mxm = "Maximine Coin";
    var mxn = "Mexican Peso";
    var myr = "Malaysian Ringgit";
    var n9l = "";
    var nanj = "NANJCOIN";
    var nano = "Nano";
    var nas = "Nebulas";
    var naut = "NautilusCoin";
    var nav = "NAV Coin";
    var ncash = "Nucleus Vision";
    var nct = "PolySwarm";
    var near = "NEAR Protocol";
    var nebl = "Neblio";
    var nec = "Nectar";
    var neo = "NEO";
    var neos = "NeosCoin";
    var nest = "NEST Protocol";
    var neu = "Neumark";
    var nexo = "Nexo";
    var nft = "APENFT";
    var ng = "Natural Gas Futures";
    var ngc = "NAGA";
    var ngn = "Nigerian Naira";
    var nim = "Nimiq";
    var niy = "Nikkei/Yen";
    var nkd = "Nikkei/USD";
    var nkn = "NKN";
    var nlc2 = "NoLimitCoin";
    var nlg = "Gulden";
    var nmc = "Namecoin";
    var nmr = "Numeraire";
    var nn = "Henry Hub Natural Gas Last Day Financial Futures";
    var noah = "Noah Coin";
    var nodl = "Nodle";
    var note = "DNotes";
    var npg = "";
    var nplc = "Plus-Coin";
    var npxs = "Pundi X";
    var nq = "E-mini Nasdaq-100";
    var nrg = "Energi";
    var ntk = "Neurotoken";
    var nu = "NuCypher";
    var nuls = "Nuls";
    var nvc = "Novacoin";
    var nxc = "Nexium";
    var nxs = "Nexus";
    var nxt = "NXT";
    var nym = "";
    var o = "";
    var oax = "OAX";
    var ocean = "Ocean Protocol";
    var ocn = "Odyssey";
    var ode = "ODEM";
    var ogn = "Origin Protocol";
    var ogo = "Origo";
    var ok = "OKCash";
    var okb = "Okex Token";
    var om = "Mantra Dao";
    var omg = "OMG Network";
    var omni = "Omni";
    var one = "Harmony";
    var ong = "SoMee.Social";
    var onot = "ONOToken";
    var ont = "Ontology";
    var ooki = "Ooki Protocol";
    var orbs = "Orbs";
    var orca = "Orca";
    var orme = "Ormeus Coin";
    var orn = "Orion Protocol";
    var ors = "Origin Sport";
    var osmo = "";
    var ost = "OST";
    var otn = "Open Trading Network";
    var oxt = "Orchid";
    var oxy = "Oxygen";
    var pai = "PCHAIN";
    var pal = "Pal Network";
    var paper = "Dope Wars Paper";
    var para = "Parallel Finance";
    var part = "Particl";
    var pasc = "Pascal Coin";
    var pat = "Patron";
    var pax = "Paxos Standard";
    var paxg = "PAX Gold";
    var pay = "TenX";
    var pbt = "Primalbase Token";
    var pcl = "Peculium";
    var pcx = "ChainX";
    var pdex = "Polkadex";
    var people = "ConstitutionDAO";
    var perl = "Perlin";
    var perp = "Perpetual Protocol";
    var pha = "Phala.Network";
    var phb = "Phoenix Global";
    var php = "Philippine Peso";
    var phx = "Red Pulse Phoenix";
    var pi = "PCHAIN";
    var pica = "";
    var pink = "PinkCoin";
    var pivx = "PIVX";
    var pkt = "Playkey";
    var pl = "";
    var pla = "PlayDapp";
    var plbt = "Polybius";
    var plm = "";
    var pln = "Polish Złoty";
    var plr = "Pillar";
    var ply = "PlayCoin [ERC20]";
    var pma = "PumaPay";
    var png = "Pangolin";
    var pnt = "pNetwork";
    var poa = "POA Network";
    var poe = "Po.et";
    var polis = "Star Atlas DAO";
    var pols = "Polkastarter";
    var poly = "Polymath";
    var pond = "Marlin";
    var pot = "PotCoin";
    var powr = "Power Ledger";
    var ppc = "Peercoin";
    var ppt = "Populous";
    var pra = "ProChain";
    var pre = "Presearch";
    var prg = "Paragon";
    var pro = "Propy";
    var prq = "PARSIQ";
    var pst = "Primas";
    var pstake = "Pstake";
    var pton = "PTON";
    var pundix = "Pundi X[new]";
    var pvt = "Pivot Token";
    var pxg = "PlayGame";
    var pyr = "Vulcan Forged PYR";
    var qash = "QASH";
    var qau = "Quantum";
    var qc = "E-mini Copper Futures";
    var qi = "Benqi";
    var qi2 = "E-mini Silver Futures";
    var qkc = "QuarkChain";
    var qlc = "QLINK";
    var qnt = "Quant Network";
    var qntu = "Quanta Utility Token";
    var qo = "E-mini Gold Futures";
    var qrdo = "Qredo";
    var qrl = "Quantum Resistant Ledger";
    var qsp = "Quantstamp";
    var qtum = "Qtum";
    var qun = "QunQun";
    var r = "Revain";
    var rad = "Radicle";
    var radar = "";
    var rads = "Radium";
    var ramp = "RAMP";
    var rare = "SuperRare";
    var rari = "Rarible";
    var rating = "DPRating";
    var ray = "Raydium";
    var rb = "";
    var rbc = "Rubic";
    var rblx = "Rublix";
    var rbn = "Ribbon Finance";
    var rbtc = "Smart Bitcoin";
    var rby = "Rubycoin";
    var rcn = "Ripio Credit Network";
    var rdd = "ReddCoin";
    var rdn = "Raiden Network Token";
    var real = "Realy";
    var reef = "Reef";
    var rem = "Remme";
    var ren = "Republic Protocol";
    var rep = "Augur";
    var repv2 = "Augur v2";
    var req = "Request";
    var rev = "Revain";
    var revv = "REVV";
    var rfox = "RedFOX Labs";
    var rfr = "Refereum";
    var ric = "Riecoin";
    var rif = "RIF Token";
    var ring = "Darwinia Network";
    var rlc = "iExec RLC";
    var rly = "Rally";
    var rmrk = "RMRK";
    var rndr = "Render Token";
    var rntb = "BitRent";
    var ron = "Ronin";
    var rook = "KeeperDAO";
    var rose = "Oasis Network";
    var rox = "Robotina";
    var rp = "Euro/British Pound Futures";
    var rpx = "Red Pulse";
    var rsr = "Reserve Rights";
    var rsv = "";
    var rty = "E-mini Russell 2000 Index";
    var rub = "Russian Ruble";
    var ruff = "Ruff";
    var rune = "THORChain";
    var rvn = "Ravencoin";
    var rvr = "RevolutionVR";
    var rvt = "Rivetz";
    var sai = "Single Collateral DAI";
    var salt = "SALT";
    var samo = "Samoyedcoin";
    var san = "Santinent Network Token";
    var sand = "The Sandbox";
    var sats = "";
    var sbd = "Steem Dollars";
    var sbr = "Saber";
    var sc = "Siacoin";
    var scc = "StockChain";
    var scrt = "Secret Network";
    var sdc = "ShadowCoin";
    var sdn = "Shiden Network";
    var seele = "Seele";
    var sek = "";
    var sen = "Consensus";
    var sent = "Sentinel";
    var sero = "Super Zero";
    var sexc = "ShareX";
    var sfp = "SafePal";
    var sgb = "Songbird";
    var sgc = "Shanghai Gold (CNH) Futures";
    var sgd = "Singapore Dollar";
    var sgn = "Signals Network";
    var sgu = "Shanghai Gold (USD) Futures";
    var shib = "SHIBA INU";
    var shift = "Shift";
    var ship = "ShipChain";
    var shping = "SHPING";
    var si = "Silver Futures";
    var sib = "SIBCoin";
    var sil = "1,000-oz. Silver Futures";
    var six = "SIX";
    var sjcx = "Storjcoin X";
    var skl = "Skale";
    var skm = "Skrumble Network";
    var sku = "";
    var sky = "Skycoin";
    var slp = "Smooth Love Potion";
    var slr = "SolarCoin";
    var sls = "SaluS";
    var slt = "Smartlands";
    var slv = "Silverway";
    var smart = "SmartCash";
    var smn = "";
    var smt = "SmartMesh";
    var snc = "SunContract";
    var snet = "Snetwork";
    var sngls = "SingularDTV";
    var snm = "SONM";
    var snt = "Status";
    var snx = "Synthetix Network Token";
    var soc = "All Sports";
    var socks = "Unisocks";
    var sol = "Solana";
    var solid = "";
    var solo = "Sologenic";
    var solve = "SOLVE";
    var sos = "OpenDAO";
    var soul = "Phantasma";
    var sp = "S&P 500";
    var sparta = "Spartan Protocol";
    var spc = "SpaceChain";
    var spd = "SPINDLE";
    var spell = "Spell Token";
    var sphr = "Sphere";
    var sphtx = "SophiaTX";
    var spnd = "Spendcoin";
    var spnk = "SpankChain";
    var srm = "Serum";
    var srn = "SIRIN LABS Token";
    var ssp = "Smartshare";
    var stacs = "STACS";
    var step = "Step Finance";
    var stg = "";
    var stmx = "StormX";
    var storm = "Storm";
    var stpt = "STPT";
    var stq = "Storiqa";
    var str = "Stellar";
    var strat = "Stratis";
    var strax = "Stratis";
    var strk = "Strike";
    var strong = "Strong";
    var stx = "Stox";
    var sub = "substratum";
    var sun = "Sun Token";
    var susd = "sUSD";
    var sushi = "Sushi";
    var swftc = "SwftCoin";
    var swm = "Swarm";
    var swrv = "Swerve";
    var swt = "Swarm City";
    var swth = "Switcheo";
    var sxp = "Swipe";
    var syn = "SynLev";
    var sys = "Syscoin";
    var t = "Threshold Network Token";
    var taas = "TaaS";
    var tau = "Lamden";
    var tbtc = "tBTC";
    var tct = "TokenClub";
    var teer = "Integritee";
    var tel = "Telcoin";
    var temco = "TEMCO";
    var tfuel = "Theta Fuel";
    var thb = "";
    var thc = "HempCoin";
    var theta = "Theta Token";
    var thx = "ThoreNext";
    var time = "Chronobank";
    var tio = "Iron Ore 62% FE- CFR China Futures";
    var tix = "Blocktix";
    var tkn = "TokenCard";
    var tky = "THEKEY";
    var tlm = "Alien Worlds";
    var tnb = "Time New Bank";
    var tnc = "Trinity Network Credit";
    var tnt = "Tierion";
    var toke = "Tokemak";
    var tomb = "";
    var tomo = "TomoChain";
    var top = "TOP";
    var torn = "Tornado Cash";
    var tower = "Tower";
    var tpay = "TokenPay";
    var trac = "OriginTrail";
    var trb = "Tellor";
    var tribe = "Tribe";
    var trig = "Triggers";
    var trio = "Tripio";
    var troy = "TROY";
    var trst = "WeTrust";
    var tru = "TrueFi";
    var trx = "TRON";
    var tryb = "BiLira";
    var tt = "Thunder Token";
    var ttc = "TTC Protocol";
    var ttt = "The Transfer Token";
    var ttu = "TaTaTu";
    var tube = "BitTube";
    var tusd = "True USD";
    var tvk = "Terra Virtua Kolect";
    var twt = "Trust Wallet Token";
    var uah = "Ukrainian hryvnia";
    var ubq = "Ubiq";
    var ubt = "Unibright";
    var uft = "UniLend";
    var ugas = "UGAS";
    var uip = "UnlimitedIP";
    var ukg = "Unikoin Gold";
    var uma = "Universal Market Access";
    var unfi = "Unifi Protocol DAO";
    var uni = "Uniswap";
    var unq = "Unique Network";
    var up = "UpToken";
    var upp = "Sentinel Protocol";
    var usd = "United States Dollar";
    var usdc = "USD//Coin";
    var usds = "StableUSD";
    var usk = "UpSkills";
    var ust = "TerraClassicUSD";
    var utk = "UTRUST";
    var utnp = "Universa";
    var utt = "United Traders Token";
    var uuu = "U Network";
    var ux = "UXC Uranium U3O8 Futures";
    var vader = "Vader Protocol";
    var vai = "Vai";
    var vbk = "VeriBlock";
    var vdx = "Vodi X";
    var vee = "BLOCKv";
    var vemp = "vEmpire DDAO";
    var ven = "VeChain";
    var veo = "Amoveo";
    var veri = "Veritaseum";
    var vex = "Vexanium";
    var vgx = "Voyager Token";
    var via = "Viacoin";
    var vib = "Viberate";
    var vibe = "VIBE";
    var vid = "VideoCoin";
    var vidt = "VIDT Datalink";
    var vidy = "VIDY";
    var vitae = "Vitae";
    var vite = "VITE";
    var vlx = "Velas";
    var vox = "Voxels";
    var voxel = "Voxies";
    var vra = "Verasity";
    var vrc = "VeriCoin";
    var vrm = "Verium";
    var vsys = "V Systems";
    var vtc = "Vertcoin";
    var vtho = "VeThor Token";
    var wabi = "WaBi";
    var wan = "Wanchain";
    var waves = "Waves";
    var wax = "";
    var wbtc = "Wrapped Bitcoin";
    var wet = "WeShow Token";
    var weth = "Wrapped Ether";
    var wib = "Wibson";
    var wicc = "WaykiChain";
    var win = "WINk";
    var wing = "Wing";
    var wings = "Wings";
    var wnxm = "Wrapped NXM";
    var woo = "Woo Network";
    var wpr = "WePower";
    var wrx = "WazirX";
    var wtc = "Waltonchain";
    var wtt = "";
    var wwb = "Wowbit";
    var wxt = "Wirex Token";
    var xas = "Asch";
    var xaur = "Xaurum";
    var xaut = "Tether Gold";
    var xava = "Avalaunch";
    var xbc = "Bitcoin Plus";
    var xcon = "Connect Coin";
    var xcp = "Counterparty";
    var xdefi = "XDEFI Wallet";
    var xdn = "DigitalNote";
    var xel = "Elastic";
    var xem = "NEM";
    var xes = "";
    var xhv = "Haven Protocol";
    var xin = "Mixin";
    var xlm = "Stellar";
    var xmc = "Monero Classic";
    var xmr = "Monero";
    var xmx = "XMax";
    var xmy = "Myriad";
    var xnk = "";
    var xns = "Insolar";
    var xor = "Sora";
    var xos = "";
    var xpm = "Primecoin";
    var xpr = "Proton";
    var xrc = "Bitcoin Rhodium";
    var xrp = "XRP";
    var xrpx = "";
    var xrt = "Robonomics";
    var xst = "Stealth";
    var xtp = "Tap";
    var xtz = "Tezos";
    var xtzdown = "Tezos Down";
    var xvc = "Vcash";
    var xvg = "Verge";
    var xvs = "Venus";
    var xwc = "WhiteCoin";
    var xyo = "XYO";
    var xzc = "ZCoin";
    var yam = "YAM";
    var yee = "YEE";
    var yeed = "YGGDRASH";
    var yfi = "yearn.finance";
    var yfii = "DFI.Money";
    var ygg = "Yield Guild Games";
    var yoyow = "YOYOW";
    var zar = "South African rand";
    var zcl = "ZClassic";
    var zcn = "0chain";
    var zco = "Zebi";
    var zec = "Zcash";
    var zen = "Horizen";
    var zil = "Zilliqa";
    var zks = "ZKSwap";
    var zla = "Zilla";
    var zlk = "";
    var zondo = "";
    var zpr = "ZPER";
    var zpt = "Zeepin";
    var zrc = "ZrCoin";
    var zrx = "0x";
    var zsc = "Zeusshield";
    var ztg = "";
    var xbt = "";
    var bitz = "Bit-Z";
    var cs = "Credits";
    var crm = "";
    var xdg = "";
    var eth2 = "Ethereum 2";
    var eth2s = "";
    var usdt = "Tether";
    var kraken = "Kraken";
    var gemini = "Gemini";
    var husd = "HUSD";
    var huobi = "Huobi";
    var iota = "IOTA";
    var medx = "MediBloc [ERC20]";
    var rur = "";
    var steem = "Steem";
    var xsc = "";
    var storj = "Storj";
    var vet = "VeChain";
    var waxp = "WAX";
    var mexbt = "meXBT";
    var gdax = "";
    var quadriga = "QuadrigaCX";
    var cgld = "";
    var kshib = "Kaiken Shiba";
    var srare = "";
    var beaconNames = {
    	_default: _default,
    	d: d,
    	"default": "",
    	axieinfinity: axieinfinity,
    	bibox: bibox,
    	binance: binance,
    	bisq: bisq,
    	bitbay: bitbay,
    	bitfinex: bitfinex,
    	bitflyer: bitflyer,
    	bithumb: bithumb,
    	bitmex: bitmex,
    	bitso: bitso,
    	bitsquare: bitsquare,
    	bitstamp: bitstamp,
    	bittrex: bittrex,
    	bitvc: bitvc,
    	btcchina: btcchina,
    	btce: btce,
    	bybit: bybit,
    	cexio: cexio,
    	cme: cme,
    	coinbase: coinbase,
    	coinbasepro: coinbasepro,
    	coinone: coinone,
    	comex: comex,
    	cryptofacilities: cryptofacilities,
    	deribit: deribit,
    	"dex-aggregated": "DEX (aggregated)",
    	gateio: gateio,
    	hitbtc: hitbtc,
    	kucoin: kucoin,
    	liquid: liquid,
    	luno: luno,
    	mtgox: mtgox,
    	mxc: mxc,
    	nbatopshop: nbatopshop,
    	nymex: nymex,
    	okcoin: okcoin,
    	okx: okx,
    	opensea: opensea,
    	poloniex: poloniex,
    	qryptos: qryptos,
    	quadrigacx: quadrigacx,
    	quick: quick,
    	quoine: quoine,
    	rarible: rarible,
    	totle: totle,
    	upbit: upbit,
    	vaultofsatoshi: vaultofsatoshi,
    	wex: wex,
    	zaif: zaif,
    	zonda: zonda,
    	"1inch": "1inch",
    	"1st": "FirstBlood",
    	"6a": "Australian Dollar",
    	"6b": "British Pound",
    	"6c": "Canadian Dollar",
    	"6e": "Euro FX Futures",
    	"6j": "Japanese Yen",
    	"6l": "Brazilian Real",
    	"6m": "Mexican Peso",
    	"6n": "New Zealand Dollar",
    	"6s": "Swiss Franc",
    	a38: a38,
    	aac: aac,
    	aave: aave,
    	abbc: abbc,
    	abt: abt,
    	abyss: abyss,
    	aca: aca,
    	acat: acat,
    	ach: ach,
    	act: act,
    	ad0: ad0,
    	ada: ada,
    	adel: adel,
    	adh: adh,
    	adm: adm,
    	ado: ado,
    	adt: adt,
    	adx: adx,
    	ae: ae,
    	aed: aed,
    	aeon: aeon,
    	aep: aep,
    	aergo: aergo,
    	agi: agi,
    	agld: agld,
    	aid: aid,
    	aion: aion,
    	air: air,
    	akro: akro,
    	akt: akt,
    	alcx: alcx,
    	aleph: aleph,
    	algo: algo,
    	ali: ali,
    	alice: alice,
    	alpha: alpha,
    	amb: amb,
    	amlt: amlt,
    	amp: amp,
    	ampl: ampl,
    	anc: anc,
    	anct: anct,
    	ankr: ankr,
    	ant: ant,
    	ape: ape,
    	api3: api3,
    	apis: apis,
    	appc: appc,
    	ar: ar,
    	ardr: ardr,
    	ark: ark,
    	arn: arn,
    	arpa: arpa,
    	art: art,
    	aspt: aspt,
    	ast: ast,
    	astr: astr,
    	at: at,
    	atlas: atlas,
    	atm: atm,
    	atom: atom,
    	atp: atp,
    	atri: atri,
    	auction: auction,
    	aud: aud,
    	audio: audio,
    	aup: aup,
    	aury: aury,
    	ausd: ausd,
    	auto: auto,
    	ava: ava,
    	avax: avax,
    	avt: avt,
    	axp: axp,
    	axs: axs,
    	b: b,
    	b0: b0,
    	b2g: b2g,
    	bab: bab,
    	badger: badger,
    	bake: bake,
    	bal: bal,
    	banca: banca,
    	band: band,
    	bat: bat,
    	bay: bay,
    	bbc: bbc,
    	bcc: bcc,
    	bcd: bcd,
    	bch: bch,
    	bci: bci,
    	bcn: bcn,
    	bcpt: bcpt,
    	bcu: bcu,
    	bcv: bcv,
    	bcy: bcy,
    	bdg: bdg,
    	beam: beam,
    	beet: beet,
    	bel: bel,
    	bela: bela,
    	berry: berry,
    	beta: beta,
    	betr: betr,
    	bez: bez,
    	bft: bft,
    	bfx: bfx,
    	bhd: bhd,
    	bht: bht,
    	bico: bico,
    	bit: bit,
    	bitb: bitb,
    	bix: bix,
    	bk: bk,
    	bkx: bkx,
    	blk: blk,
    	block: block,
    	blok: blok,
    	blt: blt,
    	blz: blz,
    	bmc: bmc,
    	bnb: bnb,
    	bnc: bnc,
    	bnk: bnk,
    	bnt: bnt,
    	bo: bo,
    	bond: bond,
    	boo: boo,
    	bor: bor,
    	bora: bora,
    	bos: bos,
    	box: box,
    	brd: brd,
    	breed: breed,
    	brg: brg,
    	brick: brick,
    	bsd: bsd,
    	bsv: bsv,
    	bsx: bsx,
    	bt1: bt1,
    	bt2: bt2,
    	btc: btc,
    	btcd: btcd,
    	btcfx: btcfx,
    	btcp: btcp,
    	btg: btg,
    	btm: btm,
    	btn: btn,
    	bto: bto,
    	btrst: btrst,
    	bts: bts,
    	btt: btt,
    	btu: btu,
    	btx: btx,
    	burger: burger,
    	burst: burst,
    	bus: bus,
    	busd: busd,
    	bwx: bwx,
    	bz: bz,
    	bzrx: bzrx,
    	c: c,
    	c20: c20,
    	c98: c98,
    	cad: cad,
    	cake: cake,
    	cas: cas,
    	cat: cat,
    	cbc: cbc,
    	cbt: cbt,
    	cdt: cdt,
    	cel: cel,
    	celo: celo,
    	celr: celr,
    	cennz: cennz,
    	cfg: cfg,
    	cfi: cfi,
    	cfx: cfx,
    	cgt: cgt,
    	chat: chat,
    	chf: chf,
    	chp: chp,
    	chr: chr,
    	chsb: chsb,
    	chx: chx,
    	chz: chz,
    	ckb: ckb,
    	cl: cl,
    	clam: clam,
    	cln: cln,
    	clo: clo,
    	cloak: cloak,
    	clv: clv,
    	cmct: cmct,
    	cmt: cmt,
    	cnd: cnd,
    	cnn: cnn,
    	cnx: cnx,
    	cny: cny,
    	cob: cob,
    	cocos: cocos,
    	comp: comp,
    	cope: cope,
    	cos: cos,
    	cosm: cosm,
    	coss: coss,
    	coti: coti,
    	cov: cov,
    	cova: cova,
    	cpt: cpt,
    	cpx: cpx,
    	cqt: cqt,
    	cra: cra,
    	crab: crab,
    	crc: crc,
    	cre: cre,
    	cream: cream,
    	cring: cring,
    	cro: cro,
    	crpt: crpt,
    	cru: cru,
    	crv: crv,
    	crw: crw,
    	csm: csm,
    	csx: csx,
    	ctc: ctc,
    	ctk: ctk,
    	ctsi: ctsi,
    	ctxc: ctxc,
    	cult: cult,
    	cur: cur,
    	cvc: cvc,
    	cvcoin: cvcoin,
    	cvnt: cvnt,
    	cvp: cvp,
    	cvt: cvt,
    	cvx: cvx,
    	cw: cw,
    	cyc: cyc,
    	dac: dac,
    	dacs: dacs,
    	dadi: dadi,
    	dag: dag,
    	dai: dai,
    	dao: dao,
    	dar: dar,
    	dash: dash,
    	dat: dat,
    	data: data,
    	datx: datx,
    	dbc: dbc,
    	dbet: dbet,
    	dbix: dbix,
    	dcn: dcn,
    	dcr: dcr,
    	dct: dct,
    	ddd: ddd,
    	dego: dego,
    	dent: dent,
    	dext: dext,
    	dgb: dgb,
    	dgd: dgd,
    	dgtx: dgtx,
    	dgx: dgx,
    	dhx: dhx,
    	dia: dia,
    	dice: dice,
    	dim: dim,
    	dlt: dlt,
    	dmd: dmd,
    	dmt: dmt,
    	dnt: dnt,
    	dock: dock,
    	dodo: dodo,
    	doge: doge,
    	dose: dose,
    	dot: dot,
    	dpx: dpx,
    	dpy: dpy,
    	dream: dream,
    	drep: drep,
    	drg: drg,
    	drgn: drgn,
    	drt: drt,
    	dta: dta,
    	dtb: dtb,
    	dtr: dtr,
    	dusk: dusk,
    	dx: dx,
    	dydx: dydx,
    	dyn: dyn,
    	easy: easy,
    	ecom: ecom,
    	edc: edc,
    	edg: edg,
    	edo: edo,
    	edp: edp,
    	edr: edr,
    	efi: efi,
    	egld: egld,
    	egt: egt,
    	ehr: ehr,
    	eko: eko,
    	ekt: ekt,
    	ela: ela,
    	elec: elec,
    	elf: elf,
    	em: em,
    	emc: emc,
    	emc2: emc2,
    	eng: eng,
    	enj: enj,
    	ens: ens,
    	eos: eos,
    	eosdac: eosdac,
    	eq: eq,
    	erd: erd,
    	ern: ern,
    	es: es,
    	esd: esd,
    	etc: etc,
    	eth: eth,
    	ethup: ethup,
    	etn: etn,
    	etp: etp,
    	eur: eur,
    	eurs: eurs,
    	eurt: eurt,
    	evn: evn,
    	evx: evx,
    	ewt: ewt,
    	exp: exp,
    	exrd: exrd,
    	exy: exy,
    	ez: ez,
    	fair: fair,
    	farm: farm,
    	fct: fct,
    	fdz: fdz,
    	fee: fee,
    	fet: fet,
    	fida: fida,
    	fil: fil,
    	fio: fio,
    	firo: firo,
    	fis: fis,
    	fldc: fldc,
    	flo: flo,
    	floki: floki,
    	flow: flow,
    	flr: flr,
    	fluz: fluz,
    	fnb: fnb,
    	foam: foam,
    	"for": "Force Protocol",
    	forth: forth,
    	fota: fota,
    	fox: fox,
    	fpis: fpis,
    	frax: frax,
    	front: front,
    	fsn: fsn,
    	ftc: ftc,
    	fti: fti,
    	ftm: ftm,
    	ftt: ftt,
    	ftx: ftx,
    	fuel: fuel,
    	fun: fun,
    	fx: fx,
    	fxc: fxc,
    	fxs: fxs,
    	fxt: fxt,
    	gal: gal,
    	gala: gala,
    	game: game,
    	gamee: gamee,
    	gard: gard,
    	gari: gari,
    	gas: gas,
    	gbc: gbc,
    	gbp: gbp,
    	gbx: gbx,
    	gbyte: gbyte,
    	gc: gc,
    	gcc: gcc,
    	ge: ge,
    	geist: geist,
    	gen: gen,
    	gene: gene,
    	gens: gens,
    	get: get,
    	ghst: ghst,
    	glc: glc,
    	gld: gld,
    	glm: glm,
    	glmr: glmr,
    	gmat: gmat,
    	gmt: gmt,
    	gmt2: gmt2,
    	gno: gno,
    	gnt: gnt,
    	gnx: gnx,
    	go: go,
    	gods: gods,
    	got: got,
    	grc: grc,
    	grin: grin,
    	grs: grs,
    	grt: grt,
    	gsc: gsc,
    	gst: gst,
    	gt: gt,
    	gtc: gtc,
    	gtc2: gtc2,
    	gto: gto,
    	gup: gup,
    	gusd: gusd,
    	gvt: gvt,
    	gxc: gxc,
    	gxs: gxs,
    	hard: hard,
    	hbar: hbar,
    	hc: hc,
    	hdx: hdx,
    	hedg: hedg,
    	hegic: hegic,
    	hex: hex,
    	hft: hft,
    	hg: hg,
    	hgs: hgs,
    	hh: hh,
    	high: high,
    	hit: hit,
    	hive: hive,
    	hkd: hkd,
    	hmq: hmq,
    	hns: hns,
    	ho: ho,
    	hopr: hopr,
    	hot: hot,
    	hp: hp,
    	hpb: hpb,
    	hpc: hpc,
    	hpt: hpt,
    	hrc: hrc,
    	hsc: hsc,
    	hsr: hsr,
    	hst: hst,
    	ht: ht,
    	html: html,
    	htt: htt,
    	huc: huc,
    	hunt: hunt,
    	hvn: hvn,
    	hxro: hxro,
    	hyc: hyc,
    	hydra: hydra,
    	hydro: hydro,
    	icn: icn,
    	icos: icos,
    	icp: icp,
    	icx: icx,
    	idex: idex,
    	idh: idh,
    	idr: idr,
    	ift: ift,
    	ignis: ignis,
    	ihf: ihf,
    	iht: iht,
    	ilc: ilc,
    	ilv: ilv,
    	imx: imx,
    	incnt: incnt,
    	ind: ind,
    	indi: indi,
    	inj: inj,
    	ink: ink,
    	inr: inr,
    	ins: ins,
    	int: int,
    	intr: intr,
    	ioc: ioc,
    	ion: ion,
    	iost: iost,
    	iot: iot,
    	iotx: iotx,
    	iq: iq,
    	iris: iris,
    	itc: itc,
    	ivy: ivy,
    	ixt: ixt,
    	jasmy: jasmy,
    	jnt: jnt,
    	joe: joe,
    	jpeg: jpeg,
    	jpy: jpy,
    	jst: jst,
    	juno: juno,
    	just: just,
    	juv: juv,
    	kan: kan,
    	kar: kar,
    	kava: kava,
    	kbc: kbc,
    	kcash: kcash,
    	kda: kda,
    	keep: keep,
    	key: key,
    	kick: kick,
    	kilt: kilt,
    	kin: kin,
    	kint: kint,
    	klay: klay,
    	kma: kma,
    	kmd: kmd,
    	knc: knc,
    	kore: kore,
    	kp3r: kp3r,
    	krm: krm,
    	krw: krw,
    	ksm: ksm,
    	ksx: ksx,
    	kyl: kyl,
    	la: la,
    	lak: lak,
    	lamb: lamb,
    	latx: latx,
    	layr: layr,
    	lba: lba,
    	lbc: lbc,
    	lcc: lcc,
    	lcx: lcx,
    	ldo: ldo,
    	lend: lend,
    	leo: leo,
    	leoc: leoc,
    	"let": "LinkEye",
    	life: life,
    	lina: lina,
    	link: link,
    	lit: lit,
    	lmc: lmc,
    	lml: lml,
    	lnc: lnc,
    	lnd: lnd,
    	loc: loc,
    	loka: loka,
    	looks: looks,
    	loom: loom,
    	lpt: lpt,
    	lqty: lqty,
    	lrc: lrc,
    	lrn: lrn,
    	lsk: lsk,
    	ltc: ltc,
    	lto: lto,
    	lun: lun,
    	luna: luna,
    	luna2: luna2,
    	lxt: lxt,
    	lym: lym,
    	m2k: m2k,
    	ma: ma,
    	magic: magic,
    	maid: maid,
    	man: man,
    	mana: mana,
    	maps: maps,
    	mask: mask,
    	mass: mass,
    	math: math,
    	matic: matic,
    	mbl: mbl,
    	mbt: mbt,
    	mc: mc,
    	mco: mco,
    	mda: mda,
    	mds: mds,
    	mdt: mdt,
    	mdx: mdx,
    	med: med,
    	mer: mer,
    	mes: mes,
    	met: met,
    	meta: meta,
    	mft: mft,
    	mgc: mgc,
    	mgo: mgo,
    	mhc: mhc,
    	mina: mina,
    	mir: mir,
    	mith: mith,
    	mitx: mitx,
    	mjp: mjp,
    	mkr: mkr,
    	mln: mln,
    	mngo: mngo,
    	mnx: mnx,
    	moac: moac,
    	mob: mob,
    	mobi: mobi,
    	moc: moc,
    	mod: mod,
    	mona: mona,
    	moon: moon,
    	morph: morph,
    	movr: movr,
    	mpl: mpl,
    	mrk: mrk,
    	msol: msol,
    	msp: msp,
    	mta: mta,
    	mtc: mtc,
    	mth: mth,
    	mtl: mtl,
    	mtn: mtn,
    	mtx: mtx,
    	mue: mue,
    	multi: multi,
    	mv: mv,
    	mx: mx,
    	mxm: mxm,
    	mxn: mxn,
    	myr: myr,
    	n9l: n9l,
    	nanj: nanj,
    	nano: nano,
    	nas: nas,
    	naut: naut,
    	nav: nav,
    	ncash: ncash,
    	nct: nct,
    	near: near,
    	nebl: nebl,
    	nec: nec,
    	neo: neo,
    	neos: neos,
    	nest: nest,
    	neu: neu,
    	"new": "Newton",
    	nexo: nexo,
    	nft: nft,
    	ng: ng,
    	ngc: ngc,
    	ngn: ngn,
    	nim: nim,
    	niy: niy,
    	nkd: nkd,
    	nkn: nkn,
    	nlc2: nlc2,
    	nlg: nlg,
    	nmc: nmc,
    	nmr: nmr,
    	nn: nn,
    	noah: noah,
    	nodl: nodl,
    	note: note,
    	npg: npg,
    	nplc: nplc,
    	npxs: npxs,
    	nq: nq,
    	nrg: nrg,
    	ntk: ntk,
    	nu: nu,
    	nuls: nuls,
    	nvc: nvc,
    	nxc: nxc,
    	nxs: nxs,
    	nxt: nxt,
    	nym: nym,
    	o: o,
    	oax: oax,
    	ocean: ocean,
    	ocn: ocn,
    	ode: ode,
    	ogn: ogn,
    	ogo: ogo,
    	ok: ok,
    	okb: okb,
    	om: om,
    	omg: omg,
    	omni: omni,
    	one: one,
    	ong: ong,
    	onot: onot,
    	ont: ont,
    	ooki: ooki,
    	orbs: orbs,
    	orca: orca,
    	orme: orme,
    	orn: orn,
    	ors: ors,
    	osmo: osmo,
    	ost: ost,
    	otn: otn,
    	oxt: oxt,
    	oxy: oxy,
    	pai: pai,
    	pal: pal,
    	paper: paper,
    	para: para,
    	part: part,
    	pasc: pasc,
    	pat: pat,
    	pax: pax,
    	paxg: paxg,
    	pay: pay,
    	pbt: pbt,
    	pcl: pcl,
    	pcx: pcx,
    	pdex: pdex,
    	people: people,
    	perl: perl,
    	perp: perp,
    	pha: pha,
    	phb: phb,
    	php: php,
    	phx: phx,
    	pi: pi,
    	pica: pica,
    	pink: pink,
    	pivx: pivx,
    	pkt: pkt,
    	pl: pl,
    	pla: pla,
    	plbt: plbt,
    	plm: plm,
    	pln: pln,
    	plr: plr,
    	ply: ply,
    	pma: pma,
    	png: png,
    	pnt: pnt,
    	poa: poa,
    	poe: poe,
    	polis: polis,
    	pols: pols,
    	poly: poly,
    	pond: pond,
    	pot: pot,
    	powr: powr,
    	ppc: ppc,
    	ppt: ppt,
    	pra: pra,
    	pre: pre,
    	prg: prg,
    	pro: pro,
    	prq: prq,
    	pst: pst,
    	pstake: pstake,
    	pton: pton,
    	pundix: pundix,
    	pvt: pvt,
    	pxg: pxg,
    	pyr: pyr,
    	qash: qash,
    	qau: qau,
    	qc: qc,
    	qi: qi,
    	qi2: qi2,
    	qkc: qkc,
    	qlc: qlc,
    	qnt: qnt,
    	qntu: qntu,
    	qo: qo,
    	qrdo: qrdo,
    	qrl: qrl,
    	qsp: qsp,
    	qtum: qtum,
    	qun: qun,
    	r: r,
    	rad: rad,
    	radar: radar,
    	rads: rads,
    	ramp: ramp,
    	rare: rare,
    	rari: rari,
    	rating: rating,
    	ray: ray,
    	rb: rb,
    	rbc: rbc,
    	rblx: rblx,
    	rbn: rbn,
    	rbtc: rbtc,
    	rby: rby,
    	rcn: rcn,
    	rdd: rdd,
    	rdn: rdn,
    	real: real,
    	reef: reef,
    	rem: rem,
    	ren: ren,
    	rep: rep,
    	repv2: repv2,
    	req: req,
    	rev: rev,
    	revv: revv,
    	rfox: rfox,
    	rfr: rfr,
    	ric: ric,
    	rif: rif,
    	ring: ring,
    	rlc: rlc,
    	rly: rly,
    	rmrk: rmrk,
    	rndr: rndr,
    	rntb: rntb,
    	ron: ron,
    	rook: rook,
    	rose: rose,
    	rox: rox,
    	rp: rp,
    	rpx: rpx,
    	rsr: rsr,
    	rsv: rsv,
    	rty: rty,
    	rub: rub,
    	ruff: ruff,
    	rune: rune,
    	rvn: rvn,
    	rvr: rvr,
    	rvt: rvt,
    	sai: sai,
    	salt: salt,
    	samo: samo,
    	san: san,
    	sand: sand,
    	sats: sats,
    	sbd: sbd,
    	sbr: sbr,
    	sc: sc,
    	scc: scc,
    	scrt: scrt,
    	sdc: sdc,
    	sdn: sdn,
    	seele: seele,
    	sek: sek,
    	sen: sen,
    	sent: sent,
    	sero: sero,
    	sexc: sexc,
    	sfp: sfp,
    	sgb: sgb,
    	sgc: sgc,
    	sgd: sgd,
    	sgn: sgn,
    	sgu: sgu,
    	shib: shib,
    	shift: shift,
    	ship: ship,
    	shping: shping,
    	si: si,
    	sib: sib,
    	sil: sil,
    	six: six,
    	sjcx: sjcx,
    	skl: skl,
    	skm: skm,
    	sku: sku,
    	sky: sky,
    	slp: slp,
    	slr: slr,
    	sls: sls,
    	slt: slt,
    	slv: slv,
    	smart: smart,
    	smn: smn,
    	smt: smt,
    	snc: snc,
    	snet: snet,
    	sngls: sngls,
    	snm: snm,
    	snt: snt,
    	snx: snx,
    	soc: soc,
    	socks: socks,
    	sol: sol,
    	solid: solid,
    	solo: solo,
    	solve: solve,
    	sos: sos,
    	soul: soul,
    	sp: sp,
    	sparta: sparta,
    	spc: spc,
    	spd: spd,
    	spell: spell,
    	sphr: sphr,
    	sphtx: sphtx,
    	spnd: spnd,
    	spnk: spnk,
    	srm: srm,
    	srn: srn,
    	ssp: ssp,
    	stacs: stacs,
    	step: step,
    	stg: stg,
    	stmx: stmx,
    	storm: storm,
    	stpt: stpt,
    	stq: stq,
    	str: str,
    	strat: strat,
    	strax: strax,
    	strk: strk,
    	strong: strong,
    	stx: stx,
    	sub: sub,
    	sun: sun,
    	"super": "SuperFarm",
    	susd: susd,
    	sushi: sushi,
    	swftc: swftc,
    	swm: swm,
    	swrv: swrv,
    	swt: swt,
    	swth: swth,
    	sxp: sxp,
    	syn: syn,
    	sys: sys,
    	t: t,
    	taas: taas,
    	tau: tau,
    	tbtc: tbtc,
    	tct: tct,
    	teer: teer,
    	tel: tel,
    	temco: temco,
    	tfuel: tfuel,
    	thb: thb,
    	thc: thc,
    	theta: theta,
    	thx: thx,
    	time: time,
    	tio: tio,
    	tix: tix,
    	tkn: tkn,
    	tky: tky,
    	tlm: tlm,
    	tnb: tnb,
    	tnc: tnc,
    	tnt: tnt,
    	toke: toke,
    	tomb: tomb,
    	tomo: tomo,
    	top: top,
    	torn: torn,
    	tower: tower,
    	tpay: tpay,
    	trac: trac,
    	trb: trb,
    	tribe: tribe,
    	trig: trig,
    	trio: trio,
    	troy: troy,
    	trst: trst,
    	tru: tru,
    	"true": "True Chain",
    	trx: trx,
    	"try": "Turkish Lira",
    	tryb: tryb,
    	tt: tt,
    	ttc: ttc,
    	ttt: ttt,
    	ttu: ttu,
    	tube: tube,
    	tusd: tusd,
    	tvk: tvk,
    	twt: twt,
    	uah: uah,
    	ubq: ubq,
    	ubt: ubt,
    	uft: uft,
    	ugas: ugas,
    	uip: uip,
    	ukg: ukg,
    	uma: uma,
    	unfi: unfi,
    	uni: uni,
    	unq: unq,
    	up: up,
    	upp: upp,
    	usd: usd,
    	usdc: usdc,
    	usds: usds,
    	usk: usk,
    	ust: ust,
    	utk: utk,
    	utnp: utnp,
    	utt: utt,
    	uuu: uuu,
    	ux: ux,
    	vader: vader,
    	vai: vai,
    	vbk: vbk,
    	vdx: vdx,
    	vee: vee,
    	vemp: vemp,
    	ven: ven,
    	veo: veo,
    	veri: veri,
    	vex: vex,
    	vgx: vgx,
    	via: via,
    	vib: vib,
    	vibe: vibe,
    	vid: vid,
    	vidt: vidt,
    	vidy: vidy,
    	vitae: vitae,
    	vite: vite,
    	vlx: vlx,
    	vox: vox,
    	voxel: voxel,
    	vra: vra,
    	vrc: vrc,
    	vrm: vrm,
    	vsys: vsys,
    	vtc: vtc,
    	vtho: vtho,
    	wabi: wabi,
    	wan: wan,
    	waves: waves,
    	wax: wax,
    	wbtc: wbtc,
    	wet: wet,
    	weth: weth,
    	wib: wib,
    	wicc: wicc,
    	win: win,
    	wing: wing,
    	wings: wings,
    	wnxm: wnxm,
    	woo: woo,
    	wpr: wpr,
    	wrx: wrx,
    	wtc: wtc,
    	wtt: wtt,
    	wwb: wwb,
    	wxt: wxt,
    	xas: xas,
    	xaur: xaur,
    	xaut: xaut,
    	xava: xava,
    	xbc: xbc,
    	xcon: xcon,
    	xcp: xcp,
    	xdefi: xdefi,
    	xdn: xdn,
    	xel: xel,
    	xem: xem,
    	xes: xes,
    	xhv: xhv,
    	xin: xin,
    	xlm: xlm,
    	xmc: xmc,
    	xmr: xmr,
    	xmx: xmx,
    	xmy: xmy,
    	xnk: xnk,
    	xns: xns,
    	xor: xor,
    	xos: xos,
    	xpm: xpm,
    	xpr: xpr,
    	xrc: xrc,
    	xrp: xrp,
    	xrpx: xrpx,
    	xrt: xrt,
    	xst: xst,
    	xtp: xtp,
    	xtz: xtz,
    	xtzdown: xtzdown,
    	xvc: xvc,
    	xvg: xvg,
    	xvs: xvs,
    	xwc: xwc,
    	xyo: xyo,
    	xzc: xzc,
    	yam: yam,
    	yee: yee,
    	yeed: yeed,
    	yfi: yfi,
    	yfii: yfii,
    	ygg: ygg,
    	yoyow: yoyow,
    	zar: zar,
    	zcl: zcl,
    	zcn: zcn,
    	zco: zco,
    	zec: zec,
    	zen: zen,
    	zil: zil,
    	zks: zks,
    	zla: zla,
    	zlk: zlk,
    	zondo: zondo,
    	zpr: zpr,
    	zpt: zpt,
    	zrc: zrc,
    	zrx: zrx,
    	zsc: zsc,
    	ztg: ztg,
    	"": "",
    	xbt: xbt,
    	bitz: bitz,
    	cs: cs,
    	crm: crm,
    	xdg: xdg,
    	eth2: eth2,
    	eth2s: eth2s,
    	"eth2.s": "",
    	usdt: usdt,
    	kraken: kraken,
    	"kraken-futures": "Kraken Futures",
    	gemini: gemini,
    	husd: husd,
    	huobi: huobi,
    	iota: iota,
    	medx: medx,
    	rur: rur,
    	steem: steem,
    	xsc: xsc,
    	storj: storj,
    	vet: vet,
    	waxp: waxp,
    	"binance-us": "Binance.US",
    	mexbt: mexbt,
    	"coinbase-pro": "Coinbase Pro",
    	gdax: gdax,
    	quadriga: quadriga,
    	"ftx-us": "FTX.US",
    	cgld: cgld,
    	"uniswap-v2": "Uniswap V2",
    	kshib: kshib,
    	srare: srare,
    	"ape.2": ""
    };

    var map = {
    	"sym-d": "sym-_default",
    	"sym-d-s": "sym-_default-s",
    	"sym-default": "sym-_default",
    	"sym-default-s": "sym-_default-s",
    	"exc-d": "exc-_default",
    	"exc-d-s": "exc-_default-s",
    	"exc-default": "exc-_default",
    	"exc-default-s": "exc-_default-s",
    	"cur-default": "sym-_default",
    	"cur-default-s": "sym-_default-s",
    	"cur-anct": "sym-anct",
    	"cur-anct-s": "sym-anct-s",
    	"cur-aud": "sym-aud",
    	"cur-aud-s": "sym-aud-s",
    	"cur-bnb": "sym-bnb",
    	"cur-bnb-s": "sym-bnb-s",
    	"sym-xbt": "sym-btc",
    	"cur-btc": "sym-btc",
    	"sym-xbt-s": "sym-btc-s",
    	"cur-btc-s": "sym-btc-s",
    	"cur-busd": "sym-busd",
    	"cur-busd-s": "sym-busd-s",
    	"exc-bitz": "sym-bz",
    	"cur-bz": "sym-bz",
    	"exc-bitz-s": "sym-bz-s",
    	"cur-bz-s": "sym-bz-s",
    	"cur-cad": "sym-cad",
    	"cur-cad-s": "sym-cad-s",
    	"cur-chf": "sym-chf",
    	"cur-chf-s": "sym-chf-s",
    	"cur-cny": "sym-cny",
    	"cur-cny-s": "sym-cny-s",
    	"sym-cs": "sym-cova",
    	"sym-cs-s": "sym-cova-s",
    	"sym-crm": "sym-cru",
    	"sym-crm-s": "sym-cru-s",
    	"cur-dai": "sym-dai",
    	"cur-dai-s": "sym-dai-s",
    	"sym-xdg": "sym-doge",
    	"sym-xdg-s": "sym-doge-s",
    	"cur-eos": "sym-eos",
    	"cur-eos-s": "sym-eos-s",
    	"sym-eth2": "sym-eth",
    	"sym-eth2s": "sym-eth",
    	"sym-eth2.s": "sym-eth",
    	"cur-eth": "sym-eth",
    	"sym-eth2-s": "sym-eth-s",
    	"sym-eth2s-s": "sym-eth-s",
    	"sym-eth2.s-s": "sym-eth-s",
    	"cur-eth-s": "sym-eth-s",
    	"cur-eur": "sym-eur",
    	"cur-eur-s": "sym-eur-s",
    	"cur-eurs": "sym-eurs",
    	"cur-eurs-s": "sym-eurs-s",
    	"sym-usdt": "sym-eurt",
    	"cur-usdt": "sym-eurt",
    	"sym-usdt-s": "sym-eurt-s",
    	"cur-usdt-s": "sym-eurt-s",
    	"exc-kraken": "sym-fee",
    	"exc-kraken-futures": "sym-fee",
    	"exc-kraken-s": "sym-fee-s",
    	"exc-kraken-futures-s": "sym-fee-s",
    	"cur-gbp": "sym-gbp",
    	"cur-gbp-s": "sym-gbp-s",
    	"exc-gemini": "sym-gusd",
    	"cur-gusd": "sym-gusd",
    	"exc-gemini-s": "sym-gusd-s",
    	"cur-gusd-s": "sym-gusd-s",
    	"cur-hkd": "sym-hkd",
    	"cur-hkd-s": "sym-hkd-s",
    	"sym-husd": "sym-ht",
    	"exc-huobi": "sym-ht",
    	"cur-ht": "sym-ht",
    	"sym-husd-s": "sym-ht-s",
    	"exc-huobi-s": "sym-ht-s",
    	"cur-ht-s": "sym-ht-s",
    	"cur-idr": "sym-idr",
    	"cur-idr-s": "sym-idr-s",
    	"sym-iota": "sym-iot",
    	"sym-iota-s": "sym-iot-s",
    	"cur-inr": "sym-inr",
    	"cur-inr-s": "sym-inr-s",
    	"cur-jpy": "sym-jpy",
    	"cur-jpy-s": "sym-jpy-s",
    	"cur-krw": "sym-krw",
    	"cur-krw-s": "sym-krw-s",
    	"sym-medx": "sym-med",
    	"sym-medx-s": "sym-med-s",
    	"cur-mxn": "sym-mxn",
    	"cur-mxn-s": "sym-mxn-s",
    	"cur-myr": "sym-myr",
    	"cur-myr-s": "sym-myr-s",
    	"cur-ngn": "sym-ngn",
    	"cur-ngn-s": "sym-ngn-s",
    	"cur-pax": "sym-pax",
    	"cur-pax-s": "sym-pax-s",
    	"cur-php": "sym-php",
    	"cur-php-s": "sym-php-s",
    	"cur-pln": "sym-pln",
    	"cur-pln-s": "sym-pln-s",
    	"cur-qash": "sym-qash",
    	"cur-qash-s": "sym-qash-s",
    	"cur-rub": "sym-rub",
    	"cur-rur": "sym-rub",
    	"cur-rub-s": "sym-rub-s",
    	"cur-rur-s": "sym-rub-s",
    	"sym-steem": "sym-sbd",
    	"sym-steem-s": "sym-sbd-s",
    	"sym-xsc": "sym-sc",
    	"sym-xsc-s": "sym-sc-s",
    	"cur-sgd": "sym-sgd",
    	"cur-sgd-s": "sym-sgd-s",
    	"sym-storj": "sym-sjcx",
    	"sym-storj-s": "sym-sjcx-s",
    	"sym-tel": "sym-taas",
    	"cur-trx": "sym-trx",
    	"cur-trx-s": "sym-trx-s",
    	"cur-tusd": "sym-tusd",
    	"cur-tusd-s": "sym-tusd-s",
    	"cur-usd": "sym-usd",
    	"cur-usd-s": "sym-usd-s",
    	"cur-usdc": "sym-usdc",
    	"cur-usdc-s": "sym-usdc-s",
    	"sym-vet": "sym-ven",
    	"sym-vet-s": "sym-ven-s",
    	"sym-waxp": "sym-wax",
    	"sym-waxp-s": "sym-wax-s",
    	"cur-xlm": "sym-xlm",
    	"cur-xlm-s": "sym-xlm-s",
    	"cur-xmr": "sym-xmr",
    	"cur-xmr-s": "sym-xmr-s",
    	"cur-xrp": "sym-xrp",
    	"cur-xrp-s": "sym-xrp-s",
    	"cur-zar": "sym-zar",
    	"cur-zar-s": "sym-zar-s",
    	"exc-binance-us": "exc-binance",
    	"exc-binance-us-s": "exc-binance-s",
    	"exc-mexbt": "exc-bitvc",
    	"exc-mexbt-s": "exc-bitvc-s",
    	"exc-coinbase-pro": "exc-coinbasepro",
    	"exc-gdax": "exc-coinbasepro",
    	"exc-coinbase-pro-s": "exc-coinbasepro-s",
    	"exc-gdax-s": "exc-coinbasepro-s",
    	"exc-quadriga": "exc-quadrigacx",
    	"exc-quadriga-s": "exc-quadrigacx-s",
    	"cur-crc": "sym-crc",
    	"cur-crc-s": "sym-crc-s",
    	"cur-lak": "sym-lak",
    	"cur-lak-s": "sym-lak-s",
    	"cur-sek": "sym-sek",
    	"cur-sek-s": "sym-sek-s",
    	"cur-thb": "sym-thb",
    	"cur-thb-s": "sym-thb-s",
    	"cur-try": "sym-try",
    	"cur-try-s": "sym-try-s",
    	"cur-uah": "sym-uah",
    	"cur-uah-s": "sym-uah-s",
    	"exc-ftx": "sym-ftt",
    	"exc-ftx-s": "sym-ftt-s",
    	"exc-ftx-us": "sym-ftt",
    	"exc-ftx-us-s": "sym-ftt-s",
    	"sym-cgld": "sym-celo",
    	"sym-cgld-s": "sym-celo-s",
    	"exc-uniswap-v2": "sym-uni",
    	"exc-uniswap-v2-s": "sym-uni-s",
    	"sym-kshib": "sym-shib",
    	"sym-kshib-s": "sym-shib-s",
    	"sym-easy-s": "sym-easy",
    	"sym-srare": "sym-rare",
    	"sym-srare-s": "sym-rare-s",
    	"sym-ape.2": "sym-ape",
    	"sym-ape.2-s": "sym-ape-s"
    };

    /* src/App.svelte generated by Svelte v3.46.4 */

    const { Object: Object_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i];
    	return child_ctx;
    }

    // (72:0) {#if showCopiedMsg}
    function create_if_block_2(ctx) {
    	let div;
    	let div_transition;
    	let current;

    	function select_block_type(ctx, dirty) {
    		if (/*copyErr*/ ctx[4]) return create_if_block_3;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "copy-msg svelte-fkock6");
    			add_location(div, file, 72, 2, 1913);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_block.m(div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			if (local) {
    				add_render_callback(() => {
    					if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 100 }, true);
    					div_transition.run(1);
    				});
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			if (local) {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, { duration: 100 }, false);
    				div_transition.run(0);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(72:0) {#if showCopiedMsg}",
    		ctx
    	});

    	return block;
    }

    // (76:4) {:else}
    function create_else_block_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("SVG markup copied to clipboard");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(76:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (74:4) {#if copyErr}
    function create_if_block_3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Error");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(74:4) {#if copyErr}",
    		ctx
    	});

    	return block;
    }

    // (136:4) {:else}
    function create_else_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "No results.";
    			add_location(div, file, 136, 6, 3749);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(136:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (116:10) {#if beaconKeys.includes(beacon)}
    function create_if_block_1(ctx) {
    	let i;
    	let i_class_value;
    	let t0;
    	let div;
    	let span0;
    	let t1_value = /*beacon*/ ctx[18].slice(0, 4) + "";
    	let t1;
    	let span1;
    	let t2_value = /*syms*/ ctx[1][/*beacon*/ ctx[18]] + "";
    	let t2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			i = element("i");
    			t0 = space();
    			div = element("div");
    			span0 = element("span");
    			t1 = text(t1_value);
    			span1 = element("span");
    			t2 = text(t2_value);
    			attr_dev(i, "class", i_class_value = "" + (null_to_empty(`beacon ${/*beacon*/ ctx[18]}`) + " svelte-fkock6"));
    			add_location(i, file, 116, 12, 3038);
    			attr_dev(span0, "class", "prefix");
    			add_location(span0, file, 118, 14, 3142);
    			attr_dev(span1, "class", "main svelte-fkock6");
    			add_location(span1, file, 118, 62, 3190);
    			attr_dev(div, "class", "text svelte-fkock6");
    			add_location(div, file, 117, 12, 3109);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, i, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, span0);
    			append_dev(span0, t1);
    			append_dev(div, span1);
    			append_dev(span1, t2);

    			if (!mounted) {
    				dispose = listen_dev(
    					i,
    					"click",
    					function () {
    						if (is_function(/*getSVG*/ ctx[9](/*beacon*/ ctx[18]))) /*getSVG*/ ctx[9](/*beacon*/ ctx[18]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*filteredBeacons*/ 128 && i_class_value !== (i_class_value = "" + (null_to_empty(`beacon ${/*beacon*/ ctx[18]}`) + " svelte-fkock6"))) {
    				attr_dev(i, "class", i_class_value);
    			}

    			if (dirty & /*filteredBeacons*/ 128 && t1_value !== (t1_value = /*beacon*/ ctx[18].slice(0, 4) + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*syms, filteredBeacons*/ 130 && t2_value !== (t2_value = /*syms*/ ctx[1][/*beacon*/ ctx[18]] + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(i);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(116:10) {#if beaconKeys.includes(beacon)}",
    		ctx
    	});

    	return block;
    }

    // (126:10) {#if beaconKeys.includes(`${beacon}-s`)}
    function create_if_block(ctx) {
    	let i;
    	let i_class_value;
    	let t0;
    	let div;
    	let span0;
    	let t1_value = /*beacon*/ ctx[18].slice(0, 4) + "";
    	let t1;
    	let span1;
    	let t2_value = /*syms*/ ctx[1][/*beacon*/ ctx[18]] + "";
    	let t2;
    	let span2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			i = element("i");
    			t0 = space();
    			div = element("div");
    			span0 = element("span");
    			t1 = text(t1_value);
    			span1 = element("span");
    			t2 = text(t2_value);
    			span2 = element("span");
    			span2.textContent = "-s";
    			attr_dev(i, "class", i_class_value = "" + (null_to_empty(`beacon ${/*beacon*/ ctx[18]}-s`) + " svelte-fkock6"));
    			add_location(i, file, 126, 12, 3403);
    			attr_dev(span0, "class", "prefix");
    			add_location(span0, file, 128, 14, 3516);
    			attr_dev(span1, "class", "main svelte-fkock6");
    			add_location(span1, file, 128, 62, 3564);
    			attr_dev(span2, "class", "postfix");
    			add_location(span2, file, 130, 15, 3636);
    			attr_dev(div, "class", "text svelte-fkock6");
    			add_location(div, file, 127, 12, 3483);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, i, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, span0);
    			append_dev(span0, t1);
    			append_dev(div, span1);
    			append_dev(span1, t2);
    			append_dev(div, span2);

    			if (!mounted) {
    				dispose = listen_dev(
    					i,
    					"click",
    					function () {
    						if (is_function(/*getSVG*/ ctx[9](`${/*beacon*/ ctx[18]}-s`))) /*getSVG*/ ctx[9](`${/*beacon*/ ctx[18]}-s`).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*filteredBeacons*/ 128 && i_class_value !== (i_class_value = "" + (null_to_empty(`beacon ${/*beacon*/ ctx[18]}-s`) + " svelte-fkock6"))) {
    				attr_dev(i, "class", i_class_value);
    			}

    			if (dirty & /*filteredBeacons*/ 128 && t1_value !== (t1_value = /*beacon*/ ctx[18].slice(0, 4) + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*syms, filteredBeacons*/ 130 && t2_value !== (t2_value = /*syms*/ ctx[1][/*beacon*/ ctx[18]] + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(i);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(126:10) {#if beaconKeys.includes(`${beacon}-s`)}",
    		ctx
    	});

    	return block;
    }

    // (112:4) {#each filteredBeacons as beacon}
    function create_each_block(ctx) {
    	let div3;
    	let div0;
    	let t0_value = /*names*/ ctx[2][/*beacon*/ ctx[18]] + "";
    	let t0;
    	let t1;
    	let div1;
    	let show_if_1 = /*beaconKeys*/ ctx[8].includes(/*beacon*/ ctx[18]);
    	let t2;
    	let div2;
    	let show_if = /*beaconKeys*/ ctx[8].includes(`${/*beacon*/ ctx[18]}-s`);
    	let t3;
    	let if_block0 = show_if_1 && create_if_block_1(ctx);
    	let if_block1 = show_if && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			if (if_block0) if_block0.c();
    			t2 = space();
    			div2 = element("div");
    			if (if_block1) if_block1.c();
    			t3 = space();
    			attr_dev(div0, "class", "name svelte-fkock6");
    			add_location(div0, file, 113, 8, 2915);
    			attr_dev(div1, "class", "icon svelte-fkock6");
    			add_location(div1, file, 114, 8, 2963);
    			attr_dev(div2, "class", "icon svelte-fkock6");
    			add_location(div2, file, 124, 8, 3321);
    			attr_dev(div3, "class", "beacon-container svelte-fkock6");
    			add_location(div3, file, 112, 6, 2876);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, t0);
    			append_dev(div3, t1);
    			append_dev(div3, div1);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div3, t2);
    			append_dev(div3, div2);
    			if (if_block1) if_block1.m(div2, null);
    			append_dev(div3, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*names, filteredBeacons*/ 132 && t0_value !== (t0_value = /*names*/ ctx[2][/*beacon*/ ctx[18]] + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*filteredBeacons*/ 128) show_if_1 = /*beaconKeys*/ ctx[8].includes(/*beacon*/ ctx[18]);

    			if (show_if_1) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					if_block0.m(div1, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*filteredBeacons*/ 128) show_if = /*beaconKeys*/ ctx[8].includes(`${/*beacon*/ ctx[18]}-s`);

    			if (show_if) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(div2, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(112:4) {#each filteredBeacons as beacon}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let t0;
    	let div2;
    	let div0;
    	let h1;
    	let t2;
    	let p0;
    	let t3;
    	let a0;
    	let t5;
    	let a1;
    	let t7;
    	let t8;
    	let p1;
    	let t10;
    	let input;
    	let div0_resize_listener;
    	let t11;
    	let div1;
    	let mounted;
    	let dispose;
    	add_render_callback(/*onwindowresize*/ ctx[10]);
    	let if_block = /*showCopiedMsg*/ ctx[3] && create_if_block_2(ctx);
    	let each_value = /*filteredBeacons*/ ctx[7];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block(ctx);
    	}

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t0 = space();
    			div2 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Beacons";
    			t2 = space();
    			p0 = element("p");
    			t3 = text("Crypto icon font by\n      ");
    			a0 = element("a");
    			a0.textContent = "Cryptowatch";
    			t5 = text("\n      (");
    			a1 = element("a");
    			a1.textContent = "GitHub";
    			t7 = text(")");
    			t8 = space();
    			p1 = element("p");
    			p1.textContent = "Click on an icon to copy its SVG markup to your clipboard";
    			t10 = space();
    			input = element("input");
    			t11 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each_1_else) {
    				each_1_else.c();
    			}

    			attr_dev(h1, "class", "svelte-fkock6");
    			add_location(h1, file, 85, 4, 2173);
    			attr_dev(a0, "href", "https://cryptowat.ch");
    			attr_dev(a0, "target", "_blank");
    			attr_dev(a0, "rel", "noopener noreferrer");
    			add_location(a0, file, 88, 6, 2230);
    			attr_dev(a1, "href", "https://github.com/cryptowatch/beacons");
    			attr_dev(a1, "target", "_blank");
    			attr_dev(a1, "rel", "noopener noreferrer");
    			add_location(a1, file, 91, 7, 2342);
    			attr_dev(p0, "class", "svelte-fkock6");
    			add_location(p0, file, 86, 4, 2194);
    			attr_dev(p1, "class", "secondary svelte-fkock6");
    			add_location(p1, file, 97, 4, 2489);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", `Search ${/*beaconKeys*/ ctx[8].length} icons`);
    			attr_dev(input, "spellcheck", "false");
    			attr_dev(input, "class", "svelte-fkock6");
    			add_location(input, file, 100, 4, 2588);
    			add_render_callback(() => /*div0_elementresize_handler*/ ctx[12].call(div0));
    			add_location(div0, file, 84, 2, 2145);
    			attr_dev(div1, "class", "beacons-flex svelte-fkock6");
    			set_style(div1, "max-height", /*innerHeight*/ ctx[5] - /*clientHeight*/ ctx[6] - 16 + "px");
    			add_location(div1, file, 107, 2, 2737);
    			attr_dev(div2, "class", "container svelte-fkock6");
    			add_location(div2, file, 83, 0, 2119);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, h1);
    			append_dev(div0, t2);
    			append_dev(div0, p0);
    			append_dev(p0, t3);
    			append_dev(p0, a0);
    			append_dev(p0, t5);
    			append_dev(p0, a1);
    			append_dev(p0, t7);
    			append_dev(div0, t8);
    			append_dev(div0, p1);
    			append_dev(div0, t10);
    			append_dev(div0, input);
    			set_input_value(input, /*query*/ ctx[0]);
    			div0_resize_listener = add_resize_listener(div0, /*div0_elementresize_handler*/ ctx[12].bind(div0));
    			append_dev(div2, t11);
    			append_dev(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			if (each_1_else) {
    				each_1_else.m(div1, null);
    			}

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "resize", /*onwindowresize*/ ctx[10]),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*showCopiedMsg*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*showCopiedMsg*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t0.parentNode, t0);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (dirty & /*query*/ 1 && input.value !== /*query*/ ctx[0]) {
    				set_input_value(input, /*query*/ ctx[0]);
    			}

    			if (dirty & /*syms, filteredBeacons, getSVG, beaconKeys, names*/ 902) {
    				each_value = /*filteredBeacons*/ ctx[7];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;

    				if (each_value.length) {
    					if (each_1_else) {
    						each_1_else.d(1);
    						each_1_else = null;
    					}
    				} else if (!each_1_else) {
    					each_1_else = create_else_block(ctx);
    					each_1_else.c();
    					each_1_else.m(div1, null);
    				}
    			}

    			if (dirty & /*innerHeight, clientHeight*/ 96) {
    				set_style(div1, "max-height", /*innerHeight*/ ctx[5] - /*clientHeight*/ ctx[6] - 16 + "px");
    			}
    		},
    		i: function intro(local) {
    			transition_in(if_block);
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div2);
    			div0_resize_listener();
    			destroy_each(each_blocks, detaching);
    			if (each_1_else) each_1_else.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let filteredBeacons;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const hasPostfix = beacon => beacon.slice(beacon.length - 2) === "-s";

    	const getMiddlePart = beacon => {
    		const middle = beacon.slice(4);
    		return hasPostfix(beacon) ? middle.slice(0, -2) : middle;
    	};

    	const exclude = ["b", "d", "default", "_default"];
    	const beaconKeys = Object.keys(beacons).filter(beacon => !exclude.includes(getMiddlePart(beacon)));
    	let query = "";
    	const filtered = beaconKeys.filter(beacon => !hasPostfix(beacon));
    	const syms = {};
    	const names = {};

    	beaconKeys.forEach(beacon => {
    		const sym = getMiddlePart(beacon);
    		const name = beaconNames[sym] ? beaconNames[sym] : sym;
    		$$invalidate(1, syms[beacon] = sym, syms);
    		$$invalidate(2, names[beacon] = name, names);
    	});

    	let to;
    	let showCopiedMsg = false;
    	let copyErr = false;

    	const getSVG = async beacon => {
    		clearTimeout(to);
    		$$invalidate(3, showCopiedMsg = false);
    		$$invalidate(4, copyErr = false);
    		if (beacon in map) beacon = map[beacon];

    		try {
    			const res = await fetch(`https://raw.githubusercontent.com/cryptowatch/beacons/master/src/${beacon}.svg`);

    			if (res.ok) {
    				const text = await res.text();
    				navigator.clipboard.writeText(text);
    			} else {
    				$$invalidate(4, copyErr = true);
    			}
    		} catch(e) {
    			$$invalidate(4, copyErr = true);
    		}

    		$$invalidate(3, showCopiedMsg = true);
    		to = setTimeout(() => $$invalidate(3, showCopiedMsg = false), 1000);
    	};

    	onDestroy(() => clearTimeout(to));
    	let innerHeight, clientHeight;
    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function onwindowresize() {
    		$$invalidate(5, innerHeight = window.innerHeight);
    	}

    	function input_input_handler() {
    		query = this.value;
    		$$invalidate(0, query);
    	}

    	function div0_elementresize_handler() {
    		clientHeight = this.clientHeight;
    		$$invalidate(6, clientHeight);
    	}

    	$$self.$capture_state = () => ({
    		onDestroy,
    		fade,
    		beacons,
    		beaconNames,
    		map,
    		hasPostfix,
    		getMiddlePart,
    		exclude,
    		beaconKeys,
    		query,
    		filtered,
    		syms,
    		names,
    		to,
    		showCopiedMsg,
    		copyErr,
    		getSVG,
    		innerHeight,
    		clientHeight,
    		filteredBeacons
    	});

    	$$self.$inject_state = $$props => {
    		if ('query' in $$props) $$invalidate(0, query = $$props.query);
    		if ('to' in $$props) to = $$props.to;
    		if ('showCopiedMsg' in $$props) $$invalidate(3, showCopiedMsg = $$props.showCopiedMsg);
    		if ('copyErr' in $$props) $$invalidate(4, copyErr = $$props.copyErr);
    		if ('innerHeight' in $$props) $$invalidate(5, innerHeight = $$props.innerHeight);
    		if ('clientHeight' in $$props) $$invalidate(6, clientHeight = $$props.clientHeight);
    		if ('filteredBeacons' in $$props) $$invalidate(7, filteredBeacons = $$props.filteredBeacons);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*query, syms*/ 3) {
    			$$invalidate(7, filteredBeacons = filtered.filter(key => {
    				const q = query.toLowerCase();
    				const sym = syms[key];
    				const name = beaconNames[sym]?.toLowerCase();
    				return sym.includes(q) || name?.includes(q);
    			}));
    		}
    	};

    	return [
    		query,
    		syms,
    		names,
    		showCopiedMsg,
    		copyErr,
    		innerHeight,
    		clientHeight,
    		filteredBeacons,
    		beaconKeys,
    		getSVG,
    		onwindowresize,
    		input_input_handler,
    		div0_elementresize_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

})();
