
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

    var ustc = "fa32";
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
    	"sym-aptos-s": "f1df",
    	"sym-aptos": "f1e0",
    	"sym-ar-s": "f1e1",
    	"sym-ar": "f1e2",
    	"sym-ardr-s": "f1e3",
    	"sym-ardr": "f1e4",
    	"sym-ark-s": "f1e5",
    	"sym-ark": "f1e6",
    	"sym-arn-s": "f1e7",
    	"sym-arn": "f1e8",
    	"sym-arpa-s": "f1e9",
    	"sym-arpa": "f1ea",
    	"sym-art-s": "f1eb",
    	"sym-art": "f1ec",
    	"sym-aspt-s": "f1ed",
    	"sym-aspt": "f1ee",
    	"sym-ast-s": "f1ef",
    	"sym-ast": "f1f0",
    	"sym-astr-s": "f1f1",
    	"sym-astr": "f1f2",
    	"sym-at-s": "f1f3",
    	"sym-at": "f1f4",
    	"sym-atlas-s": "f1f5",
    	"sym-atlas": "f1f6",
    	"sym-atm-s": "f1f7",
    	"sym-atm": "f1f8",
    	"sym-atom-s": "f1f9",
    	"sym-atom": "f1fa",
    	"sym-atp-s": "f1fb",
    	"sym-atp": "f1fc",
    	"sym-atri-s": "f1fd",
    	"sym-atri": "f1fe",
    	"sym-auction-s": "f1ff",
    	"sym-auction": "f200",
    	"sym-aud-s": "f201",
    	"sym-aud": "f202",
    	"sym-audio-s": "f203",
    	"sym-audio": "f204",
    	"sym-aup-s": "f205",
    	"sym-aup": "f206",
    	"sym-aury-s": "f207",
    	"sym-aury": "f208",
    	"sym-ausd-s": "f209",
    	"sym-ausd": "f20a",
    	"sym-auto-s": "f20b",
    	"sym-auto": "f20c",
    	"sym-ava-s": "f20d",
    	"sym-ava": "f20e",
    	"sym-avax-s": "f20f",
    	"sym-avax": "f210",
    	"sym-avt-s": "f211",
    	"sym-avt": "f212",
    	"sym-axl-s": "f213",
    	"sym-axl": "f214",
    	"sym-axpr-s": "f215",
    	"sym-axpr": "f216",
    	"sym-axs-s": "f217",
    	"sym-axs": "f218",
    	"sym-b": "f219",
    	"sym-b0-s": "f21a",
    	"sym-b0": "f21b",
    	"sym-b2g-s": "f21c",
    	"sym-b2g": "f21d",
    	"sym-bab-s": "f21e",
    	"sym-bab": "f21f",
    	"sym-badger-s": "f220",
    	"sym-badger": "f221",
    	"sym-bake-s": "f222",
    	"sym-bake": "f223",
    	"sym-bal-s": "f224",
    	"sym-bal": "f225",
    	"sym-banca-s": "f226",
    	"sym-banca": "f227",
    	"sym-band-s": "f228",
    	"sym-band": "f229",
    	"sym-bat-s": "f22a",
    	"sym-bat": "f22b",
    	"sym-bay-s": "f22c",
    	"sym-bay": "f22d",
    	"sym-bbc-s": "f22e",
    	"sym-bbc": "f22f",
    	"sym-bcc-s": "f230",
    	"sym-bcc": "f231",
    	"sym-bcd-s": "f232",
    	"sym-bcd": "f233",
    	"sym-bch-s": "f234",
    	"sym-bch": "f235",
    	"sym-bci-s": "f236",
    	"sym-bci": "f237",
    	"sym-bcn-s": "f238",
    	"sym-bcn": "f239",
    	"sym-bcpt-s": "f23a",
    	"sym-bcpt": "f23b",
    	"sym-bcu-s": "f23c",
    	"sym-bcu": "f23d",
    	"sym-bcv-s": "f23e",
    	"sym-bcv": "f23f",
    	"sym-bcy-s": "f240",
    	"sym-bcy": "f241",
    	"sym-bdg-s": "f242",
    	"sym-bdg": "f243",
    	"sym-beam-s": "f244",
    	"sym-beam": "f245",
    	"sym-beet-s": "f246",
    	"sym-beet": "f247",
    	"sym-bel-s": "f248",
    	"sym-bel": "f249",
    	"sym-bela-s": "f24a",
    	"sym-bela": "f24b",
    	"sym-berry-s": "f24c",
    	"sym-berry": "f24d",
    	"sym-beta-s": "f24e",
    	"sym-beta": "f24f",
    	"sym-betr-s": "f250",
    	"sym-betr": "f251",
    	"sym-bez-s": "f252",
    	"sym-bez": "f253",
    	"sym-bft-s": "f254",
    	"sym-bft": "f255",
    	"sym-bfx-s": "f256",
    	"sym-bfx": "f257",
    	"sym-bhd-s": "f258",
    	"sym-bhd": "f259",
    	"sym-bht-s": "f25a",
    	"sym-bht": "f25b",
    	"sym-bico-s": "f25c",
    	"sym-bico": "f25d",
    	"sym-bit-s": "f25e",
    	"sym-bit": "f25f",
    	"sym-bitb-s": "f260",
    	"sym-bitb": "f261",
    	"sym-bix-s": "f262",
    	"sym-bix": "f263",
    	"sym-bk-s": "f264",
    	"sym-bk": "f265",
    	"sym-bkx-s": "f266",
    	"sym-bkx": "f267",
    	"sym-blk-s": "f268",
    	"sym-blk": "f269",
    	"sym-block-s": "f26a",
    	"sym-block": "f26b",
    	"sym-blok-s": "f26c",
    	"sym-blok": "f26d",
    	"sym-blt-s": "f26e",
    	"sym-blt": "f26f",
    	"sym-blz-s": "f270",
    	"sym-blz": "f271",
    	"sym-bmc-s": "f272",
    	"sym-bmc": "f273",
    	"sym-bnb-s": "f274",
    	"sym-bnb": "f275",
    	"sym-bnc-s": "f276",
    	"sym-bnc": "f277",
    	"sym-bnk-s": "f278",
    	"sym-bnk": "f279",
    	"sym-bnt-s": "f27a",
    	"sym-bnt": "f27b",
    	"sym-bo-s": "f27c",
    	"sym-bo": "f27d",
    	"sym-boba-s": "f27e",
    	"sym-boba": "f27f",
    	"sym-bond-s": "f280",
    	"sym-bond": "f281",
    	"sym-boo-s": "f282",
    	"sym-boo": "f283",
    	"sym-bor-s": "f284",
    	"sym-bor": "f285",
    	"sym-bora-s": "f286",
    	"sym-bora": "f287",
    	"sym-bos-s": "f288",
    	"sym-bos": "f289",
    	"sym-box-s": "f28a",
    	"sym-box": "f28b",
    	"sym-brd-s": "f28c",
    	"sym-brd": "f28d",
    	"sym-breed-s": "f28e",
    	"sym-breed": "f28f",
    	"sym-brg-s": "f290",
    	"sym-brg": "f291",
    	"sym-brick-s": "f292",
    	"sym-brick": "f293",
    	"sym-bsd-s": "f294",
    	"sym-bsd": "f295",
    	"sym-bsv-s": "f296",
    	"sym-bsv": "f297",
    	"sym-bsx-s": "f298",
    	"sym-bsx": "f299",
    	"sym-bt1-s": "f29a",
    	"sym-bt1": "f29b",
    	"sym-bt2-s": "f29c",
    	"sym-bt2": "f29d",
    	"sym-btc-s": "f29e",
    	"sym-btc": "f29f",
    	"sym-btcd-s": "f2a0",
    	"sym-btcd": "f2a1",
    	"sym-btcfx-s": "f2a2",
    	"sym-btcfx": "f2a3",
    	"sym-btcp-s": "f2a4",
    	"sym-btcp": "f2a5",
    	"sym-btg-s": "f2a6",
    	"sym-btg": "f2a7",
    	"sym-btm-s": "f2a8",
    	"sym-btm": "f2a9",
    	"sym-btn-s": "f2aa",
    	"sym-btn": "f2ab",
    	"sym-bto-s": "f2ac",
    	"sym-bto": "f2ad",
    	"sym-btrst-s": "f2ae",
    	"sym-btrst": "f2af",
    	"sym-bts-s": "f2b0",
    	"sym-bts": "f2b1",
    	"sym-btt-s": "f2b2",
    	"sym-btt": "f2b3",
    	"sym-btu-s": "f2b4",
    	"sym-btu": "f2b5",
    	"sym-btx-s": "f2b6",
    	"sym-btx": "f2b7",
    	"sym-burger-s": "f2b8",
    	"sym-burger": "f2b9",
    	"sym-burst-s": "f2ba",
    	"sym-burst": "f2bb",
    	"sym-bus-s": "f2bc",
    	"sym-bus": "f2bd",
    	"sym-busd-s": "f2be",
    	"sym-busd": "f2bf",
    	"sym-bwx-s": "f2c0",
    	"sym-bwx": "f2c1",
    	"sym-bz-s": "f2c2",
    	"sym-bz": "f2c3",
    	"sym-bzrx-s": "f2c4",
    	"sym-bzrx": "f2c5",
    	"sym-c-s": "f2c6",
    	"sym-c": "f2c7",
    	"sym-c20-s": "f2c8",
    	"sym-c20": "f2c9",
    	"sym-c98-s": "f2ca",
    	"sym-c98": "f2cb",
    	"sym-cad-s": "f2cc",
    	"sym-cad": "f2cd",
    	"sym-cake-s": "f2ce",
    	"sym-cake": "f2cf",
    	"sym-cas-s": "f2d0",
    	"sym-cas": "f2d1",
    	"sym-cat-s": "f2d2",
    	"sym-cat": "f2d3",
    	"sym-cbc-s": "f2d4",
    	"sym-cbc": "f2d5",
    	"sym-cbt-s": "f2d6",
    	"sym-cbt": "f2d7",
    	"sym-cdt-s": "f2d8",
    	"sym-cdt": "f2d9",
    	"sym-cel-s": "f2da",
    	"sym-cel": "f2db",
    	"sym-celo-s": "f2dc",
    	"sym-celo": "f2dd",
    	"sym-celr-s": "f2de",
    	"sym-celr": "f2df",
    	"sym-cennz-s": "f2e0",
    	"sym-cennz": "f2e1",
    	"sym-cfg-s": "f2e2",
    	"sym-cfg": "f2e3",
    	"sym-cfi-s": "f2e4",
    	"sym-cfi": "f2e5",
    	"sym-cfx-s": "f2e6",
    	"sym-cfx": "f2e7",
    	"sym-cgt-s": "f2e8",
    	"sym-cgt": "f2e9",
    	"sym-chat-s": "f2ea",
    	"sym-chat": "f2eb",
    	"sym-chf-s": "f2ec",
    	"sym-chf": "f2ed",
    	"sym-chp-s": "f2ee",
    	"sym-chp": "f2ef",
    	"sym-chr-s": "f2f0",
    	"sym-chr": "f2f1",
    	"sym-chsb-s": "f2f2",
    	"sym-chsb": "f2f3",
    	"sym-chx-s": "f2f4",
    	"sym-chx": "f2f5",
    	"sym-chz-s": "f2f6",
    	"sym-chz": "f2f7",
    	"sym-ckb-s": "f2f8",
    	"sym-ckb": "f2f9",
    	"sym-cl-s": "f2fa",
    	"sym-cl": "f2fb",
    	"sym-clam-s": "f2fc",
    	"sym-clam": "f2fd",
    	"sym-cln-s": "f2fe",
    	"sym-cln": "f2ff",
    	"sym-clo-s": "f300",
    	"sym-clo": "f301",
    	"sym-cloak-s": "f302",
    	"sym-cloak": "f303",
    	"sym-clv-s": "f304",
    	"sym-clv": "f305",
    	"sym-cmct-s": "f306",
    	"sym-cmct": "f307",
    	"sym-cmt-s": "f308",
    	"sym-cmt": "f309",
    	"sym-cnd-s": "f30a",
    	"sym-cnd": "f30b",
    	"sym-cnn-s": "f30c",
    	"sym-cnn": "f30d",
    	"sym-cnx-s": "f30e",
    	"sym-cnx": "f30f",
    	"sym-cny-s": "f310",
    	"sym-cny": "f311",
    	"sym-cob-s": "f312",
    	"sym-cob": "f313",
    	"sym-cocos-s": "f314",
    	"sym-cocos": "f315",
    	"sym-comp-s": "f316",
    	"sym-comp": "f317",
    	"sym-cope-s": "f318",
    	"sym-cope": "f319",
    	"sym-cos-s": "f31a",
    	"sym-cos": "f31b",
    	"sym-cosm-s": "f31c",
    	"sym-cosm": "f31d",
    	"sym-coss-s": "f31e",
    	"sym-coss": "f31f",
    	"sym-coti-s": "f320",
    	"sym-coti": "f321",
    	"sym-cov-s": "f322",
    	"sym-cov": "f323",
    	"sym-cova-s": "f324",
    	"sym-cova": "f325",
    	"sym-cpt-s": "f326",
    	"sym-cpt": "f327",
    	"sym-cpx-s": "f328",
    	"sym-cpx": "f329",
    	"sym-cqt-s": "f32a",
    	"sym-cqt": "f32b",
    	"sym-cra-s": "f32c",
    	"sym-cra": "f32d",
    	"sym-crab-s": "f32e",
    	"sym-crab": "f32f",
    	"sym-crc-s": "f330",
    	"sym-crc": "f331",
    	"sym-cre-s": "f332",
    	"sym-cre": "f333",
    	"sym-cream-s": "f334",
    	"sym-cream": "f335",
    	"sym-cring-s": "f336",
    	"sym-cring": "f337",
    	"sym-cro-s": "f338",
    	"sym-cro": "f339",
    	"sym-crpt-s": "f33a",
    	"sym-crpt": "f33b",
    	"sym-cru-s": "f33c",
    	"sym-cru": "f33d",
    	"sym-crv-s": "f33e",
    	"sym-crv": "f33f",
    	"sym-crw-s": "f340",
    	"sym-crw": "f341",
    	"sym-csm-s": "f342",
    	"sym-csm": "f343",
    	"sym-csx-s": "f344",
    	"sym-csx": "f345",
    	"sym-ctc-s": "f346",
    	"sym-ctc": "f347",
    	"sym-ctk-s": "f348",
    	"sym-ctk": "f349",
    	"sym-ctsi-s": "f34a",
    	"sym-ctsi": "f34b",
    	"sym-ctxc-s": "f34c",
    	"sym-ctxc": "f34d",
    	"sym-cult-s": "f34e",
    	"sym-cult": "f34f",
    	"sym-cur-s": "f350",
    	"sym-cur": "f351",
    	"sym-cvc-s": "f352",
    	"sym-cvc": "f353",
    	"sym-cvcoin-s": "f354",
    	"sym-cvcoin": "f355",
    	"sym-cvnt-s": "f356",
    	"sym-cvnt": "f357",
    	"sym-cvp-s": "f358",
    	"sym-cvp": "f359",
    	"sym-cvt-s": "f35a",
    	"sym-cvt": "f35b",
    	"sym-cvx-s": "f35c",
    	"sym-cvx": "f35d",
    	"sym-cw-s": "f35e",
    	"sym-cw": "f35f",
    	"sym-cyc-s": "f360",
    	"sym-cyc": "f361",
    	"sym-dac-s": "f362",
    	"sym-dac": "f363",
    	"sym-dacs-s": "f364",
    	"sym-dacs": "f365",
    	"sym-dadi-s": "f366",
    	"sym-dadi": "f367",
    	"sym-dag-s": "f368",
    	"sym-dag": "f369",
    	"sym-dai-s": "f36a",
    	"sym-dai": "f36b",
    	"sym-dao-s": "f36c",
    	"sym-dao": "f36d",
    	"sym-dar-s": "f36e",
    	"sym-dar": "f36f",
    	"sym-dash-s": "f370",
    	"sym-dash": "f371",
    	"sym-dat-s": "f372",
    	"sym-dat": "f373",
    	"sym-data-s": "f374",
    	"sym-data": "f375",
    	"sym-datx-s": "f376",
    	"sym-datx": "f377",
    	"sym-dbc-s": "f378",
    	"sym-dbc": "f379",
    	"sym-dbet-s": "f37a",
    	"sym-dbet": "f37b",
    	"sym-dbix-s": "f37c",
    	"sym-dbix": "f37d",
    	"sym-dcn-s": "f37e",
    	"sym-dcn": "f37f",
    	"sym-dcr-s": "f380",
    	"sym-dcr": "f381",
    	"sym-dct-s": "f382",
    	"sym-dct": "f383",
    	"sym-ddd-s": "f384",
    	"sym-ddd": "f385",
    	"sym-dego-s": "f386",
    	"sym-dego": "f387",
    	"sym-dent-s": "f388",
    	"sym-dent": "f389",
    	"sym-dext-s": "f38a",
    	"sym-dext": "f38b",
    	"sym-dgb-s": "f38c",
    	"sym-dgb": "f38d",
    	"sym-dgd-s": "f38e",
    	"sym-dgd": "f38f",
    	"sym-dgtx-s": "f390",
    	"sym-dgtx": "f391",
    	"sym-dgx-s": "f392",
    	"sym-dgx": "f393",
    	"sym-dhx-s": "f394",
    	"sym-dhx": "f395",
    	"sym-dia-s": "f396",
    	"sym-dia": "f397",
    	"sym-dice-s": "f398",
    	"sym-dice": "f399",
    	"sym-dim-s": "f39a",
    	"sym-dim": "f39b",
    	"sym-dlt-s": "f39c",
    	"sym-dlt": "f39d",
    	"sym-dmd-s": "f39e",
    	"sym-dmd": "f39f",
    	"sym-dmt-s": "f3a0",
    	"sym-dmt": "f3a1",
    	"sym-dnt-s": "f3a2",
    	"sym-dnt": "f3a3",
    	"sym-dock-s": "f3a4",
    	"sym-dock": "f3a5",
    	"sym-dodo-s": "f3a6",
    	"sym-dodo": "f3a7",
    	"sym-doge-s": "f3a8",
    	"sym-doge": "f3a9",
    	"sym-dose-s": "f3aa",
    	"sym-dose": "f3ab",
    	"sym-dot-s": "f3ac",
    	"sym-dot": "f3ad",
    	"sym-dpx-s": "f3ae",
    	"sym-dpx": "f3af",
    	"sym-dpy-s": "f3b0",
    	"sym-dpy": "f3b1",
    	"sym-dream-s": "f3b2",
    	"sym-dream": "f3b3",
    	"sym-drep-s": "f3b4",
    	"sym-drep": "f3b5",
    	"sym-drg-s": "f3b6",
    	"sym-drg": "f3b7",
    	"sym-drgn-s": "f3b8",
    	"sym-drgn": "f3b9",
    	"sym-drt-s": "f3ba",
    	"sym-drt": "f3bb",
    	"sym-dta-s": "f3bc",
    	"sym-dta": "f3bd",
    	"sym-dtb-s": "f3be",
    	"sym-dtb": "f3bf",
    	"sym-dtr-s": "f3c0",
    	"sym-dtr": "f3c1",
    	"sym-dusk-s": "f3c2",
    	"sym-dusk": "f3c3",
    	"sym-dx-s": "f3c4",
    	"sym-dx": "f3c5",
    	"sym-dydx-s": "f3c6",
    	"sym-dydx": "f3c7",
    	"sym-dyn-s": "f3c8",
    	"sym-dyn": "f3c9",
    	"sym-easy": "f3ca",
    	"sym-ecom-s": "f3cb",
    	"sym-ecom": "f3cc",
    	"sym-edc-s": "f3cd",
    	"sym-edc": "f3ce",
    	"sym-edg-s": "f3cf",
    	"sym-edg": "f3d0",
    	"sym-edo-s": "f3d1",
    	"sym-edo": "f3d2",
    	"sym-edp-s": "f3d3",
    	"sym-edp": "f3d4",
    	"sym-edr-s": "f3d5",
    	"sym-edr": "f3d6",
    	"sym-efi-s": "f3d7",
    	"sym-efi": "f3d8",
    	"sym-egld-s": "f3d9",
    	"sym-egld": "f3da",
    	"sym-egt-s": "f3db",
    	"sym-egt": "f3dc",
    	"sym-ehr-s": "f3dd",
    	"sym-ehr": "f3de",
    	"sym-eko-s": "f3df",
    	"sym-eko": "f3e0",
    	"sym-ekt-s": "f3e1",
    	"sym-ekt": "f3e2",
    	"sym-ela-s": "f3e3",
    	"sym-ela": "f3e4",
    	"sym-elec-s": "f3e5",
    	"sym-elec": "f3e6",
    	"sym-elf-s": "f3e7",
    	"sym-elf": "f3e8",
    	"sym-em-s": "f3e9",
    	"sym-em": "f3ea",
    	"sym-emc-s": "f3eb",
    	"sym-emc": "f3ec",
    	"sym-emc2-s": "f3ed",
    	"sym-emc2": "f3ee",
    	"sym-eng-s": "f3ef",
    	"sym-eng": "f3f0",
    	"sym-enj-s": "f3f1",
    	"sym-enj": "f3f2",
    	"sym-ens-s": "f3f3",
    	"sym-ens": "f3f4",
    	"sym-eos-s": "f3f5",
    	"sym-eos": "f3f6",
    	"sym-eosdac-s": "f3f7",
    	"sym-eosdac": "f3f8",
    	"sym-eq-s": "f3f9",
    	"sym-eq": "f3fa",
    	"sym-erd-s": "f3fb",
    	"sym-erd": "f3fc",
    	"sym-ern-s": "f3fd",
    	"sym-ern": "f3fe",
    	"sym-es": "f3ff",
    	"sym-es-s": "f400",
    	"sym-esd-s": "f401",
    	"sym-esd": "f402",
    	"sym-etc-s": "f403",
    	"sym-etc": "f404",
    	"sym-eth-s": "f405",
    	"sym-eth": "f406",
    	"sym-ethup-s": "f407",
    	"sym-ethup": "f408",
    	"sym-etn-s": "f409",
    	"sym-etn": "f40a",
    	"sym-etp-s": "f40b",
    	"sym-etp": "f40c",
    	"sym-eur-s": "f40d",
    	"sym-eur": "f40e",
    	"sym-euroc-s": "f40f",
    	"sym-euroc": "f410",
    	"sym-eurs-s": "f411",
    	"sym-eurs": "f412",
    	"sym-eurt-s": "f413",
    	"sym-eurt": "f414",
    	"sym-evn-s": "f415",
    	"sym-evn": "f416",
    	"sym-evx-s": "f417",
    	"sym-evx": "f418",
    	"sym-ewt-s": "f419",
    	"sym-ewt": "f41a",
    	"sym-exp-s": "f41b",
    	"sym-exp": "f41c",
    	"sym-exrd-s": "f41d",
    	"sym-exrd": "f41e",
    	"sym-exy-s": "f41f",
    	"sym-exy": "f420",
    	"sym-ez-s": "f421",
    	"sym-ez": "f422",
    	"sym-fair-s": "f423",
    	"sym-fair": "f424",
    	"sym-farm-s": "f425",
    	"sym-farm": "f426",
    	"sym-fct-s": "f427",
    	"sym-fct": "f428",
    	"sym-fdz-s": "f429",
    	"sym-fdz": "f42a",
    	"sym-fee-s": "f42b",
    	"sym-fee": "f42c",
    	"sym-fet-s": "f42d",
    	"sym-fet": "f42e",
    	"sym-fida-s": "f42f",
    	"sym-fida": "f430",
    	"sym-fil-s": "f431",
    	"sym-fil": "f432",
    	"sym-fio-s": "f433",
    	"sym-fio": "f434",
    	"sym-firo-s": "f435",
    	"sym-firo": "f436",
    	"sym-fis-s": "f437",
    	"sym-fis": "f438",
    	"sym-fldc-s": "f439",
    	"sym-fldc": "f43a",
    	"sym-flo-s": "f43b",
    	"sym-flo": "f43c",
    	"sym-floki-s": "f43d",
    	"sym-floki": "f43e",
    	"sym-flow-s": "f43f",
    	"sym-flow": "f440",
    	"sym-flr-s": "f441",
    	"sym-flr": "f442",
    	"sym-fluz-s": "f443",
    	"sym-fluz": "f444",
    	"sym-fnb-s": "f445",
    	"sym-fnb": "f446",
    	"sym-foam-s": "f447",
    	"sym-foam": "f448",
    	"sym-for-s": "f449",
    	"sym-for": "f44a",
    	"sym-forth-s": "f44b",
    	"sym-forth": "f44c",
    	"sym-fota-s": "f44d",
    	"sym-fota": "f44e",
    	"sym-fox-s": "f44f",
    	"sym-fox": "f450",
    	"sym-fpis-s": "f451",
    	"sym-fpis": "f452",
    	"sym-frax-s": "f453",
    	"sym-frax": "f454",
    	"sym-front-s": "f455",
    	"sym-front": "f456",
    	"sym-fsn-s": "f457",
    	"sym-fsn": "f458",
    	"sym-ftc-s": "f459",
    	"sym-ftc": "f45a",
    	"sym-fti-s": "f45b",
    	"sym-fti": "f45c",
    	"sym-ftm-s": "f45d",
    	"sym-ftm": "f45e",
    	"sym-ftt-s": "f45f",
    	"sym-ftt": "f460",
    	"sym-ftx-s": "f461",
    	"sym-ftx": "f462",
    	"sym-fuel-s": "f463",
    	"sym-fuel": "f464",
    	"sym-fun-s": "f465",
    	"sym-fun": "f466",
    	"sym-fx-s": "f467",
    	"sym-fx": "f468",
    	"sym-fxc-s": "f469",
    	"sym-fxc": "f46a",
    	"sym-fxs-s": "f46b",
    	"sym-fxs": "f46c",
    	"sym-fxt-s": "f46d",
    	"sym-fxt": "f46e",
    	"sym-gal-s": "f46f",
    	"sym-gal": "f470",
    	"sym-gala-s": "f471",
    	"sym-gala": "f472",
    	"sym-game-s": "f473",
    	"sym-game": "f474",
    	"sym-gamee-s": "f475",
    	"sym-gamee": "f476",
    	"sym-gard-s": "f477",
    	"sym-gard": "f478",
    	"sym-gari-s": "f479",
    	"sym-gari": "f47a",
    	"sym-gas-s": "f47b",
    	"sym-gas": "f47c",
    	"sym-gbc-s": "f47d",
    	"sym-gbc": "f47e",
    	"sym-gbp-s": "f47f",
    	"sym-gbp": "f480",
    	"sym-gbx-s": "f481",
    	"sym-gbx": "f482",
    	"sym-gbyte-s": "f483",
    	"sym-gbyte": "f484",
    	"sym-gc-s": "f485",
    	"sym-gc": "f486",
    	"sym-gcc-s": "f487",
    	"sym-gcc": "f488",
    	"sym-ge-s": "f489",
    	"sym-ge": "f48a",
    	"sym-geist-s": "f48b",
    	"sym-geist": "f48c",
    	"sym-gen-s": "f48d",
    	"sym-gen": "f48e",
    	"sym-gene-s": "f48f",
    	"sym-gene": "f490",
    	"sym-gens-s": "f491",
    	"sym-gens": "f492",
    	"sym-get-s": "f493",
    	"sym-get": "f494",
    	"sym-ghst-s": "f495",
    	"sym-ghst": "f496",
    	"sym-glc-s": "f497",
    	"sym-glc": "f498",
    	"sym-gld-s": "f499",
    	"sym-gld": "f49a",
    	"sym-glm-s": "f49b",
    	"sym-glm": "f49c",
    	"sym-glmr-s": "f49d",
    	"sym-glmr": "f49e",
    	"sym-gmat-s": "f49f",
    	"sym-gmat": "f4a0",
    	"sym-gmt-s": "f4a1",
    	"sym-gmt": "f4a2",
    	"sym-gmt2-s": "f4a3",
    	"sym-gmt2": "f4a4",
    	"sym-gno-s": "f4a5",
    	"sym-gno": "f4a6",
    	"sym-gnt-s": "f4a7",
    	"sym-gnt": "f4a8",
    	"sym-gnx-s": "f4a9",
    	"sym-gnx": "f4aa",
    	"sym-go-s": "f4ab",
    	"sym-go": "f4ac",
    	"sym-gods-s": "f4ad",
    	"sym-gods": "f4ae",
    	"sym-got-s": "f4af",
    	"sym-got": "f4b0",
    	"sym-grc-s": "f4b1",
    	"sym-grc": "f4b2",
    	"sym-grin-s": "f4b3",
    	"sym-grin": "f4b4",
    	"sym-grs-s": "f4b5",
    	"sym-grs": "f4b6",
    	"sym-grt-s": "f4b7",
    	"sym-grt": "f4b8",
    	"sym-gsc-s": "f4b9",
    	"sym-gsc": "f4ba",
    	"sym-gst-s": "f4bb",
    	"sym-gst": "f4bc",
    	"sym-gt-s": "f4bd",
    	"sym-gt": "f4be",
    	"sym-gtc-s": "f4bf",
    	"sym-gtc": "f4c0",
    	"sym-gtc2-s": "f4c1",
    	"sym-gtc2": "f4c2",
    	"sym-gto-s": "f4c3",
    	"sym-gto": "f4c4",
    	"sym-gup-s": "f4c5",
    	"sym-gup": "f4c6",
    	"sym-gusd-s": "f4c7",
    	"sym-gusd": "f4c8",
    	"sym-gvt-s": "f4c9",
    	"sym-gvt": "f4ca",
    	"sym-gxc-s": "f4cb",
    	"sym-gxc": "f4cc",
    	"sym-gxs-s": "f4cd",
    	"sym-gxs": "f4ce",
    	"sym-hard-s": "f4cf",
    	"sym-hard": "f4d0",
    	"sym-hbar-s": "f4d1",
    	"sym-hbar": "f4d2",
    	"sym-hc-s": "f4d3",
    	"sym-hc": "f4d4",
    	"sym-hdx-s": "f4d5",
    	"sym-hdx": "f4d6",
    	"sym-hedg-s": "f4d7",
    	"sym-hedg": "f4d8",
    	"sym-hegic-s": "f4d9",
    	"sym-hegic": "f4da",
    	"sym-hex-s": "f4db",
    	"sym-hex": "f4dc",
    	"sym-hft-s": "f4dd",
    	"sym-hft": "f4de",
    	"sym-hg-s": "f4df",
    	"sym-hg": "f4e0",
    	"sym-hgs-s": "f4e1",
    	"sym-hgs": "f4e2",
    	"sym-hh-s": "f4e3",
    	"sym-hh": "f4e4",
    	"sym-high-s": "f4e5",
    	"sym-high": "f4e6",
    	"sym-hit-s": "f4e7",
    	"sym-hit": "f4e8",
    	"sym-hive-s": "f4e9",
    	"sym-hive": "f4ea",
    	"sym-hkd-s": "f4eb",
    	"sym-hkd": "f4ec",
    	"sym-hko-s": "f4ed",
    	"sym-hko": "f4ee",
    	"sym-hmq-s": "f4ef",
    	"sym-hmq": "f4f0",
    	"sym-hns-s": "f4f1",
    	"sym-hns": "f4f2",
    	"sym-ho-s": "f4f3",
    	"sym-ho": "f4f4",
    	"sym-hopr-s": "f4f5",
    	"sym-hopr": "f4f6",
    	"sym-hot-s": "f4f7",
    	"sym-hot": "f4f8",
    	"sym-hp-s": "f4f9",
    	"sym-hp": "f4fa",
    	"sym-hpb-s": "f4fb",
    	"sym-hpb": "f4fc",
    	"sym-hpc-s": "f4fd",
    	"sym-hpc": "f4fe",
    	"sym-hpt-s": "f4ff",
    	"sym-hpt": "f500",
    	"sym-hrc-s": "f501",
    	"sym-hrc": "f502",
    	"sym-hsc-s": "f503",
    	"sym-hsc": "f504",
    	"sym-hsr-s": "f505",
    	"sym-hsr": "f506",
    	"sym-hst-s": "f507",
    	"sym-hst": "f508",
    	"sym-ht-s": "f509",
    	"sym-ht": "f50a",
    	"sym-html-s": "f50b",
    	"sym-html": "f50c",
    	"sym-htt-s": "f50d",
    	"sym-htt": "f50e",
    	"sym-huc-s": "f50f",
    	"sym-huc": "f510",
    	"sym-hunt-s": "f511",
    	"sym-hunt": "f512",
    	"sym-hvn-s": "f513",
    	"sym-hvn": "f514",
    	"sym-hxro-s": "f515",
    	"sym-hxro": "f516",
    	"sym-hyc-s": "f517",
    	"sym-hyc": "f518",
    	"sym-hydra-s": "f519",
    	"sym-hydra": "f51a",
    	"sym-hydro-s": "f51b",
    	"sym-hydro": "f51c",
    	"sym-icn-s": "f51d",
    	"sym-icn": "f51e",
    	"sym-icos-s": "f51f",
    	"sym-icos": "f520",
    	"sym-icp-s": "f521",
    	"sym-icp": "f522",
    	"sym-icx-s": "f523",
    	"sym-icx": "f524",
    	"sym-idex-s": "f525",
    	"sym-idex": "f526",
    	"sym-idh-s": "f527",
    	"sym-idh": "f528",
    	"sym-idr-s": "f529",
    	"sym-idr": "f52a",
    	"sym-ift-s": "f52b",
    	"sym-ift": "f52c",
    	"sym-ignis-s": "f52d",
    	"sym-ignis": "f52e",
    	"sym-ihf-s": "f52f",
    	"sym-ihf": "f530",
    	"sym-iht-s": "f531",
    	"sym-iht": "f532",
    	"sym-ilc-s": "f533",
    	"sym-ilc": "f534",
    	"sym-ilv-s": "f535",
    	"sym-ilv": "f536",
    	"sym-imx-s": "f537",
    	"sym-imx": "f538",
    	"sym-incnt-s": "f539",
    	"sym-incnt": "f53a",
    	"sym-ind-s": "f53b",
    	"sym-ind": "f53c",
    	"sym-indi-s": "f53d",
    	"sym-indi": "f53e",
    	"sym-inj-s": "f53f",
    	"sym-inj": "f540",
    	"sym-ink-s": "f541",
    	"sym-ink": "f542",
    	"sym-inr-s": "f543",
    	"sym-inr": "f544",
    	"sym-ins-s": "f545",
    	"sym-ins": "f546",
    	"sym-int-s": "f547",
    	"sym-int": "f548",
    	"sym-intr-s": "f549",
    	"sym-intr": "f54a",
    	"sym-ioc-s": "f54b",
    	"sym-ioc": "f54c",
    	"sym-ion-s": "f54d",
    	"sym-ion": "f54e",
    	"sym-iost-s": "f54f",
    	"sym-iost": "f550",
    	"sym-iot-s": "f551",
    	"sym-iot": "f552",
    	"sym-iotx-s": "f553",
    	"sym-iotx": "f554",
    	"sym-iq-s": "f555",
    	"sym-iq": "f556",
    	"sym-iris-s": "f557",
    	"sym-iris": "f558",
    	"sym-itc-s": "f559",
    	"sym-itc": "f55a",
    	"sym-ivy-s": "f55b",
    	"sym-ivy": "f55c",
    	"sym-ixt-s": "f55d",
    	"sym-ixt": "f55e",
    	"sym-jasmy-s": "f55f",
    	"sym-jasmy": "f560",
    	"sym-jnt-s": "f561",
    	"sym-jnt": "f562",
    	"sym-joe-s": "f563",
    	"sym-joe": "f564",
    	"sym-jpeg-s": "f565",
    	"sym-jpeg": "f566",
    	"sym-jpy-s": "f567",
    	"sym-jpy": "f568",
    	"sym-jst-s": "f569",
    	"sym-jst": "f56a",
    	"sym-juno-s": "f56b",
    	"sym-juno": "f56c",
    	"sym-just-s": "f56d",
    	"sym-just": "f56e",
    	"sym-juv-s": "f56f",
    	"sym-juv": "f570",
    	"sym-kan-s": "f571",
    	"sym-kan": "f572",
    	"sym-kapex-s": "f573",
    	"sym-kapex": "f574",
    	"sym-kar-s": "f575",
    	"sym-kar": "f576",
    	"sym-kava-s": "f577",
    	"sym-kava": "f578",
    	"sym-kbc-s": "f579",
    	"sym-kbc": "f57a",
    	"sym-kcash-s": "f57b",
    	"sym-kcash": "f57c",
    	"sym-kda-s": "f57d",
    	"sym-kda": "f57e",
    	"sym-keep-s": "f57f",
    	"sym-keep": "f580",
    	"sym-key-s": "f581",
    	"sym-key": "f582",
    	"sym-kick-s": "f583",
    	"sym-kick": "f584",
    	"sym-kilt-s": "f585",
    	"sym-kilt": "f586",
    	"sym-kin-s": "f587",
    	"sym-kin": "f588",
    	"sym-kint-s": "f589",
    	"sym-kint": "f58a",
    	"sym-klay-s": "f58b",
    	"sym-klay": "f58c",
    	"sym-kma-s": "f58d",
    	"sym-kma": "f58e",
    	"sym-kmd-s": "f58f",
    	"sym-kmd": "f590",
    	"sym-knc-s": "f591",
    	"sym-knc": "f592",
    	"sym-kore-s": "f593",
    	"sym-kore": "f594",
    	"sym-kp3r-s": "f595",
    	"sym-kp3r": "f596",
    	"sym-krm-s": "f597",
    	"sym-krm": "f598",
    	"sym-krw-s": "f599",
    	"sym-krw": "f59a",
    	"sym-ksm-s": "f59b",
    	"sym-ksm": "f59c",
    	"sym-ksx-s": "f59d",
    	"sym-ksx": "f59e",
    	"sym-kyl-s": "f59f",
    	"sym-kyl": "f5a0",
    	"sym-la-s": "f5a1",
    	"sym-la": "f5a2",
    	"sym-lak-s": "f5a3",
    	"sym-lak": "f5a4",
    	"sym-lamb-s": "f5a5",
    	"sym-lamb": "f5a6",
    	"sym-latx-s": "f5a7",
    	"sym-latx": "f5a8",
    	"sym-layr-s": "f5a9",
    	"sym-layr": "f5aa",
    	"sym-lba-s": "f5ab",
    	"sym-lba": "f5ac",
    	"sym-lbc-s": "f5ad",
    	"sym-lbc": "f5ae",
    	"sym-lcc-s": "f5af",
    	"sym-lcc": "f5b0",
    	"sym-lcx-s": "f5b1",
    	"sym-lcx": "f5b2",
    	"sym-ldo-s": "f5b3",
    	"sym-ldo": "f5b4",
    	"sym-lend-s": "f5b5",
    	"sym-lend": "f5b6",
    	"sym-leo-s": "f5b7",
    	"sym-leo": "f5b8",
    	"sym-leoc-s": "f5b9",
    	"sym-leoc": "f5ba",
    	"sym-let-s": "f5bb",
    	"sym-let": "f5bc",
    	"sym-life-s": "f5bd",
    	"sym-life": "f5be",
    	"sym-lina-s": "f5bf",
    	"sym-lina": "f5c0",
    	"sym-link-s": "f5c1",
    	"sym-link": "f5c2",
    	"sym-lit-s": "f5c3",
    	"sym-lit": "f5c4",
    	"sym-lmc-s": "f5c5",
    	"sym-lmc": "f5c6",
    	"sym-lml-s": "f5c7",
    	"sym-lml": "f5c8",
    	"sym-lnc-s": "f5c9",
    	"sym-lnc": "f5ca",
    	"sym-lnd-s": "f5cb",
    	"sym-lnd": "f5cc",
    	"sym-loc-s": "f5cd",
    	"sym-loc": "f5ce",
    	"sym-loka-s": "f5cf",
    	"sym-loka": "f5d0",
    	"sym-looks-s": "f5d1",
    	"sym-looks": "f5d2",
    	"sym-loom-s": "f5d3",
    	"sym-loom": "f5d4",
    	"sym-lpt-s": "f5d5",
    	"sym-lpt": "f5d6",
    	"sym-lqty-s": "f5d7",
    	"sym-lqty": "f5d8",
    	"sym-lrc-s": "f5d9",
    	"sym-lrc": "f5da",
    	"sym-lrn-s": "f5db",
    	"sym-lrn": "f5dc",
    	"sym-lsk-s": "f5dd",
    	"sym-lsk": "f5de",
    	"sym-ltc-s": "f5df",
    	"sym-ltc": "f5e0",
    	"sym-lto-s": "f5e1",
    	"sym-lto": "f5e2",
    	"sym-lun-s": "f5e3",
    	"sym-lun": "f5e4",
    	"sym-luna-s": "f5e5",
    	"sym-luna": "f5e6",
    	"sym-luna2-s": "f5e7",
    	"sym-luna2": "f5e8",
    	"sym-lxt-s": "f5e9",
    	"sym-lxt": "f5ea",
    	"sym-lym-s": "f5eb",
    	"sym-lym": "f5ec",
    	"sym-m2k-s": "f5ed",
    	"sym-m2k": "f5ee",
    	"sym-ma-s": "f5ef",
    	"sym-ma": "f5f0",
    	"sym-magic-s": "f5f1",
    	"sym-magic": "f5f2",
    	"sym-maid-s": "f5f3",
    	"sym-maid": "f5f4",
    	"sym-man-s": "f5f5",
    	"sym-man": "f5f6",
    	"sym-mana-s": "f5f7",
    	"sym-mana": "f5f8",
    	"sym-maps-s": "f5f9",
    	"sym-maps": "f5fa",
    	"sym-mask-s": "f5fb",
    	"sym-mask": "f5fc",
    	"sym-mass-s": "f5fd",
    	"sym-mass": "f5fe",
    	"sym-math-s": "f5ff",
    	"sym-math": "f600",
    	"sym-matic-s": "f601",
    	"sym-matic": "f602",
    	"sym-mbl-s": "f603",
    	"sym-mbl": "f604",
    	"sym-mbt-s": "f605",
    	"sym-mbt": "f606",
    	"sym-mc-s": "f607",
    	"sym-mc": "f608",
    	"sym-mco-s": "f609",
    	"sym-mco": "f60a",
    	"sym-mda-s": "f60b",
    	"sym-mda": "f60c",
    	"sym-mds-s": "f60d",
    	"sym-mds": "f60e",
    	"sym-mdt-s": "f60f",
    	"sym-mdt": "f610",
    	"sym-mdx-s": "f611",
    	"sym-mdx": "f612",
    	"sym-med-s": "f613",
    	"sym-med": "f614",
    	"sym-mer-s": "f615",
    	"sym-mer": "f616",
    	"sym-mes-s": "f617",
    	"sym-mes": "f618",
    	"sym-met-s": "f619",
    	"sym-met": "f61a",
    	"sym-meta-s": "f61b",
    	"sym-meta": "f61c",
    	"sym-metis-s": "f61d",
    	"sym-metis": "f61e",
    	"sym-mft-s": "f61f",
    	"sym-mft": "f620",
    	"sym-mgc-s": "f621",
    	"sym-mgc": "f622",
    	"sym-mgo-s": "f623",
    	"sym-mgo": "f624",
    	"sym-mhc-s": "f625",
    	"sym-mhc": "f626",
    	"sym-mina-s": "f627",
    	"sym-mina": "f628",
    	"sym-mir-s": "f629",
    	"sym-mir": "f62a",
    	"sym-mith-s": "f62b",
    	"sym-mith": "f62c",
    	"sym-mitx-s": "f62d",
    	"sym-mitx": "f62e",
    	"sym-mjp-s": "f62f",
    	"sym-mjp": "f630",
    	"sym-mkr-s": "f631",
    	"sym-mkr": "f632",
    	"sym-mln-s": "f633",
    	"sym-mln": "f634",
    	"sym-mngo-s": "f635",
    	"sym-mngo": "f636",
    	"sym-mnx-s": "f637",
    	"sym-mnx": "f638",
    	"sym-moac-s": "f639",
    	"sym-moac": "f63a",
    	"sym-mob-s": "f63b",
    	"sym-mob": "f63c",
    	"sym-mobi-s": "f63d",
    	"sym-mobi": "f63e",
    	"sym-moc-s": "f63f",
    	"sym-moc": "f640",
    	"sym-mod-s": "f641",
    	"sym-mod": "f642",
    	"sym-mona-s": "f643",
    	"sym-mona": "f644",
    	"sym-moon-s": "f645",
    	"sym-moon": "f646",
    	"sym-morph-s": "f647",
    	"sym-morph": "f648",
    	"sym-movr-s": "f649",
    	"sym-movr": "f64a",
    	"sym-mpl-s": "f64b",
    	"sym-mpl": "f64c",
    	"sym-mrk-s": "f64d",
    	"sym-mrk": "f64e",
    	"sym-msol-s": "f64f",
    	"sym-msol": "f650",
    	"sym-msp-s": "f651",
    	"sym-msp": "f652",
    	"sym-mta-s": "f653",
    	"sym-mta": "f654",
    	"sym-mtc-s": "f655",
    	"sym-mtc": "f656",
    	"sym-mth-s": "f657",
    	"sym-mth": "f658",
    	"sym-mtl-s": "f659",
    	"sym-mtl": "f65a",
    	"sym-mtn-s": "f65b",
    	"sym-mtn": "f65c",
    	"sym-mtx-s": "f65d",
    	"sym-mtx": "f65e",
    	"sym-mue-s": "f65f",
    	"sym-mue": "f660",
    	"sym-multi-s": "f661",
    	"sym-multi": "f662",
    	"sym-mv-s": "f663",
    	"sym-mv": "f664",
    	"sym-mx-s": "f665",
    	"sym-mx": "f666",
    	"sym-mxc-s": "f667",
    	"sym-mxc": "f668",
    	"sym-mxm-s": "f669",
    	"sym-mxm": "f66a",
    	"sym-mxn-s": "f66b",
    	"sym-mxn": "f66c",
    	"sym-myr-s": "f66d",
    	"sym-myr": "f66e",
    	"sym-n9l-s": "f66f",
    	"sym-n9l": "f670",
    	"sym-nanj-s": "f671",
    	"sym-nanj": "f672",
    	"sym-nano-s": "f673",
    	"sym-nano": "f674",
    	"sym-nas-s": "f675",
    	"sym-nas": "f676",
    	"sym-naut-s": "f677",
    	"sym-naut": "f678",
    	"sym-nav-s": "f679",
    	"sym-nav": "f67a",
    	"sym-ncash-s": "f67b",
    	"sym-ncash": "f67c",
    	"sym-nct-s": "f67d",
    	"sym-nct": "f67e",
    	"sym-near-s": "f67f",
    	"sym-near": "f680",
    	"sym-nebl-s": "f681",
    	"sym-nebl": "f682",
    	"sym-nec-s": "f683",
    	"sym-nec": "f684",
    	"sym-neo-s": "f685",
    	"sym-neo": "f686",
    	"sym-neos-s": "f687",
    	"sym-neos": "f688",
    	"sym-nest-s": "f689",
    	"sym-nest": "f68a",
    	"sym-neu-s": "f68b",
    	"sym-neu": "f68c",
    	"sym-new-s": "f68d",
    	"sym-new": "f68e",
    	"sym-nexo-s": "f68f",
    	"sym-nexo": "f690",
    	"sym-nft-s": "f691",
    	"sym-nft": "f692",
    	"sym-ng-s": "f693",
    	"sym-ng": "f694",
    	"sym-ngc-s": "f695",
    	"sym-ngc": "f696",
    	"sym-ngn-s": "f697",
    	"sym-ngn": "f698",
    	"sym-nim-s": "f699",
    	"sym-nim": "f69a",
    	"sym-niy-s": "f69b",
    	"sym-niy": "f69c",
    	"sym-nkd-s": "f69d",
    	"sym-nkd": "f69e",
    	"sym-nkn-s": "f69f",
    	"sym-nkn": "f6a0",
    	"sym-nlc2-s": "f6a1",
    	"sym-nlc2": "f6a2",
    	"sym-nlg-s": "f6a3",
    	"sym-nlg": "f6a4",
    	"sym-nmc-s": "f6a5",
    	"sym-nmc": "f6a6",
    	"sym-nmr-s": "f6a7",
    	"sym-nmr": "f6a8",
    	"sym-nn-s": "f6a9",
    	"sym-nn": "f6aa",
    	"sym-noah-s": "f6ab",
    	"sym-noah": "f6ac",
    	"sym-nodl-s": "f6ad",
    	"sym-nodl": "f6ae",
    	"sym-note-s": "f6af",
    	"sym-note": "f6b0",
    	"sym-npg-s": "f6b1",
    	"sym-npg": "f6b2",
    	"sym-nplc-s": "f6b3",
    	"sym-nplc": "f6b4",
    	"sym-npxs-s": "f6b5",
    	"sym-npxs": "f6b6",
    	"sym-nq-s": "f6b7",
    	"sym-nq": "f6b8",
    	"sym-nrg-s": "f6b9",
    	"sym-nrg": "f6ba",
    	"sym-ntk-s": "f6bb",
    	"sym-ntk": "f6bc",
    	"sym-nu-s": "f6bd",
    	"sym-nu": "f6be",
    	"sym-nuls-s": "f6bf",
    	"sym-nuls": "f6c0",
    	"sym-nvc-s": "f6c1",
    	"sym-nvc": "f6c2",
    	"sym-nxc-s": "f6c3",
    	"sym-nxc": "f6c4",
    	"sym-nxs-s": "f6c5",
    	"sym-nxs": "f6c6",
    	"sym-nxt-s": "f6c7",
    	"sym-nxt": "f6c8",
    	"sym-nym-s": "f6c9",
    	"sym-nym": "f6ca",
    	"sym-o-s": "f6cb",
    	"sym-o": "f6cc",
    	"sym-oax-s": "f6cd",
    	"sym-oax": "f6ce",
    	"sym-ocean-s": "f6cf",
    	"sym-ocean": "f6d0",
    	"sym-ocn-s": "f6d1",
    	"sym-ocn": "f6d2",
    	"sym-ode-s": "f6d3",
    	"sym-ode": "f6d4",
    	"sym-ogn-s": "f6d5",
    	"sym-ogn": "f6d6",
    	"sym-ogo-s": "f6d7",
    	"sym-ogo": "f6d8",
    	"sym-ok-s": "f6d9",
    	"sym-ok": "f6da",
    	"sym-okb-s": "f6db",
    	"sym-okb": "f6dc",
    	"sym-om-s": "f6dd",
    	"sym-om": "f6de",
    	"sym-omg-s": "f6df",
    	"sym-omg": "f6e0",
    	"sym-omni-s": "f6e1",
    	"sym-omni": "f6e2",
    	"sym-one-s": "f6e3",
    	"sym-one": "f6e4",
    	"sym-ong-s": "f6e5",
    	"sym-ong": "f6e6",
    	"sym-onot-s": "f6e7",
    	"sym-onot": "f6e8",
    	"sym-ont-s": "f6e9",
    	"sym-ont": "f6ea",
    	"sym-ooki-s": "f6eb",
    	"sym-ooki": "f6ec",
    	"sym-orbs-s": "f6ed",
    	"sym-orbs": "f6ee",
    	"sym-orca-s": "f6ef",
    	"sym-orca": "f6f0",
    	"sym-orme-s": "f6f1",
    	"sym-orme": "f6f2",
    	"sym-orn-s": "f6f3",
    	"sym-orn": "f6f4",
    	"sym-ors-s": "f6f5",
    	"sym-ors": "f6f6",
    	"sym-osmo-s": "f6f7",
    	"sym-osmo": "f6f8",
    	"sym-ost-s": "f6f9",
    	"sym-ost": "f6fa",
    	"sym-otn-s": "f6fb",
    	"sym-otn": "f6fc",
    	"sym-oxt-s": "f6fd",
    	"sym-oxt": "f6fe",
    	"sym-oxy-s": "f6ff",
    	"sym-oxy": "f700",
    	"sym-pai-s": "f701",
    	"sym-pai": "f702",
    	"sym-pal-s": "f703",
    	"sym-pal": "f704",
    	"sym-paper-s": "f705",
    	"sym-paper": "f706",
    	"sym-para-s": "f707",
    	"sym-para": "f708",
    	"sym-part-s": "f709",
    	"sym-part": "f70a",
    	"sym-pasc-s": "f70b",
    	"sym-pasc": "f70c",
    	"sym-pat-s": "f70d",
    	"sym-pat": "f70e",
    	"sym-pax-s": "f70f",
    	"sym-pax": "f710",
    	"sym-paxg-s": "f711",
    	"sym-paxg": "f712",
    	"sym-pay-s": "f713",
    	"sym-pay": "f714",
    	"sym-pbt-s": "f715",
    	"sym-pbt": "f716",
    	"sym-pcl-s": "f717",
    	"sym-pcl": "f718",
    	"sym-pcx-s": "f719",
    	"sym-pcx": "f71a",
    	"sym-pdex-s": "f71b",
    	"sym-pdex": "f71c",
    	"sym-people-s": "f71d",
    	"sym-people": "f71e",
    	"sym-perl-s": "f71f",
    	"sym-perl": "f720",
    	"sym-perp-s": "f721",
    	"sym-perp": "f722",
    	"sym-pha-s": "f723",
    	"sym-pha": "f724",
    	"sym-phb-s": "f725",
    	"sym-phb": "f726",
    	"sym-php-s": "f727",
    	"sym-php": "f728",
    	"sym-phx-s": "f729",
    	"sym-phx": "f72a",
    	"sym-pi-s": "f72b",
    	"sym-pi": "f72c",
    	"sym-pica-s": "f72d",
    	"sym-pica": "f72e",
    	"sym-pink-s": "f72f",
    	"sym-pink": "f730",
    	"sym-pivx-s": "f731",
    	"sym-pivx": "f732",
    	"sym-pkt-s": "f733",
    	"sym-pkt": "f734",
    	"sym-pl-s": "f735",
    	"sym-pl": "f736",
    	"sym-pla-s": "f737",
    	"sym-pla": "f738",
    	"sym-plbt-s": "f739",
    	"sym-plbt": "f73a",
    	"sym-plm-s": "f73b",
    	"sym-plm": "f73c",
    	"sym-pln-s": "f73d",
    	"sym-pln": "f73e",
    	"sym-plr-s": "f73f",
    	"sym-plr": "f740",
    	"sym-ply-s": "f741",
    	"sym-ply": "f742",
    	"sym-pma-s": "f743",
    	"sym-pma": "f744",
    	"sym-png-s": "f745",
    	"sym-png": "f746",
    	"sym-pnt-s": "f747",
    	"sym-pnt": "f748",
    	"sym-poa-s": "f749",
    	"sym-poa": "f74a",
    	"sym-poe-s": "f74b",
    	"sym-poe": "f74c",
    	"sym-polis-s": "f74d",
    	"sym-polis": "f74e",
    	"sym-pols-s": "f74f",
    	"sym-pols": "f750",
    	"sym-poly-s": "f751",
    	"sym-poly": "f752",
    	"sym-pond-s": "f753",
    	"sym-pond": "f754",
    	"sym-pot-s": "f755",
    	"sym-pot": "f756",
    	"sym-powr-s": "f757",
    	"sym-powr": "f758",
    	"sym-ppc-s": "f759",
    	"sym-ppc": "f75a",
    	"sym-ppt-s": "f75b",
    	"sym-ppt": "f75c",
    	"sym-pra-s": "f75d",
    	"sym-pra": "f75e",
    	"sym-pre-s": "f75f",
    	"sym-pre": "f760",
    	"sym-prg-s": "f761",
    	"sym-prg": "f762",
    	"sym-pro-s": "f763",
    	"sym-pro": "f764",
    	"sym-prq-s": "f765",
    	"sym-prq": "f766",
    	"sym-pst-s": "f767",
    	"sym-pst": "f768",
    	"sym-pstake-s": "f769",
    	"sym-pstake": "f76a",
    	"sym-pton-s": "f76b",
    	"sym-pton": "f76c",
    	"sym-pundix-s": "f76d",
    	"sym-pundix": "f76e",
    	"sym-pvt-s": "f76f",
    	"sym-pvt": "f770",
    	"sym-pxg-s": "f771",
    	"sym-pxg": "f772",
    	"sym-pyr-s": "f773",
    	"sym-pyr": "f774",
    	"sym-qash-s": "f775",
    	"sym-qash": "f776",
    	"sym-qau-s": "f777",
    	"sym-qau": "f778",
    	"sym-qc-s": "f779",
    	"sym-qc": "f77a",
    	"sym-qi-s": "f77b",
    	"sym-qi": "f77c",
    	"sym-qi2-s": "f77d",
    	"sym-qi2": "f77e",
    	"sym-qkc-s": "f77f",
    	"sym-qkc": "f780",
    	"sym-qlc-s": "f781",
    	"sym-qlc": "f782",
    	"sym-qnt-s": "f783",
    	"sym-qnt": "f784",
    	"sym-qntu-s": "f785",
    	"sym-qntu": "f786",
    	"sym-qo-s": "f787",
    	"sym-qo": "f788",
    	"sym-qrdo-s": "f789",
    	"sym-qrdo": "f78a",
    	"sym-qrl-s": "f78b",
    	"sym-qrl": "f78c",
    	"sym-qsp-s": "f78d",
    	"sym-qsp": "f78e",
    	"sym-qtum-s": "f78f",
    	"sym-qtum": "f790",
    	"sym-quick-s": "f791",
    	"sym-quick": "f792",
    	"sym-qun-s": "f793",
    	"sym-qun": "f794",
    	"sym-r-s": "f795",
    	"sym-r": "f796",
    	"sym-rad-s": "f797",
    	"sym-rad": "f798",
    	"sym-radar-s": "f799",
    	"sym-radar": "f79a",
    	"sym-rads-s": "f79b",
    	"sym-rads": "f79c",
    	"sym-ramp-s": "f79d",
    	"sym-ramp": "f79e",
    	"sym-rare-s": "f79f",
    	"sym-rare": "f7a0",
    	"sym-rari-s": "f7a1",
    	"sym-rari": "f7a2",
    	"sym-rating-s": "f7a3",
    	"sym-rating": "f7a4",
    	"sym-ray-s": "f7a5",
    	"sym-ray": "f7a6",
    	"sym-rb-s": "f7a7",
    	"sym-rb": "f7a8",
    	"sym-rbc-s": "f7a9",
    	"sym-rbc": "f7aa",
    	"sym-rblx-s": "f7ab",
    	"sym-rblx": "f7ac",
    	"sym-rbn-s": "f7ad",
    	"sym-rbn": "f7ae",
    	"sym-rbtc-s": "f7af",
    	"sym-rbtc": "f7b0",
    	"sym-rby-s": "f7b1",
    	"sym-rby": "f7b2",
    	"sym-rcn-s": "f7b3",
    	"sym-rcn": "f7b4",
    	"sym-rdd-s": "f7b5",
    	"sym-rdd": "f7b6",
    	"sym-rdn-s": "f7b7",
    	"sym-rdn": "f7b8",
    	"sym-real-s": "f7b9",
    	"sym-real": "f7ba",
    	"sym-reef-s": "f7bb",
    	"sym-reef": "f7bc",
    	"sym-rem-s": "f7bd",
    	"sym-rem": "f7be",
    	"sym-ren-s": "f7bf",
    	"sym-ren": "f7c0",
    	"sym-rep-s": "f7c1",
    	"sym-rep": "f7c2",
    	"sym-repv2-s": "f7c3",
    	"sym-repv2": "f7c4",
    	"sym-req-s": "f7c5",
    	"sym-req": "f7c6",
    	"sym-rev-s": "f7c7",
    	"sym-rev": "f7c8",
    	"sym-revv-s": "f7c9",
    	"sym-revv": "f7ca",
    	"sym-rfox-s": "f7cb",
    	"sym-rfox": "f7cc",
    	"sym-rfr-s": "f7cd",
    	"sym-rfr": "f7ce",
    	"sym-ric-s": "f7cf",
    	"sym-ric": "f7d0",
    	"sym-rif-s": "f7d1",
    	"sym-rif": "f7d2",
    	"sym-ring-s": "f7d3",
    	"sym-ring": "f7d4",
    	"sym-rlc-s": "f7d5",
    	"sym-rlc": "f7d6",
    	"sym-rly-s": "f7d7",
    	"sym-rly": "f7d8",
    	"sym-rmrk-s": "f7d9",
    	"sym-rmrk": "f7da",
    	"sym-rndr-s": "f7db",
    	"sym-rndr": "f7dc",
    	"sym-rntb-s": "f7dd",
    	"sym-rntb": "f7de",
    	"sym-ron-s": "f7df",
    	"sym-ron": "f7e0",
    	"sym-rook-s": "f7e1",
    	"sym-rook": "f7e2",
    	"sym-rose-s": "f7e3",
    	"sym-rose": "f7e4",
    	"sym-rox-s": "f7e5",
    	"sym-rox": "f7e6",
    	"sym-rp-s": "f7e7",
    	"sym-rp": "f7e8",
    	"sym-rpl-s": "f7e9",
    	"sym-rpl": "f7ea",
    	"sym-rpx-s": "f7eb",
    	"sym-rpx": "f7ec",
    	"sym-rsr-s": "f7ed",
    	"sym-rsr": "f7ee",
    	"sym-rsv-s": "f7ef",
    	"sym-rsv": "f7f0",
    	"sym-rty-s": "f7f1",
    	"sym-rty": "f7f2",
    	"sym-rub-s": "f7f3",
    	"sym-rub": "f7f4",
    	"sym-ruff-s": "f7f5",
    	"sym-ruff": "f7f6",
    	"sym-rune-s": "f7f7",
    	"sym-rune": "f7f8",
    	"sym-rvn-s": "f7f9",
    	"sym-rvn": "f7fa",
    	"sym-rvr-s": "f7fb",
    	"sym-rvr": "f7fc",
    	"sym-rvt-s": "f7fd",
    	"sym-rvt": "f7fe",
    	"sym-sai-s": "f7ff",
    	"sym-sai": "f800",
    	"sym-salt-s": "f801",
    	"sym-salt": "f802",
    	"sym-samo-s": "f803",
    	"sym-samo": "f804",
    	"sym-san-s": "f805",
    	"sym-san": "f806",
    	"sym-sand-s": "f807",
    	"sym-sand": "f808",
    	"sym-sats-s": "f809",
    	"sym-sats": "f80a",
    	"sym-sbd-s": "f80b",
    	"sym-sbd": "f80c",
    	"sym-sbr-s": "f80d",
    	"sym-sbr": "f80e",
    	"sym-sc-s": "f80f",
    	"sym-sc": "f810",
    	"sym-scc-s": "f811",
    	"sym-scc": "f812",
    	"sym-scrt-s": "f813",
    	"sym-scrt": "f814",
    	"sym-sdc-s": "f815",
    	"sym-sdc": "f816",
    	"sym-sdn-s": "f817",
    	"sym-sdn": "f818",
    	"sym-seele-s": "f819",
    	"sym-seele": "f81a",
    	"sym-sek-s": "f81b",
    	"sym-sek": "f81c",
    	"sym-sen-s": "f81d",
    	"sym-sen": "f81e",
    	"sym-sent-s": "f81f",
    	"sym-sent": "f820",
    	"sym-sero-s": "f821",
    	"sym-sero": "f822",
    	"sym-sexc-s": "f823",
    	"sym-sexc": "f824",
    	"sym-sfp-s": "f825",
    	"sym-sfp": "f826",
    	"sym-sgb-s": "f827",
    	"sym-sgb": "f828",
    	"sym-sgc-s": "f829",
    	"sym-sgc": "f82a",
    	"sym-sgd-s": "f82b",
    	"sym-sgd": "f82c",
    	"sym-sgn-s": "f82d",
    	"sym-sgn": "f82e",
    	"sym-sgu-s": "f82f",
    	"sym-sgu": "f830",
    	"sym-shib-s": "f831",
    	"sym-shib": "f832",
    	"sym-shift-s": "f833",
    	"sym-shift": "f834",
    	"sym-ship-s": "f835",
    	"sym-ship": "f836",
    	"sym-shping-s": "f837",
    	"sym-shping": "f838",
    	"sym-si-s": "f839",
    	"sym-si": "f83a",
    	"sym-sib-s": "f83b",
    	"sym-sib": "f83c",
    	"sym-sil-s": "f83d",
    	"sym-sil": "f83e",
    	"sym-six-s": "f83f",
    	"sym-six": "f840",
    	"sym-sjcx-s": "f841",
    	"sym-sjcx": "f842",
    	"sym-skl-s": "f843",
    	"sym-skl": "f844",
    	"sym-skm-s": "f845",
    	"sym-skm": "f846",
    	"sym-sku-s": "f847",
    	"sym-sku": "f848",
    	"sym-sky-s": "f849",
    	"sym-sky": "f84a",
    	"sym-slp-s": "f84b",
    	"sym-slp": "f84c",
    	"sym-slr-s": "f84d",
    	"sym-slr": "f84e",
    	"sym-sls-s": "f84f",
    	"sym-sls": "f850",
    	"sym-slt-s": "f851",
    	"sym-slt": "f852",
    	"sym-slv-s": "f853",
    	"sym-slv": "f854",
    	"sym-smart-s": "f855",
    	"sym-smart": "f856",
    	"sym-smn-s": "f857",
    	"sym-smn": "f858",
    	"sym-smt-s": "f859",
    	"sym-smt": "f85a",
    	"sym-snc-s": "f85b",
    	"sym-snc": "f85c",
    	"sym-snet-s": "f85d",
    	"sym-snet": "f85e",
    	"sym-sngls-s": "f85f",
    	"sym-sngls": "f860",
    	"sym-snm-s": "f861",
    	"sym-snm": "f862",
    	"sym-snt-s": "f863",
    	"sym-snt": "f864",
    	"sym-snx-s": "f865",
    	"sym-snx": "f866",
    	"sym-soc-s": "f867",
    	"sym-soc": "f868",
    	"sym-socks-s": "f869",
    	"sym-socks": "f86a",
    	"sym-sol-s": "f86b",
    	"sym-sol": "f86c",
    	"sym-solid-s": "f86d",
    	"sym-solid": "f86e",
    	"sym-solo-s": "f86f",
    	"sym-solo": "f870",
    	"sym-solve-s": "f871",
    	"sym-solve": "f872",
    	"sym-sos-s": "f873",
    	"sym-sos": "f874",
    	"sym-soul-s": "f875",
    	"sym-soul": "f876",
    	"sym-sp-s": "f877",
    	"sym-sp": "f878",
    	"sym-sparta-s": "f879",
    	"sym-sparta": "f87a",
    	"sym-spc-s": "f87b",
    	"sym-spc": "f87c",
    	"sym-spd-s": "f87d",
    	"sym-spd": "f87e",
    	"sym-spell-s": "f87f",
    	"sym-spell": "f880",
    	"sym-sphr-s": "f881",
    	"sym-sphr": "f882",
    	"sym-sphtx-s": "f883",
    	"sym-sphtx": "f884",
    	"sym-spnd-s": "f885",
    	"sym-spnd": "f886",
    	"sym-spnk-s": "f887",
    	"sym-spnk": "f888",
    	"sym-srm-s": "f889",
    	"sym-srm": "f88a",
    	"sym-srn-s": "f88b",
    	"sym-srn": "f88c",
    	"sym-ssp-s": "f88d",
    	"sym-ssp": "f88e",
    	"sym-stacs-s": "f88f",
    	"sym-stacs": "f890",
    	"sym-step-s": "f891",
    	"sym-step": "f892",
    	"sym-stg-s": "f893",
    	"sym-stg": "f894",
    	"sym-stmx-s": "f895",
    	"sym-stmx": "f896",
    	"sym-storm-s": "f897",
    	"sym-storm": "f898",
    	"sym-stpt-s": "f899",
    	"sym-stpt": "f89a",
    	"sym-stq-s": "f89b",
    	"sym-stq": "f89c",
    	"sym-str-s": "f89d",
    	"sym-str": "f89e",
    	"sym-strat-s": "f89f",
    	"sym-strat": "f8a0",
    	"sym-strax-s": "f8a1",
    	"sym-strax": "f8a2",
    	"sym-strk-s": "f8a3",
    	"sym-strk": "f8a4",
    	"sym-strong-s": "f8a5",
    	"sym-strong": "f8a6",
    	"sym-stx-s": "f8a7",
    	"sym-stx": "f8a8",
    	"sym-sub-s": "f8a9",
    	"sym-sub": "f8aa",
    	"sym-sun-s": "f8ab",
    	"sym-sun": "f8ac",
    	"sym-super-s": "f8ad",
    	"sym-super": "f8ae",
    	"sym-susd-s": "f8af",
    	"sym-susd": "f8b0",
    	"sym-sushi-s": "f8b1",
    	"sym-sushi": "f8b2",
    	"sym-swftc-s": "f8b3",
    	"sym-swftc": "f8b4",
    	"sym-swm-s": "f8b5",
    	"sym-swm": "f8b6",
    	"sym-swrv-s": "f8b7",
    	"sym-swrv": "f8b8",
    	"sym-swt-s": "f8b9",
    	"sym-swt": "f8ba",
    	"sym-swth-s": "f8bb",
    	"sym-swth": "f8bc",
    	"sym-sxp-s": "f8bd",
    	"sym-sxp": "f8be",
    	"sym-syn-s": "f8bf",
    	"sym-syn": "f8c0",
    	"sym-sys-s": "f8c1",
    	"sym-sys": "f8c2",
    	"sym-t-s": "f8c3",
    	"sym-t": "f8c4",
    	"sym-taas-s": "f8c5",
    	"sym-taas": "f8c6",
    	"sym-tau-s": "f8c7",
    	"sym-tau": "f8c8",
    	"sym-tbtc-s": "f8c9",
    	"sym-tbtc": "f8ca",
    	"sym-tct-s": "f8cb",
    	"sym-tct": "f8cc",
    	"sym-teer-s": "f8cd",
    	"sym-teer": "f8ce",
    	"sym-tel-s": "f8cf",
    	"sym-temco-s": "f8d0",
    	"sym-temco": "f8d1",
    	"sym-tfuel-s": "f8d2",
    	"sym-tfuel": "f8d3",
    	"sym-thb-s": "f8d4",
    	"sym-thb": "f8d5",
    	"sym-thc-s": "f8d6",
    	"sym-thc": "f8d7",
    	"sym-theta-s": "f8d8",
    	"sym-theta": "f8d9",
    	"sym-thx-s": "f8da",
    	"sym-thx": "f8db",
    	"sym-time-s": "f8dc",
    	"sym-time": "f8dd",
    	"sym-tio-s": "f8de",
    	"sym-tio": "f8df",
    	"sym-tix-s": "f8e0",
    	"sym-tix": "f8e1",
    	"sym-tkn-s": "f8e2",
    	"sym-tkn": "f8e3",
    	"sym-tky-s": "f8e4",
    	"sym-tky": "f8e5",
    	"sym-tlm-s": "f8e6",
    	"sym-tlm": "f8e7",
    	"sym-tnb-s": "f8e8",
    	"sym-tnb": "f8e9",
    	"sym-tnc-s": "f8ea",
    	"sym-tnc": "f8eb",
    	"sym-tnt-s": "f8ec",
    	"sym-tnt": "f8ed",
    	"sym-toke-s": "f8ee",
    	"sym-toke": "f8ef",
    	"sym-tomb-s": "f8f0",
    	"sym-tomb": "f8f1",
    	"sym-tomo-s": "f8f2",
    	"sym-tomo": "f8f3",
    	"sym-top-s": "f8f4",
    	"sym-top": "f8f5",
    	"sym-torn-s": "f8f6",
    	"sym-torn": "f8f7",
    	"sym-tower-s": "f8f8",
    	"sym-tower": "f8f9",
    	"sym-tpay-s": "f8fa",
    	"sym-tpay": "f8fb",
    	"sym-trac-s": "f8fc",
    	"sym-trac": "f8fd",
    	"sym-trb-s": "f8fe",
    	"sym-trb": "f8ff",
    	"sym-tribe-s": "f900",
    	"sym-tribe": "f901",
    	"sym-trig-s": "f902",
    	"sym-trig": "f903",
    	"sym-trio-s": "f904",
    	"sym-trio": "f905",
    	"sym-troy-s": "f906",
    	"sym-troy": "f907",
    	"sym-trst-s": "f908",
    	"sym-trst": "f909",
    	"sym-tru-s": "f90a",
    	"sym-tru": "f90b",
    	"sym-true-s": "f90c",
    	"sym-true": "f90d",
    	"sym-trx-s": "f90e",
    	"sym-trx": "f90f",
    	"sym-try-s": "f910",
    	"sym-try": "f911",
    	"sym-tryb-s": "f912",
    	"sym-tryb": "f913",
    	"sym-tt-s": "f914",
    	"sym-tt": "f915",
    	"sym-ttc-s": "f916",
    	"sym-ttc": "f917",
    	"sym-ttt-s": "f918",
    	"sym-ttt": "f919",
    	"sym-ttu-s": "f91a",
    	"sym-ttu": "f91b",
    	"sym-tube-s": "f91c",
    	"sym-tube": "f91d",
    	"sym-tusd-s": "f91e",
    	"sym-tusd": "f91f",
    	"sym-tvk-s": "f920",
    	"sym-tvk": "f921",
    	"sym-twt-s": "f922",
    	"sym-twt": "f923",
    	"sym-uah-s": "f924",
    	"sym-uah": "f925",
    	"sym-ubq-s": "f926",
    	"sym-ubq": "f927",
    	"sym-ubt-s": "f928",
    	"sym-ubt": "f929",
    	"sym-uft-s": "f92a",
    	"sym-uft": "f92b",
    	"sym-ugas-s": "f92c",
    	"sym-ugas": "f92d",
    	"sym-uip-s": "f92e",
    	"sym-uip": "f92f",
    	"sym-ukg-s": "f930",
    	"sym-ukg": "f931",
    	"sym-uma-s": "f932",
    	"sym-uma": "f933",
    	"sym-unfi-s": "f934",
    	"sym-unfi": "f935",
    	"sym-uni-s": "f936",
    	"sym-uni": "f937",
    	"sym-unq-s": "f938",
    	"sym-unq": "f939",
    	"sym-up-s": "f93a",
    	"sym-up": "f93b",
    	"sym-upp-s": "f93c",
    	"sym-upp": "f93d",
    	"sym-usd-s": "f93e",
    	"sym-usd": "f93f",
    	"sym-usdc-s": "f940",
    	"sym-usdc": "f941",
    	"sym-usds-s": "f942",
    	"sym-usds": "f943",
    	"sym-usk-s": "f944",
    	"sym-usk": "f945",
    	"sym-ust-s": "f946",
    	"sym-ust": "f947",
    	"sym-utk-s": "f948",
    	"sym-utk": "f949",
    	"sym-utnp-s": "f94a",
    	"sym-utnp": "f94b",
    	"sym-utt-s": "f94c",
    	"sym-utt": "f94d",
    	"sym-uuu-s": "f94e",
    	"sym-uuu": "f94f",
    	"sym-ux-s": "f950",
    	"sym-ux": "f951",
    	"sym-vader-s": "f952",
    	"sym-vader": "f953",
    	"sym-vai-s": "f954",
    	"sym-vai": "f955",
    	"sym-vbk-s": "f956",
    	"sym-vbk": "f957",
    	"sym-vdx-s": "f958",
    	"sym-vdx": "f959",
    	"sym-vee-s": "f95a",
    	"sym-vee": "f95b",
    	"sym-vemp-s": "f95c",
    	"sym-vemp": "f95d",
    	"sym-ven-s": "f95e",
    	"sym-ven": "f95f",
    	"sym-veo-s": "f960",
    	"sym-veo": "f961",
    	"sym-veri-s": "f962",
    	"sym-veri": "f963",
    	"sym-vex-s": "f964",
    	"sym-vex": "f965",
    	"sym-vgx-s": "f966",
    	"sym-vgx": "f967",
    	"sym-via-s": "f968",
    	"sym-via": "f969",
    	"sym-vib-s": "f96a",
    	"sym-vib": "f96b",
    	"sym-vibe-s": "f96c",
    	"sym-vibe": "f96d",
    	"sym-vid-s": "f96e",
    	"sym-vid": "f96f",
    	"sym-vidt-s": "f970",
    	"sym-vidt": "f971",
    	"sym-vidy-s": "f972",
    	"sym-vidy": "f973",
    	"sym-vitae-s": "f974",
    	"sym-vitae": "f975",
    	"sym-vite-s": "f976",
    	"sym-vite": "f977",
    	"sym-vlx-s": "f978",
    	"sym-vlx": "f979",
    	"sym-vox-s": "f97a",
    	"sym-vox": "f97b",
    	"sym-voxel-s": "f97c",
    	"sym-voxel": "f97d",
    	"sym-vra-s": "f97e",
    	"sym-vra": "f97f",
    	"sym-vrc-s": "f980",
    	"sym-vrc": "f981",
    	"sym-vrm-s": "f982",
    	"sym-vrm": "f983",
    	"sym-vsys-s": "f984",
    	"sym-vsys": "f985",
    	"sym-vtc-s": "f986",
    	"sym-vtc": "f987",
    	"sym-vtho-s": "f988",
    	"sym-vtho": "f989",
    	"sym-wabi-s": "f98a",
    	"sym-wabi": "f98b",
    	"sym-wan-s": "f98c",
    	"sym-wan": "f98d",
    	"sym-waves-s": "f98e",
    	"sym-waves": "f98f",
    	"sym-wax-s": "f990",
    	"sym-wax": "f991",
    	"sym-wbtc-s": "f992",
    	"sym-wbtc": "f993",
    	"sym-wet-s": "f994",
    	"sym-wet": "f995",
    	"sym-weth-s": "f996",
    	"sym-weth": "f997",
    	"sym-wib-s": "f998",
    	"sym-wib": "f999",
    	"sym-wicc-s": "f99a",
    	"sym-wicc": "f99b",
    	"sym-win-s": "f99c",
    	"sym-win": "f99d",
    	"sym-wing-s": "f99e",
    	"sym-wing": "f99f",
    	"sym-wings-s": "f9a0",
    	"sym-wings": "f9a1",
    	"sym-wnxm-s": "f9a2",
    	"sym-wnxm": "f9a3",
    	"sym-woo-s": "f9a4",
    	"sym-woo": "f9a5",
    	"sym-wpr-s": "f9a6",
    	"sym-wpr": "f9a7",
    	"sym-wrx-s": "f9a8",
    	"sym-wrx": "f9a9",
    	"sym-wtc-s": "f9aa",
    	"sym-wtc": "f9ab",
    	"sym-wtt-s": "f9ac",
    	"sym-wtt": "f9ad",
    	"sym-wwb-s": "f9ae",
    	"sym-wwb": "f9af",
    	"sym-wxt-s": "f9b0",
    	"sym-wxt": "f9b1",
    	"sym-xas-s": "f9b2",
    	"sym-xas": "f9b3",
    	"sym-xaur-s": "f9b4",
    	"sym-xaur": "f9b5",
    	"sym-xaut-s": "f9b6",
    	"sym-xaut": "f9b7",
    	"sym-xava-s": "f9b8",
    	"sym-xava": "f9b9",
    	"sym-xbc-s": "f9ba",
    	"sym-xbc": "f9bb",
    	"sym-xcn-s": "f9bc",
    	"sym-xcn": "f9bd",
    	"sym-xcon-s": "f9be",
    	"sym-xcon": "f9bf",
    	"sym-xcp-s": "f9c0",
    	"sym-xcp": "f9c1",
    	"sym-xdefi-s": "f9c2",
    	"sym-xdefi": "f9c3",
    	"sym-xdn-s": "f9c4",
    	"sym-xdn": "f9c5",
    	"sym-xel-s": "f9c6",
    	"sym-xel": "f9c7",
    	"sym-xem-s": "f9c8",
    	"sym-xem": "f9c9",
    	"sym-xes-s": "f9ca",
    	"sym-xes": "f9cb",
    	"sym-xhv-s": "f9cc",
    	"sym-xhv": "f9cd",
    	"sym-xin-s": "f9ce",
    	"sym-xin": "f9cf",
    	"sym-xlm-s": "f9d0",
    	"sym-xlm": "f9d1",
    	"sym-xmc-s": "f9d2",
    	"sym-xmc": "f9d3",
    	"sym-xmr-s": "f9d4",
    	"sym-xmr": "f9d5",
    	"sym-xmx-s": "f9d6",
    	"sym-xmx": "f9d7",
    	"sym-xmy-s": "f9d8",
    	"sym-xmy": "f9d9",
    	"sym-xnk-s": "f9da",
    	"sym-xnk": "f9db",
    	"sym-xns-s": "f9dc",
    	"sym-xns": "f9dd",
    	"sym-xor-s": "f9de",
    	"sym-xor": "f9df",
    	"sym-xos-s": "f9e0",
    	"sym-xos": "f9e1",
    	"sym-xpm-s": "f9e2",
    	"sym-xpm": "f9e3",
    	"sym-xpr-s": "f9e4",
    	"sym-xpr": "f9e5",
    	"sym-xrc-s": "f9e6",
    	"sym-xrc": "f9e7",
    	"sym-xrp-s": "f9e8",
    	"sym-xrp": "f9e9",
    	"sym-xrpx-s": "f9ea",
    	"sym-xrpx": "f9eb",
    	"sym-xrt-s": "f9ec",
    	"sym-xrt": "f9ed",
    	"sym-xst-s": "f9ee",
    	"sym-xst": "f9ef",
    	"sym-xtp-s": "f9f0",
    	"sym-xtp": "f9f1",
    	"sym-xtz-s": "f9f2",
    	"sym-xtz": "f9f3",
    	"sym-xtzdown-s": "f9f4",
    	"sym-xtzdown": "f9f5",
    	"sym-xvc-s": "f9f6",
    	"sym-xvc": "f9f7",
    	"sym-xvg-s": "f9f8",
    	"sym-xvg": "f9f9",
    	"sym-xvs-s": "f9fa",
    	"sym-xvs": "f9fb",
    	"sym-xwc-s": "f9fc",
    	"sym-xwc": "f9fd",
    	"sym-xyo-s": "f9fe",
    	"sym-xyo": "f9ff",
    	"sym-xzc-s": "fa00",
    	"sym-xzc": "fa01",
    	"sym-yam-s": "fa02",
    	"sym-yam": "fa03",
    	"sym-yee-s": "fa04",
    	"sym-yee": "fa05",
    	"sym-yeed-s": "fa06",
    	"sym-yeed": "fa07",
    	"sym-yfi-s": "fa08",
    	"sym-yfi": "fa09",
    	"sym-yfii-s": "fa0a",
    	"sym-yfii": "fa0b",
    	"sym-ygg-s": "fa0c",
    	"sym-ygg": "fa0d",
    	"sym-yoyow-s": "fa0e",
    	"sym-yoyow": "fa0f",
    	"sym-zar-s": "fa10",
    	"sym-zar": "fa11",
    	"sym-zcl-s": "fa12",
    	"sym-zcl": "fa13",
    	"sym-zcn-s": "fa14",
    	"sym-zcn": "fa15",
    	"sym-zco-s": "fa16",
    	"sym-zco": "fa17",
    	"sym-zec-s": "fa18",
    	"sym-zec": "fa19",
    	"sym-zen-s": "fa1a",
    	"sym-zen": "fa1b",
    	"sym-zil-s": "fa1c",
    	"sym-zil": "fa1d",
    	"sym-zks-s": "fa1e",
    	"sym-zks": "fa1f",
    	"sym-zla-s": "fa20",
    	"sym-zla": "fa21",
    	"sym-zlk": "fa22",
    	"sym-zondo-s": "fa23",
    	"sym-zondo": "fa24",
    	"sym-zpr-s": "fa25",
    	"sym-zpr": "fa26",
    	"sym-zpt-s": "fa27",
    	"sym-zpt": "fa28",
    	"sym-zrc-s": "fa29",
    	"sym-zrc": "fa2a",
    	"sym-zrx-s": "fa2b",
    	"sym-zrx": "fa2c",
    	"sym-zsc-s": "fa2d",
    	"sym-zsc": "fa2e",
    	"sym-ztg-s": "fa2f",
    	"sym-ztg": "fa30",
    	"ustc-s": "fa31",
    	ustc: ustc,
    	"cur-anct": "f1d2",
    	"cur-anct-s": "f1d1",
    	"cur-aud": "f202",
    	"cur-aud-s": "f201",
    	"cur-bnb": "f275",
    	"cur-bnb-s": "f274",
    	"sym-xbt": "f29f",
    	"cur-btc": "f29f",
    	"sym-xbt-s": "f29e",
    	"cur-btc-s": "f29e",
    	"cur-busd": "f2bf",
    	"cur-busd-s": "f2be",
    	"exc-bitz": "f2c3",
    	"cur-bz": "f2c3",
    	"exc-bitz-s": "f2c2",
    	"cur-bz-s": "f2c2",
    	"cur-cad": "f2cd",
    	"cur-cad-s": "f2cc",
    	"cur-chf": "f2ed",
    	"cur-chf-s": "f2ec",
    	"cur-cny": "f311",
    	"cur-cny-s": "f310",
    	"sym-cs": "f325",
    	"sym-cs-s": "f324",
    	"sym-crm": "f33d",
    	"sym-crm-s": "f33c",
    	"cur-dai": "f36b",
    	"cur-dai-s": "f36a",
    	"sym-xdg": "f3a9",
    	"sym-xdg-s": "f3a8",
    	"cur-eos": "f3f6",
    	"cur-eos-s": "f3f5",
    	"sym-eth2": "f406",
    	"sym-eth2s": "f406",
    	"sym-eth2.s": "f406",
    	"cur-eth": "f406",
    	"sym-eth2-s": "f405",
    	"sym-eth2s-s": "f405",
    	"sym-eth2.s-s": "f405",
    	"cur-eth-s": "f405",
    	"cur-eur": "f40e",
    	"cur-eur-s": "f40d",
    	"cur-eurs": "f412",
    	"cur-eurs-s": "f411",
    	"sym-usdt": "f414",
    	"cur-usdt": "f414",
    	"sym-usdt-s": "f413",
    	"cur-usdt-s": "f413",
    	"exc-kraken": "f42c",
    	"exc-kraken-futures": "f42c",
    	"exc-kraken-s": "f42b",
    	"exc-kraken-futures-s": "f42b",
    	"cur-gbp": "f480",
    	"cur-gbp-s": "f47f",
    	"exc-gemini": "f4c8",
    	"cur-gusd": "f4c8",
    	"exc-gemini-s": "f4c7",
    	"cur-gusd-s": "f4c7",
    	"cur-hkd": "f4ec",
    	"cur-hkd-s": "f4eb",
    	"sym-husd": "f50a",
    	"exc-huobi": "f50a",
    	"cur-ht": "f50a",
    	"sym-husd-s": "f509",
    	"exc-huobi-s": "f509",
    	"cur-ht-s": "f509",
    	"cur-idr": "f52a",
    	"cur-idr-s": "f529",
    	"sym-iota": "f552",
    	"sym-iota-s": "f551",
    	"cur-inr": "f544",
    	"cur-inr-s": "f543",
    	"cur-jpy": "f568",
    	"cur-jpy-s": "f567",
    	"cur-krw": "f59a",
    	"cur-krw-s": "f599",
    	"sym-medx": "f614",
    	"sym-medx-s": "f613",
    	"cur-mxn": "f66c",
    	"cur-mxn-s": "f66b",
    	"cur-myr": "f66e",
    	"cur-myr-s": "f66d",
    	"cur-ngn": "f698",
    	"cur-ngn-s": "f697",
    	"cur-pax": "f710",
    	"cur-pax-s": "f70f",
    	"cur-php": "f728",
    	"cur-php-s": "f727",
    	"cur-pln": "f73e",
    	"cur-pln-s": "f73d",
    	"cur-qash": "f776",
    	"cur-qash-s": "f775",
    	"cur-rub": "f7f4",
    	"cur-rur": "f7f4",
    	"cur-rub-s": "f7f3",
    	"cur-rur-s": "f7f3",
    	"sym-steem": "f80c",
    	"sym-steem-s": "f80b",
    	"sym-xsc": "f810",
    	"sym-xsc-s": "f80f",
    	"cur-sgd": "f82c",
    	"cur-sgd-s": "f82b",
    	"sym-storj": "f842",
    	"sym-storj-s": "f841",
    	"sym-tel": "f8c6",
    	"cur-trx": "f90f",
    	"cur-trx-s": "f90e",
    	"cur-tusd": "f91f",
    	"cur-tusd-s": "f91e",
    	"cur-usd": "f93f",
    	"cur-usd-s": "f93e",
    	"cur-usdc": "f941",
    	"cur-usdc-s": "f940",
    	"sym-vet": "f95f",
    	"sym-vet-s": "f95e",
    	"sym-waxp": "f991",
    	"sym-waxp-s": "f990",
    	"cur-xlm": "f9d1",
    	"cur-xlm-s": "f9d0",
    	"cur-xmr": "f9d5",
    	"cur-xmr-s": "f9d4",
    	"cur-xrp": "f9e9",
    	"cur-xrp-s": "f9e8",
    	"cur-zar": "fa11",
    	"cur-zar-s": "fa10",
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
    	"cur-crc": "f331",
    	"cur-crc-s": "f330",
    	"cur-lak": "f5a4",
    	"cur-lak-s": "f5a3",
    	"cur-sek": "f81c",
    	"cur-sek-s": "f81b",
    	"cur-thb": "f8d5",
    	"cur-thb-s": "f8d4",
    	"cur-try": "f911",
    	"cur-try-s": "f910",
    	"cur-uah": "f925",
    	"cur-uah-s": "f924",
    	"exc-ftx": "f460",
    	"exc-ftx-s": "f45f",
    	"exc-ftx-us": "f460",
    	"exc-ftx-us-s": "f45f",
    	"sym-cgld": "f2dd",
    	"sym-cgld-s": "f2dc",
    	"exc-uniswap-v2": "f937",
    	"exc-uniswap-v2-s": "f936",
    	"sym-kshib": "f832",
    	"sym-kshib-s": "f831",
    	"sym-easy-s": "f3ca",
    	"sym-srare": "f7a0",
    	"sym-srare-s": "f79f",
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
    var quick = "QuickSwap [OLD]";
    var quoine = "Quoine";
    var rarible = "";
    var totle = "";
    var upbit = "";
    var vaultofsatoshi = "";
    var wex = "WaultSwap";
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
    var agi = "SingularityNET [deleted]";
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
    var alpha = "Alpha Venture DAO";
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
    var aptos = "";
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
    var axl = "AXL INU";
    var axpr = "aXpire";
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
    var boba = "Boba Network";
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
    var cdt = "CoinDash";
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
    var drep = "Drep [new]";
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
    var edg = "Edgeware";
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
    var euroc = "";
    var eurs = "STASIS EURS";
    var eurt = "Tether Euro";
    var evn = "Evolution Finance";
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
    var fox = "ShapeShift FOX Token";
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
    var gnt = "Golem [deleted]";
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
    var gxs = "GXS";
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
    var hit = "HitBTC";
    var hive = "Hive";
    var hkd = "Hong Kong Dollar";
    var hko = "";
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
    var hsr = "Hshare [deleted]";
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
    var joe = "JOE";
    var jpeg = "";
    var jpy = "Japanese Yen";
    var jst = "JUST";
    var juno = "";
    var just = "";
    var juv = "Juventus Fan Token";
    var kan = "BitKan";
    var kapex = "";
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
    var metis = "Metis";
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
    var morph = "Morpheus Network [deleted]";
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
    var nano = "Nano [old]";
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
    var ooki = "Ooki";
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
    var pai = "Project Pai";
    var pal = "Pal Network";
    var paper = "Dope Wars Paper";
    var para = "Parallel Finance";
    var part = "Particl";
    var pasc = "Pascal Coin";
    var pat = "Patron";
    var pax = "Paxos Standard [deleted]";
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
    var phx = "Phoenix";
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
    var r = "Revain [deleted]";
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
    var real = "Realy Metaverse";
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
    var rpl = "Rocket Pool";
    var rpx = "Red Pulse [deleted]";
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
    var sent = "Sentinel [OLD]";
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
    var str = "Stellar [deleted]";
    var strat = "Stratis [deleted]";
    var strax = "Stratis";
    var strk = "Strike";
    var strong = "Strong";
    var stx = "Stacks";
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
    var ttc = "TTC Protocol [deleted]";
    var ttt = "TabTrader";
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
    var usdc = "USD Coin";
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
    var ven = "VeChain [deleted]";
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
    var xcn = "Chain";
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
    var xrc = "xRhodium";
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
    var xzc = "ZCoin [deleted]";
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
    var kshib = "Kilo Shiba Inu";
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
    	aptos: aptos,
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
    	axl: axl,
    	axpr: axpr,
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
    	boba: boba,
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
    	euroc: euroc,
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
    	hko: hko,
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
    	kapex: kapex,
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
    	metis: metis,
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
    	rpl: rpl,
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
    	xcn: xcn,
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
