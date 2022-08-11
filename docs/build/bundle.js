
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

    var ustc = "fa26";
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
    	"sym-axpr-s": "f211",
    	"sym-axpr": "f212",
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
    	"sym-boba-s": "f27a",
    	"sym-boba": "f27b",
    	"sym-bond-s": "f27c",
    	"sym-bond": "f27d",
    	"sym-boo-s": "f27e",
    	"sym-boo": "f27f",
    	"sym-bor-s": "f280",
    	"sym-bor": "f281",
    	"sym-bora-s": "f282",
    	"sym-bora": "f283",
    	"sym-bos-s": "f284",
    	"sym-bos": "f285",
    	"sym-box-s": "f286",
    	"sym-box": "f287",
    	"sym-brd-s": "f288",
    	"sym-brd": "f289",
    	"sym-breed-s": "f28a",
    	"sym-breed": "f28b",
    	"sym-brg-s": "f28c",
    	"sym-brg": "f28d",
    	"sym-brick-s": "f28e",
    	"sym-brick": "f28f",
    	"sym-bsd-s": "f290",
    	"sym-bsd": "f291",
    	"sym-bsv-s": "f292",
    	"sym-bsv": "f293",
    	"sym-bsx-s": "f294",
    	"sym-bsx": "f295",
    	"sym-bt1-s": "f296",
    	"sym-bt1": "f297",
    	"sym-bt2-s": "f298",
    	"sym-bt2": "f299",
    	"sym-btc-s": "f29a",
    	"sym-btc": "f29b",
    	"sym-btcd-s": "f29c",
    	"sym-btcd": "f29d",
    	"sym-btcfx-s": "f29e",
    	"sym-btcfx": "f29f",
    	"sym-btcp-s": "f2a0",
    	"sym-btcp": "f2a1",
    	"sym-btg-s": "f2a2",
    	"sym-btg": "f2a3",
    	"sym-btm-s": "f2a4",
    	"sym-btm": "f2a5",
    	"sym-btn-s": "f2a6",
    	"sym-btn": "f2a7",
    	"sym-bto-s": "f2a8",
    	"sym-bto": "f2a9",
    	"sym-btrst-s": "f2aa",
    	"sym-btrst": "f2ab",
    	"sym-bts-s": "f2ac",
    	"sym-bts": "f2ad",
    	"sym-btt-s": "f2ae",
    	"sym-btt": "f2af",
    	"sym-btu-s": "f2b0",
    	"sym-btu": "f2b1",
    	"sym-btx-s": "f2b2",
    	"sym-btx": "f2b3",
    	"sym-burger-s": "f2b4",
    	"sym-burger": "f2b5",
    	"sym-burst-s": "f2b6",
    	"sym-burst": "f2b7",
    	"sym-bus-s": "f2b8",
    	"sym-bus": "f2b9",
    	"sym-busd-s": "f2ba",
    	"sym-busd": "f2bb",
    	"sym-bwx-s": "f2bc",
    	"sym-bwx": "f2bd",
    	"sym-bz-s": "f2be",
    	"sym-bz": "f2bf",
    	"sym-bzrx-s": "f2c0",
    	"sym-bzrx": "f2c1",
    	"sym-c-s": "f2c2",
    	"sym-c": "f2c3",
    	"sym-c20-s": "f2c4",
    	"sym-c20": "f2c5",
    	"sym-c98-s": "f2c6",
    	"sym-c98": "f2c7",
    	"sym-cad-s": "f2c8",
    	"sym-cad": "f2c9",
    	"sym-cake-s": "f2ca",
    	"sym-cake": "f2cb",
    	"sym-cas-s": "f2cc",
    	"sym-cas": "f2cd",
    	"sym-cat-s": "f2ce",
    	"sym-cat": "f2cf",
    	"sym-cbc-s": "f2d0",
    	"sym-cbc": "f2d1",
    	"sym-cbt-s": "f2d2",
    	"sym-cbt": "f2d3",
    	"sym-cdt-s": "f2d4",
    	"sym-cdt": "f2d5",
    	"sym-cel-s": "f2d6",
    	"sym-cel": "f2d7",
    	"sym-celo-s": "f2d8",
    	"sym-celo": "f2d9",
    	"sym-celr-s": "f2da",
    	"sym-celr": "f2db",
    	"sym-cennz-s": "f2dc",
    	"sym-cennz": "f2dd",
    	"sym-cfg-s": "f2de",
    	"sym-cfg": "f2df",
    	"sym-cfi-s": "f2e0",
    	"sym-cfi": "f2e1",
    	"sym-cfx-s": "f2e2",
    	"sym-cfx": "f2e3",
    	"sym-cgt-s": "f2e4",
    	"sym-cgt": "f2e5",
    	"sym-chat-s": "f2e6",
    	"sym-chat": "f2e7",
    	"sym-chf-s": "f2e8",
    	"sym-chf": "f2e9",
    	"sym-chp-s": "f2ea",
    	"sym-chp": "f2eb",
    	"sym-chr-s": "f2ec",
    	"sym-chr": "f2ed",
    	"sym-chsb-s": "f2ee",
    	"sym-chsb": "f2ef",
    	"sym-chx-s": "f2f0",
    	"sym-chx": "f2f1",
    	"sym-chz-s": "f2f2",
    	"sym-chz": "f2f3",
    	"sym-ckb-s": "f2f4",
    	"sym-ckb": "f2f5",
    	"sym-cl-s": "f2f6",
    	"sym-cl": "f2f7",
    	"sym-clam-s": "f2f8",
    	"sym-clam": "f2f9",
    	"sym-cln-s": "f2fa",
    	"sym-cln": "f2fb",
    	"sym-clo-s": "f2fc",
    	"sym-clo": "f2fd",
    	"sym-cloak-s": "f2fe",
    	"sym-cloak": "f2ff",
    	"sym-clv-s": "f300",
    	"sym-clv": "f301",
    	"sym-cmct-s": "f302",
    	"sym-cmct": "f303",
    	"sym-cmt-s": "f304",
    	"sym-cmt": "f305",
    	"sym-cnd-s": "f306",
    	"sym-cnd": "f307",
    	"sym-cnn-s": "f308",
    	"sym-cnn": "f309",
    	"sym-cnx-s": "f30a",
    	"sym-cnx": "f30b",
    	"sym-cny-s": "f30c",
    	"sym-cny": "f30d",
    	"sym-cob-s": "f30e",
    	"sym-cob": "f30f",
    	"sym-cocos-s": "f310",
    	"sym-cocos": "f311",
    	"sym-comp-s": "f312",
    	"sym-comp": "f313",
    	"sym-cope-s": "f314",
    	"sym-cope": "f315",
    	"sym-cos-s": "f316",
    	"sym-cos": "f317",
    	"sym-cosm-s": "f318",
    	"sym-cosm": "f319",
    	"sym-coss-s": "f31a",
    	"sym-coss": "f31b",
    	"sym-coti-s": "f31c",
    	"sym-coti": "f31d",
    	"sym-cov-s": "f31e",
    	"sym-cov": "f31f",
    	"sym-cova-s": "f320",
    	"sym-cova": "f321",
    	"sym-cpt-s": "f322",
    	"sym-cpt": "f323",
    	"sym-cpx-s": "f324",
    	"sym-cpx": "f325",
    	"sym-cqt-s": "f326",
    	"sym-cqt": "f327",
    	"sym-cra-s": "f328",
    	"sym-cra": "f329",
    	"sym-crab-s": "f32a",
    	"sym-crab": "f32b",
    	"sym-crc-s": "f32c",
    	"sym-crc": "f32d",
    	"sym-cre-s": "f32e",
    	"sym-cre": "f32f",
    	"sym-cream-s": "f330",
    	"sym-cream": "f331",
    	"sym-cring-s": "f332",
    	"sym-cring": "f333",
    	"sym-cro-s": "f334",
    	"sym-cro": "f335",
    	"sym-crpt-s": "f336",
    	"sym-crpt": "f337",
    	"sym-cru-s": "f338",
    	"sym-cru": "f339",
    	"sym-crv-s": "f33a",
    	"sym-crv": "f33b",
    	"sym-crw-s": "f33c",
    	"sym-crw": "f33d",
    	"sym-csm-s": "f33e",
    	"sym-csm": "f33f",
    	"sym-csx-s": "f340",
    	"sym-csx": "f341",
    	"sym-ctc-s": "f342",
    	"sym-ctc": "f343",
    	"sym-ctk-s": "f344",
    	"sym-ctk": "f345",
    	"sym-ctsi-s": "f346",
    	"sym-ctsi": "f347",
    	"sym-ctxc-s": "f348",
    	"sym-ctxc": "f349",
    	"sym-cult-s": "f34a",
    	"sym-cult": "f34b",
    	"sym-cur-s": "f34c",
    	"sym-cur": "f34d",
    	"sym-cvc-s": "f34e",
    	"sym-cvc": "f34f",
    	"sym-cvcoin-s": "f350",
    	"sym-cvcoin": "f351",
    	"sym-cvnt-s": "f352",
    	"sym-cvnt": "f353",
    	"sym-cvp-s": "f354",
    	"sym-cvp": "f355",
    	"sym-cvt-s": "f356",
    	"sym-cvt": "f357",
    	"sym-cvx-s": "f358",
    	"sym-cvx": "f359",
    	"sym-cw-s": "f35a",
    	"sym-cw": "f35b",
    	"sym-cyc-s": "f35c",
    	"sym-cyc": "f35d",
    	"sym-dac-s": "f35e",
    	"sym-dac": "f35f",
    	"sym-dacs-s": "f360",
    	"sym-dacs": "f361",
    	"sym-dadi-s": "f362",
    	"sym-dadi": "f363",
    	"sym-dag-s": "f364",
    	"sym-dag": "f365",
    	"sym-dai-s": "f366",
    	"sym-dai": "f367",
    	"sym-dao-s": "f368",
    	"sym-dao": "f369",
    	"sym-dar-s": "f36a",
    	"sym-dar": "f36b",
    	"sym-dash-s": "f36c",
    	"sym-dash": "f36d",
    	"sym-dat-s": "f36e",
    	"sym-dat": "f36f",
    	"sym-data-s": "f370",
    	"sym-data": "f371",
    	"sym-datx-s": "f372",
    	"sym-datx": "f373",
    	"sym-dbc-s": "f374",
    	"sym-dbc": "f375",
    	"sym-dbet-s": "f376",
    	"sym-dbet": "f377",
    	"sym-dbix-s": "f378",
    	"sym-dbix": "f379",
    	"sym-dcn-s": "f37a",
    	"sym-dcn": "f37b",
    	"sym-dcr-s": "f37c",
    	"sym-dcr": "f37d",
    	"sym-dct-s": "f37e",
    	"sym-dct": "f37f",
    	"sym-ddd-s": "f380",
    	"sym-ddd": "f381",
    	"sym-dego-s": "f382",
    	"sym-dego": "f383",
    	"sym-dent-s": "f384",
    	"sym-dent": "f385",
    	"sym-dext-s": "f386",
    	"sym-dext": "f387",
    	"sym-dgb-s": "f388",
    	"sym-dgb": "f389",
    	"sym-dgd-s": "f38a",
    	"sym-dgd": "f38b",
    	"sym-dgtx-s": "f38c",
    	"sym-dgtx": "f38d",
    	"sym-dgx-s": "f38e",
    	"sym-dgx": "f38f",
    	"sym-dhx-s": "f390",
    	"sym-dhx": "f391",
    	"sym-dia-s": "f392",
    	"sym-dia": "f393",
    	"sym-dice-s": "f394",
    	"sym-dice": "f395",
    	"sym-dim-s": "f396",
    	"sym-dim": "f397",
    	"sym-dlt-s": "f398",
    	"sym-dlt": "f399",
    	"sym-dmd-s": "f39a",
    	"sym-dmd": "f39b",
    	"sym-dmt-s": "f39c",
    	"sym-dmt": "f39d",
    	"sym-dnt-s": "f39e",
    	"sym-dnt": "f39f",
    	"sym-dock-s": "f3a0",
    	"sym-dock": "f3a1",
    	"sym-dodo-s": "f3a2",
    	"sym-dodo": "f3a3",
    	"sym-doge-s": "f3a4",
    	"sym-doge": "f3a5",
    	"sym-dose-s": "f3a6",
    	"sym-dose": "f3a7",
    	"sym-dot-s": "f3a8",
    	"sym-dot": "f3a9",
    	"sym-dpx-s": "f3aa",
    	"sym-dpx": "f3ab",
    	"sym-dpy-s": "f3ac",
    	"sym-dpy": "f3ad",
    	"sym-dream-s": "f3ae",
    	"sym-dream": "f3af",
    	"sym-drep-s": "f3b0",
    	"sym-drep": "f3b1",
    	"sym-drg-s": "f3b2",
    	"sym-drg": "f3b3",
    	"sym-drgn-s": "f3b4",
    	"sym-drgn": "f3b5",
    	"sym-drt-s": "f3b6",
    	"sym-drt": "f3b7",
    	"sym-dta-s": "f3b8",
    	"sym-dta": "f3b9",
    	"sym-dtb-s": "f3ba",
    	"sym-dtb": "f3bb",
    	"sym-dtr-s": "f3bc",
    	"sym-dtr": "f3bd",
    	"sym-dusk-s": "f3be",
    	"sym-dusk": "f3bf",
    	"sym-dx-s": "f3c0",
    	"sym-dx": "f3c1",
    	"sym-dydx-s": "f3c2",
    	"sym-dydx": "f3c3",
    	"sym-dyn-s": "f3c4",
    	"sym-dyn": "f3c5",
    	"sym-easy": "f3c6",
    	"sym-ecom-s": "f3c7",
    	"sym-ecom": "f3c8",
    	"sym-edc-s": "f3c9",
    	"sym-edc": "f3ca",
    	"sym-edg-s": "f3cb",
    	"sym-edg": "f3cc",
    	"sym-edo-s": "f3cd",
    	"sym-edo": "f3ce",
    	"sym-edp-s": "f3cf",
    	"sym-edp": "f3d0",
    	"sym-edr-s": "f3d1",
    	"sym-edr": "f3d2",
    	"sym-efi-s": "f3d3",
    	"sym-efi": "f3d4",
    	"sym-egld-s": "f3d5",
    	"sym-egld": "f3d6",
    	"sym-egt-s": "f3d7",
    	"sym-egt": "f3d8",
    	"sym-ehr-s": "f3d9",
    	"sym-ehr": "f3da",
    	"sym-eko-s": "f3db",
    	"sym-eko": "f3dc",
    	"sym-ekt-s": "f3dd",
    	"sym-ekt": "f3de",
    	"sym-ela-s": "f3df",
    	"sym-ela": "f3e0",
    	"sym-elec-s": "f3e1",
    	"sym-elec": "f3e2",
    	"sym-elf-s": "f3e3",
    	"sym-elf": "f3e4",
    	"sym-em-s": "f3e5",
    	"sym-em": "f3e6",
    	"sym-emc-s": "f3e7",
    	"sym-emc": "f3e8",
    	"sym-emc2-s": "f3e9",
    	"sym-emc2": "f3ea",
    	"sym-eng-s": "f3eb",
    	"sym-eng": "f3ec",
    	"sym-enj-s": "f3ed",
    	"sym-enj": "f3ee",
    	"sym-ens-s": "f3ef",
    	"sym-ens": "f3f0",
    	"sym-eos-s": "f3f1",
    	"sym-eos": "f3f2",
    	"sym-eosdac-s": "f3f3",
    	"sym-eosdac": "f3f4",
    	"sym-eq-s": "f3f5",
    	"sym-eq": "f3f6",
    	"sym-erd-s": "f3f7",
    	"sym-erd": "f3f8",
    	"sym-ern-s": "f3f9",
    	"sym-ern": "f3fa",
    	"sym-es": "f3fb",
    	"sym-es-s": "f3fc",
    	"sym-esd-s": "f3fd",
    	"sym-esd": "f3fe",
    	"sym-etc-s": "f3ff",
    	"sym-etc": "f400",
    	"sym-eth-s": "f401",
    	"sym-eth": "f402",
    	"sym-ethup-s": "f403",
    	"sym-ethup": "f404",
    	"sym-etn-s": "f405",
    	"sym-etn": "f406",
    	"sym-etp-s": "f407",
    	"sym-etp": "f408",
    	"sym-eur-s": "f409",
    	"sym-eur": "f40a",
    	"sym-eurs-s": "f40b",
    	"sym-eurs": "f40c",
    	"sym-eurt-s": "f40d",
    	"sym-eurt": "f40e",
    	"sym-evn-s": "f40f",
    	"sym-evn": "f410",
    	"sym-evx-s": "f411",
    	"sym-evx": "f412",
    	"sym-ewt-s": "f413",
    	"sym-ewt": "f414",
    	"sym-exp-s": "f415",
    	"sym-exp": "f416",
    	"sym-exrd-s": "f417",
    	"sym-exrd": "f418",
    	"sym-exy-s": "f419",
    	"sym-exy": "f41a",
    	"sym-ez-s": "f41b",
    	"sym-ez": "f41c",
    	"sym-fair-s": "f41d",
    	"sym-fair": "f41e",
    	"sym-farm-s": "f41f",
    	"sym-farm": "f420",
    	"sym-fct-s": "f421",
    	"sym-fct": "f422",
    	"sym-fdz-s": "f423",
    	"sym-fdz": "f424",
    	"sym-fee-s": "f425",
    	"sym-fee": "f426",
    	"sym-fet-s": "f427",
    	"sym-fet": "f428",
    	"sym-fida-s": "f429",
    	"sym-fida": "f42a",
    	"sym-fil-s": "f42b",
    	"sym-fil": "f42c",
    	"sym-fio-s": "f42d",
    	"sym-fio": "f42e",
    	"sym-firo-s": "f42f",
    	"sym-firo": "f430",
    	"sym-fis-s": "f431",
    	"sym-fis": "f432",
    	"sym-fldc-s": "f433",
    	"sym-fldc": "f434",
    	"sym-flo-s": "f435",
    	"sym-flo": "f436",
    	"sym-floki-s": "f437",
    	"sym-floki": "f438",
    	"sym-flow-s": "f439",
    	"sym-flow": "f43a",
    	"sym-flr-s": "f43b",
    	"sym-flr": "f43c",
    	"sym-fluz-s": "f43d",
    	"sym-fluz": "f43e",
    	"sym-fnb-s": "f43f",
    	"sym-fnb": "f440",
    	"sym-foam-s": "f441",
    	"sym-foam": "f442",
    	"sym-for-s": "f443",
    	"sym-for": "f444",
    	"sym-forth-s": "f445",
    	"sym-forth": "f446",
    	"sym-fota-s": "f447",
    	"sym-fota": "f448",
    	"sym-fox-s": "f449",
    	"sym-fox": "f44a",
    	"sym-fpis-s": "f44b",
    	"sym-fpis": "f44c",
    	"sym-frax-s": "f44d",
    	"sym-frax": "f44e",
    	"sym-front-s": "f44f",
    	"sym-front": "f450",
    	"sym-fsn-s": "f451",
    	"sym-fsn": "f452",
    	"sym-ftc-s": "f453",
    	"sym-ftc": "f454",
    	"sym-fti-s": "f455",
    	"sym-fti": "f456",
    	"sym-ftm-s": "f457",
    	"sym-ftm": "f458",
    	"sym-ftt-s": "f459",
    	"sym-ftt": "f45a",
    	"sym-ftx-s": "f45b",
    	"sym-ftx": "f45c",
    	"sym-fuel-s": "f45d",
    	"sym-fuel": "f45e",
    	"sym-fun-s": "f45f",
    	"sym-fun": "f460",
    	"sym-fx-s": "f461",
    	"sym-fx": "f462",
    	"sym-fxc-s": "f463",
    	"sym-fxc": "f464",
    	"sym-fxs-s": "f465",
    	"sym-fxs": "f466",
    	"sym-fxt-s": "f467",
    	"sym-fxt": "f468",
    	"sym-gal-s": "f469",
    	"sym-gal": "f46a",
    	"sym-gala-s": "f46b",
    	"sym-gala": "f46c",
    	"sym-game-s": "f46d",
    	"sym-game": "f46e",
    	"sym-gamee-s": "f46f",
    	"sym-gamee": "f470",
    	"sym-gard-s": "f471",
    	"sym-gard": "f472",
    	"sym-gari-s": "f473",
    	"sym-gari": "f474",
    	"sym-gas-s": "f475",
    	"sym-gas": "f476",
    	"sym-gbc-s": "f477",
    	"sym-gbc": "f478",
    	"sym-gbp-s": "f479",
    	"sym-gbp": "f47a",
    	"sym-gbx-s": "f47b",
    	"sym-gbx": "f47c",
    	"sym-gbyte-s": "f47d",
    	"sym-gbyte": "f47e",
    	"sym-gc-s": "f47f",
    	"sym-gc": "f480",
    	"sym-gcc-s": "f481",
    	"sym-gcc": "f482",
    	"sym-ge-s": "f483",
    	"sym-ge": "f484",
    	"sym-geist-s": "f485",
    	"sym-geist": "f486",
    	"sym-gen-s": "f487",
    	"sym-gen": "f488",
    	"sym-gene-s": "f489",
    	"sym-gene": "f48a",
    	"sym-gens-s": "f48b",
    	"sym-gens": "f48c",
    	"sym-get-s": "f48d",
    	"sym-get": "f48e",
    	"sym-ghst-s": "f48f",
    	"sym-ghst": "f490",
    	"sym-glc-s": "f491",
    	"sym-glc": "f492",
    	"sym-gld-s": "f493",
    	"sym-gld": "f494",
    	"sym-glm-s": "f495",
    	"sym-glm": "f496",
    	"sym-glmr-s": "f497",
    	"sym-glmr": "f498",
    	"sym-gmat-s": "f499",
    	"sym-gmat": "f49a",
    	"sym-gmt-s": "f49b",
    	"sym-gmt": "f49c",
    	"sym-gmt2-s": "f49d",
    	"sym-gmt2": "f49e",
    	"sym-gno-s": "f49f",
    	"sym-gno": "f4a0",
    	"sym-gnt-s": "f4a1",
    	"sym-gnt": "f4a2",
    	"sym-gnx-s": "f4a3",
    	"sym-gnx": "f4a4",
    	"sym-go-s": "f4a5",
    	"sym-go": "f4a6",
    	"sym-gods-s": "f4a7",
    	"sym-gods": "f4a8",
    	"sym-got-s": "f4a9",
    	"sym-got": "f4aa",
    	"sym-grc-s": "f4ab",
    	"sym-grc": "f4ac",
    	"sym-grin-s": "f4ad",
    	"sym-grin": "f4ae",
    	"sym-grs-s": "f4af",
    	"sym-grs": "f4b0",
    	"sym-grt-s": "f4b1",
    	"sym-grt": "f4b2",
    	"sym-gsc-s": "f4b3",
    	"sym-gsc": "f4b4",
    	"sym-gst-s": "f4b5",
    	"sym-gst": "f4b6",
    	"sym-gt-s": "f4b7",
    	"sym-gt": "f4b8",
    	"sym-gtc-s": "f4b9",
    	"sym-gtc": "f4ba",
    	"sym-gtc2-s": "f4bb",
    	"sym-gtc2": "f4bc",
    	"sym-gto-s": "f4bd",
    	"sym-gto": "f4be",
    	"sym-gup-s": "f4bf",
    	"sym-gup": "f4c0",
    	"sym-gusd-s": "f4c1",
    	"sym-gusd": "f4c2",
    	"sym-gvt-s": "f4c3",
    	"sym-gvt": "f4c4",
    	"sym-gxc-s": "f4c5",
    	"sym-gxc": "f4c6",
    	"sym-gxs-s": "f4c7",
    	"sym-gxs": "f4c8",
    	"sym-hard-s": "f4c9",
    	"sym-hard": "f4ca",
    	"sym-hbar-s": "f4cb",
    	"sym-hbar": "f4cc",
    	"sym-hc-s": "f4cd",
    	"sym-hc": "f4ce",
    	"sym-hdx-s": "f4cf",
    	"sym-hdx": "f4d0",
    	"sym-hedg-s": "f4d1",
    	"sym-hedg": "f4d2",
    	"sym-hegic-s": "f4d3",
    	"sym-hegic": "f4d4",
    	"sym-hex-s": "f4d5",
    	"sym-hex": "f4d6",
    	"sym-hft-s": "f4d7",
    	"sym-hft": "f4d8",
    	"sym-hg-s": "f4d9",
    	"sym-hg": "f4da",
    	"sym-hgs-s": "f4db",
    	"sym-hgs": "f4dc",
    	"sym-hh-s": "f4dd",
    	"sym-hh": "f4de",
    	"sym-high-s": "f4df",
    	"sym-high": "f4e0",
    	"sym-hit-s": "f4e1",
    	"sym-hit": "f4e2",
    	"sym-hive-s": "f4e3",
    	"sym-hive": "f4e4",
    	"sym-hkd-s": "f4e5",
    	"sym-hkd": "f4e6",
    	"sym-hmq-s": "f4e7",
    	"sym-hmq": "f4e8",
    	"sym-hns-s": "f4e9",
    	"sym-hns": "f4ea",
    	"sym-ho-s": "f4eb",
    	"sym-ho": "f4ec",
    	"sym-hopr-s": "f4ed",
    	"sym-hopr": "f4ee",
    	"sym-hot-s": "f4ef",
    	"sym-hot": "f4f0",
    	"sym-hp-s": "f4f1",
    	"sym-hp": "f4f2",
    	"sym-hpb-s": "f4f3",
    	"sym-hpb": "f4f4",
    	"sym-hpc-s": "f4f5",
    	"sym-hpc": "f4f6",
    	"sym-hpt-s": "f4f7",
    	"sym-hpt": "f4f8",
    	"sym-hrc-s": "f4f9",
    	"sym-hrc": "f4fa",
    	"sym-hsc-s": "f4fb",
    	"sym-hsc": "f4fc",
    	"sym-hsr-s": "f4fd",
    	"sym-hsr": "f4fe",
    	"sym-hst-s": "f4ff",
    	"sym-hst": "f500",
    	"sym-ht-s": "f501",
    	"sym-ht": "f502",
    	"sym-html-s": "f503",
    	"sym-html": "f504",
    	"sym-htt-s": "f505",
    	"sym-htt": "f506",
    	"sym-huc-s": "f507",
    	"sym-huc": "f508",
    	"sym-hunt-s": "f509",
    	"sym-hunt": "f50a",
    	"sym-hvn-s": "f50b",
    	"sym-hvn": "f50c",
    	"sym-hxro-s": "f50d",
    	"sym-hxro": "f50e",
    	"sym-hyc-s": "f50f",
    	"sym-hyc": "f510",
    	"sym-hydra-s": "f511",
    	"sym-hydra": "f512",
    	"sym-hydro-s": "f513",
    	"sym-hydro": "f514",
    	"sym-icn-s": "f515",
    	"sym-icn": "f516",
    	"sym-icos-s": "f517",
    	"sym-icos": "f518",
    	"sym-icp-s": "f519",
    	"sym-icp": "f51a",
    	"sym-icx-s": "f51b",
    	"sym-icx": "f51c",
    	"sym-idex-s": "f51d",
    	"sym-idex": "f51e",
    	"sym-idh-s": "f51f",
    	"sym-idh": "f520",
    	"sym-idr-s": "f521",
    	"sym-idr": "f522",
    	"sym-ift-s": "f523",
    	"sym-ift": "f524",
    	"sym-ignis-s": "f525",
    	"sym-ignis": "f526",
    	"sym-ihf-s": "f527",
    	"sym-ihf": "f528",
    	"sym-iht-s": "f529",
    	"sym-iht": "f52a",
    	"sym-ilc-s": "f52b",
    	"sym-ilc": "f52c",
    	"sym-ilv-s": "f52d",
    	"sym-ilv": "f52e",
    	"sym-imx-s": "f52f",
    	"sym-imx": "f530",
    	"sym-incnt-s": "f531",
    	"sym-incnt": "f532",
    	"sym-ind-s": "f533",
    	"sym-ind": "f534",
    	"sym-indi-s": "f535",
    	"sym-indi": "f536",
    	"sym-inj-s": "f537",
    	"sym-inj": "f538",
    	"sym-ink-s": "f539",
    	"sym-ink": "f53a",
    	"sym-inr-s": "f53b",
    	"sym-inr": "f53c",
    	"sym-ins-s": "f53d",
    	"sym-ins": "f53e",
    	"sym-int-s": "f53f",
    	"sym-int": "f540",
    	"sym-intr-s": "f541",
    	"sym-intr": "f542",
    	"sym-ioc-s": "f543",
    	"sym-ioc": "f544",
    	"sym-ion-s": "f545",
    	"sym-ion": "f546",
    	"sym-iost-s": "f547",
    	"sym-iost": "f548",
    	"sym-iot-s": "f549",
    	"sym-iot": "f54a",
    	"sym-iotx-s": "f54b",
    	"sym-iotx": "f54c",
    	"sym-iq-s": "f54d",
    	"sym-iq": "f54e",
    	"sym-iris-s": "f54f",
    	"sym-iris": "f550",
    	"sym-itc-s": "f551",
    	"sym-itc": "f552",
    	"sym-ivy-s": "f553",
    	"sym-ivy": "f554",
    	"sym-ixt-s": "f555",
    	"sym-ixt": "f556",
    	"sym-jasmy-s": "f557",
    	"sym-jasmy": "f558",
    	"sym-jnt-s": "f559",
    	"sym-jnt": "f55a",
    	"sym-joe-s": "f55b",
    	"sym-joe": "f55c",
    	"sym-jpeg-s": "f55d",
    	"sym-jpeg": "f55e",
    	"sym-jpy-s": "f55f",
    	"sym-jpy": "f560",
    	"sym-jst-s": "f561",
    	"sym-jst": "f562",
    	"sym-juno-s": "f563",
    	"sym-juno": "f564",
    	"sym-just-s": "f565",
    	"sym-just": "f566",
    	"sym-juv-s": "f567",
    	"sym-juv": "f568",
    	"sym-kan-s": "f569",
    	"sym-kan": "f56a",
    	"sym-kapex-s": "f56b",
    	"sym-kapex": "f56c",
    	"sym-kar-s": "f56d",
    	"sym-kar": "f56e",
    	"sym-kava-s": "f56f",
    	"sym-kava": "f570",
    	"sym-kbc-s": "f571",
    	"sym-kbc": "f572",
    	"sym-kcash-s": "f573",
    	"sym-kcash": "f574",
    	"sym-kda-s": "f575",
    	"sym-kda": "f576",
    	"sym-keep-s": "f577",
    	"sym-keep": "f578",
    	"sym-key-s": "f579",
    	"sym-key": "f57a",
    	"sym-kick-s": "f57b",
    	"sym-kick": "f57c",
    	"sym-kilt-s": "f57d",
    	"sym-kilt": "f57e",
    	"sym-kin-s": "f57f",
    	"sym-kin": "f580",
    	"sym-kint-s": "f581",
    	"sym-kint": "f582",
    	"sym-klay-s": "f583",
    	"sym-klay": "f584",
    	"sym-kma-s": "f585",
    	"sym-kma": "f586",
    	"sym-kmd-s": "f587",
    	"sym-kmd": "f588",
    	"sym-knc-s": "f589",
    	"sym-knc": "f58a",
    	"sym-kore-s": "f58b",
    	"sym-kore": "f58c",
    	"sym-kp3r-s": "f58d",
    	"sym-kp3r": "f58e",
    	"sym-krm-s": "f58f",
    	"sym-krm": "f590",
    	"sym-krw-s": "f591",
    	"sym-krw": "f592",
    	"sym-ksm-s": "f593",
    	"sym-ksm": "f594",
    	"sym-ksx-s": "f595",
    	"sym-ksx": "f596",
    	"sym-kyl-s": "f597",
    	"sym-kyl": "f598",
    	"sym-la-s": "f599",
    	"sym-la": "f59a",
    	"sym-lak-s": "f59b",
    	"sym-lak": "f59c",
    	"sym-lamb-s": "f59d",
    	"sym-lamb": "f59e",
    	"sym-latx-s": "f59f",
    	"sym-latx": "f5a0",
    	"sym-layr-s": "f5a1",
    	"sym-layr": "f5a2",
    	"sym-lba-s": "f5a3",
    	"sym-lba": "f5a4",
    	"sym-lbc-s": "f5a5",
    	"sym-lbc": "f5a6",
    	"sym-lcc-s": "f5a7",
    	"sym-lcc": "f5a8",
    	"sym-lcx-s": "f5a9",
    	"sym-lcx": "f5aa",
    	"sym-ldo-s": "f5ab",
    	"sym-ldo": "f5ac",
    	"sym-lend-s": "f5ad",
    	"sym-lend": "f5ae",
    	"sym-leo-s": "f5af",
    	"sym-leo": "f5b0",
    	"sym-leoc-s": "f5b1",
    	"sym-leoc": "f5b2",
    	"sym-let-s": "f5b3",
    	"sym-let": "f5b4",
    	"sym-life-s": "f5b5",
    	"sym-life": "f5b6",
    	"sym-lina-s": "f5b7",
    	"sym-lina": "f5b8",
    	"sym-link-s": "f5b9",
    	"sym-link": "f5ba",
    	"sym-lit-s": "f5bb",
    	"sym-lit": "f5bc",
    	"sym-lmc-s": "f5bd",
    	"sym-lmc": "f5be",
    	"sym-lml-s": "f5bf",
    	"sym-lml": "f5c0",
    	"sym-lnc-s": "f5c1",
    	"sym-lnc": "f5c2",
    	"sym-lnd-s": "f5c3",
    	"sym-lnd": "f5c4",
    	"sym-loc-s": "f5c5",
    	"sym-loc": "f5c6",
    	"sym-loka-s": "f5c7",
    	"sym-loka": "f5c8",
    	"sym-looks-s": "f5c9",
    	"sym-looks": "f5ca",
    	"sym-loom-s": "f5cb",
    	"sym-loom": "f5cc",
    	"sym-lpt-s": "f5cd",
    	"sym-lpt": "f5ce",
    	"sym-lqty-s": "f5cf",
    	"sym-lqty": "f5d0",
    	"sym-lrc-s": "f5d1",
    	"sym-lrc": "f5d2",
    	"sym-lrn-s": "f5d3",
    	"sym-lrn": "f5d4",
    	"sym-lsk-s": "f5d5",
    	"sym-lsk": "f5d6",
    	"sym-ltc-s": "f5d7",
    	"sym-ltc": "f5d8",
    	"sym-lto-s": "f5d9",
    	"sym-lto": "f5da",
    	"sym-lun-s": "f5db",
    	"sym-lun": "f5dc",
    	"sym-luna-s": "f5dd",
    	"sym-luna": "f5de",
    	"sym-luna2-s": "f5df",
    	"sym-luna2": "f5e0",
    	"sym-lxt-s": "f5e1",
    	"sym-lxt": "f5e2",
    	"sym-lym-s": "f5e3",
    	"sym-lym": "f5e4",
    	"sym-m2k-s": "f5e5",
    	"sym-m2k": "f5e6",
    	"sym-ma-s": "f5e7",
    	"sym-ma": "f5e8",
    	"sym-magic-s": "f5e9",
    	"sym-magic": "f5ea",
    	"sym-maid-s": "f5eb",
    	"sym-maid": "f5ec",
    	"sym-man-s": "f5ed",
    	"sym-man": "f5ee",
    	"sym-mana-s": "f5ef",
    	"sym-mana": "f5f0",
    	"sym-maps-s": "f5f1",
    	"sym-maps": "f5f2",
    	"sym-mask-s": "f5f3",
    	"sym-mask": "f5f4",
    	"sym-mass-s": "f5f5",
    	"sym-mass": "f5f6",
    	"sym-math-s": "f5f7",
    	"sym-math": "f5f8",
    	"sym-matic-s": "f5f9",
    	"sym-matic": "f5fa",
    	"sym-mbl-s": "f5fb",
    	"sym-mbl": "f5fc",
    	"sym-mbt-s": "f5fd",
    	"sym-mbt": "f5fe",
    	"sym-mc-s": "f5ff",
    	"sym-mc": "f600",
    	"sym-mco-s": "f601",
    	"sym-mco": "f602",
    	"sym-mda-s": "f603",
    	"sym-mda": "f604",
    	"sym-mds-s": "f605",
    	"sym-mds": "f606",
    	"sym-mdt-s": "f607",
    	"sym-mdt": "f608",
    	"sym-mdx-s": "f609",
    	"sym-mdx": "f60a",
    	"sym-med-s": "f60b",
    	"sym-med": "f60c",
    	"sym-mer-s": "f60d",
    	"sym-mer": "f60e",
    	"sym-mes-s": "f60f",
    	"sym-mes": "f610",
    	"sym-met-s": "f611",
    	"sym-met": "f612",
    	"sym-meta-s": "f613",
    	"sym-meta": "f614",
    	"sym-mft-s": "f615",
    	"sym-mft": "f616",
    	"sym-mgc-s": "f617",
    	"sym-mgc": "f618",
    	"sym-mgo-s": "f619",
    	"sym-mgo": "f61a",
    	"sym-mhc-s": "f61b",
    	"sym-mhc": "f61c",
    	"sym-mina-s": "f61d",
    	"sym-mina": "f61e",
    	"sym-mir-s": "f61f",
    	"sym-mir": "f620",
    	"sym-mith-s": "f621",
    	"sym-mith": "f622",
    	"sym-mitx-s": "f623",
    	"sym-mitx": "f624",
    	"sym-mjp-s": "f625",
    	"sym-mjp": "f626",
    	"sym-mkr-s": "f627",
    	"sym-mkr": "f628",
    	"sym-mln-s": "f629",
    	"sym-mln": "f62a",
    	"sym-mngo-s": "f62b",
    	"sym-mngo": "f62c",
    	"sym-mnx-s": "f62d",
    	"sym-mnx": "f62e",
    	"sym-moac-s": "f62f",
    	"sym-moac": "f630",
    	"sym-mob-s": "f631",
    	"sym-mob": "f632",
    	"sym-mobi-s": "f633",
    	"sym-mobi": "f634",
    	"sym-moc-s": "f635",
    	"sym-moc": "f636",
    	"sym-mod-s": "f637",
    	"sym-mod": "f638",
    	"sym-mona-s": "f639",
    	"sym-mona": "f63a",
    	"sym-moon-s": "f63b",
    	"sym-moon": "f63c",
    	"sym-morph-s": "f63d",
    	"sym-morph": "f63e",
    	"sym-movr-s": "f63f",
    	"sym-movr": "f640",
    	"sym-mpl-s": "f641",
    	"sym-mpl": "f642",
    	"sym-mrk-s": "f643",
    	"sym-mrk": "f644",
    	"sym-msol-s": "f645",
    	"sym-msol": "f646",
    	"sym-msp-s": "f647",
    	"sym-msp": "f648",
    	"sym-mta-s": "f649",
    	"sym-mta": "f64a",
    	"sym-mtc-s": "f64b",
    	"sym-mtc": "f64c",
    	"sym-mth-s": "f64d",
    	"sym-mth": "f64e",
    	"sym-mtl-s": "f64f",
    	"sym-mtl": "f650",
    	"sym-mtn-s": "f651",
    	"sym-mtn": "f652",
    	"sym-mtx-s": "f653",
    	"sym-mtx": "f654",
    	"sym-mue-s": "f655",
    	"sym-mue": "f656",
    	"sym-multi-s": "f657",
    	"sym-multi": "f658",
    	"sym-mv-s": "f659",
    	"sym-mv": "f65a",
    	"sym-mx-s": "f65b",
    	"sym-mx": "f65c",
    	"sym-mxc-s": "f65d",
    	"sym-mxc": "f65e",
    	"sym-mxm-s": "f65f",
    	"sym-mxm": "f660",
    	"sym-mxn-s": "f661",
    	"sym-mxn": "f662",
    	"sym-myr-s": "f663",
    	"sym-myr": "f664",
    	"sym-n9l-s": "f665",
    	"sym-n9l": "f666",
    	"sym-nanj-s": "f667",
    	"sym-nanj": "f668",
    	"sym-nano-s": "f669",
    	"sym-nano": "f66a",
    	"sym-nas-s": "f66b",
    	"sym-nas": "f66c",
    	"sym-naut-s": "f66d",
    	"sym-naut": "f66e",
    	"sym-nav-s": "f66f",
    	"sym-nav": "f670",
    	"sym-ncash-s": "f671",
    	"sym-ncash": "f672",
    	"sym-nct-s": "f673",
    	"sym-nct": "f674",
    	"sym-near-s": "f675",
    	"sym-near": "f676",
    	"sym-nebl-s": "f677",
    	"sym-nebl": "f678",
    	"sym-nec-s": "f679",
    	"sym-nec": "f67a",
    	"sym-neo-s": "f67b",
    	"sym-neo": "f67c",
    	"sym-neos-s": "f67d",
    	"sym-neos": "f67e",
    	"sym-nest-s": "f67f",
    	"sym-nest": "f680",
    	"sym-neu-s": "f681",
    	"sym-neu": "f682",
    	"sym-new-s": "f683",
    	"sym-new": "f684",
    	"sym-nexo-s": "f685",
    	"sym-nexo": "f686",
    	"sym-nft-s": "f687",
    	"sym-nft": "f688",
    	"sym-ng-s": "f689",
    	"sym-ng": "f68a",
    	"sym-ngc-s": "f68b",
    	"sym-ngc": "f68c",
    	"sym-ngn-s": "f68d",
    	"sym-ngn": "f68e",
    	"sym-nim-s": "f68f",
    	"sym-nim": "f690",
    	"sym-niy-s": "f691",
    	"sym-niy": "f692",
    	"sym-nkd-s": "f693",
    	"sym-nkd": "f694",
    	"sym-nkn-s": "f695",
    	"sym-nkn": "f696",
    	"sym-nlc2-s": "f697",
    	"sym-nlc2": "f698",
    	"sym-nlg-s": "f699",
    	"sym-nlg": "f69a",
    	"sym-nmc-s": "f69b",
    	"sym-nmc": "f69c",
    	"sym-nmr-s": "f69d",
    	"sym-nmr": "f69e",
    	"sym-nn-s": "f69f",
    	"sym-nn": "f6a0",
    	"sym-noah-s": "f6a1",
    	"sym-noah": "f6a2",
    	"sym-nodl-s": "f6a3",
    	"sym-nodl": "f6a4",
    	"sym-note-s": "f6a5",
    	"sym-note": "f6a6",
    	"sym-npg-s": "f6a7",
    	"sym-npg": "f6a8",
    	"sym-nplc-s": "f6a9",
    	"sym-nplc": "f6aa",
    	"sym-npxs-s": "f6ab",
    	"sym-npxs": "f6ac",
    	"sym-nq-s": "f6ad",
    	"sym-nq": "f6ae",
    	"sym-nrg-s": "f6af",
    	"sym-nrg": "f6b0",
    	"sym-ntk-s": "f6b1",
    	"sym-ntk": "f6b2",
    	"sym-nu-s": "f6b3",
    	"sym-nu": "f6b4",
    	"sym-nuls-s": "f6b5",
    	"sym-nuls": "f6b6",
    	"sym-nvc-s": "f6b7",
    	"sym-nvc": "f6b8",
    	"sym-nxc-s": "f6b9",
    	"sym-nxc": "f6ba",
    	"sym-nxs-s": "f6bb",
    	"sym-nxs": "f6bc",
    	"sym-nxt-s": "f6bd",
    	"sym-nxt": "f6be",
    	"sym-nym-s": "f6bf",
    	"sym-nym": "f6c0",
    	"sym-o-s": "f6c1",
    	"sym-o": "f6c2",
    	"sym-oax-s": "f6c3",
    	"sym-oax": "f6c4",
    	"sym-ocean-s": "f6c5",
    	"sym-ocean": "f6c6",
    	"sym-ocn-s": "f6c7",
    	"sym-ocn": "f6c8",
    	"sym-ode-s": "f6c9",
    	"sym-ode": "f6ca",
    	"sym-ogn-s": "f6cb",
    	"sym-ogn": "f6cc",
    	"sym-ogo-s": "f6cd",
    	"sym-ogo": "f6ce",
    	"sym-ok-s": "f6cf",
    	"sym-ok": "f6d0",
    	"sym-okb-s": "f6d1",
    	"sym-okb": "f6d2",
    	"sym-om-s": "f6d3",
    	"sym-om": "f6d4",
    	"sym-omg-s": "f6d5",
    	"sym-omg": "f6d6",
    	"sym-omni-s": "f6d7",
    	"sym-omni": "f6d8",
    	"sym-one-s": "f6d9",
    	"sym-one": "f6da",
    	"sym-ong-s": "f6db",
    	"sym-ong": "f6dc",
    	"sym-onot-s": "f6dd",
    	"sym-onot": "f6de",
    	"sym-ont-s": "f6df",
    	"sym-ont": "f6e0",
    	"sym-ooki-s": "f6e1",
    	"sym-ooki": "f6e2",
    	"sym-orbs-s": "f6e3",
    	"sym-orbs": "f6e4",
    	"sym-orca-s": "f6e5",
    	"sym-orca": "f6e6",
    	"sym-orme-s": "f6e7",
    	"sym-orme": "f6e8",
    	"sym-orn-s": "f6e9",
    	"sym-orn": "f6ea",
    	"sym-ors-s": "f6eb",
    	"sym-ors": "f6ec",
    	"sym-osmo-s": "f6ed",
    	"sym-osmo": "f6ee",
    	"sym-ost-s": "f6ef",
    	"sym-ost": "f6f0",
    	"sym-otn-s": "f6f1",
    	"sym-otn": "f6f2",
    	"sym-oxt-s": "f6f3",
    	"sym-oxt": "f6f4",
    	"sym-oxy-s": "f6f5",
    	"sym-oxy": "f6f6",
    	"sym-pai-s": "f6f7",
    	"sym-pai": "f6f8",
    	"sym-pal-s": "f6f9",
    	"sym-pal": "f6fa",
    	"sym-paper-s": "f6fb",
    	"sym-paper": "f6fc",
    	"sym-para-s": "f6fd",
    	"sym-para": "f6fe",
    	"sym-part-s": "f6ff",
    	"sym-part": "f700",
    	"sym-pasc-s": "f701",
    	"sym-pasc": "f702",
    	"sym-pat-s": "f703",
    	"sym-pat": "f704",
    	"sym-pax-s": "f705",
    	"sym-pax": "f706",
    	"sym-paxg-s": "f707",
    	"sym-paxg": "f708",
    	"sym-pay-s": "f709",
    	"sym-pay": "f70a",
    	"sym-pbt-s": "f70b",
    	"sym-pbt": "f70c",
    	"sym-pcl-s": "f70d",
    	"sym-pcl": "f70e",
    	"sym-pcx-s": "f70f",
    	"sym-pcx": "f710",
    	"sym-pdex-s": "f711",
    	"sym-pdex": "f712",
    	"sym-people-s": "f713",
    	"sym-people": "f714",
    	"sym-perl-s": "f715",
    	"sym-perl": "f716",
    	"sym-perp-s": "f717",
    	"sym-perp": "f718",
    	"sym-pha-s": "f719",
    	"sym-pha": "f71a",
    	"sym-phb-s": "f71b",
    	"sym-phb": "f71c",
    	"sym-php-s": "f71d",
    	"sym-php": "f71e",
    	"sym-phx-s": "f71f",
    	"sym-phx": "f720",
    	"sym-pi-s": "f721",
    	"sym-pi": "f722",
    	"sym-pica-s": "f723",
    	"sym-pica": "f724",
    	"sym-pink-s": "f725",
    	"sym-pink": "f726",
    	"sym-pivx-s": "f727",
    	"sym-pivx": "f728",
    	"sym-pkt-s": "f729",
    	"sym-pkt": "f72a",
    	"sym-pl-s": "f72b",
    	"sym-pl": "f72c",
    	"sym-pla-s": "f72d",
    	"sym-pla": "f72e",
    	"sym-plbt-s": "f72f",
    	"sym-plbt": "f730",
    	"sym-plm-s": "f731",
    	"sym-plm": "f732",
    	"sym-pln-s": "f733",
    	"sym-pln": "f734",
    	"sym-plr-s": "f735",
    	"sym-plr": "f736",
    	"sym-ply-s": "f737",
    	"sym-ply": "f738",
    	"sym-pma-s": "f739",
    	"sym-pma": "f73a",
    	"sym-png-s": "f73b",
    	"sym-png": "f73c",
    	"sym-pnt-s": "f73d",
    	"sym-pnt": "f73e",
    	"sym-poa-s": "f73f",
    	"sym-poa": "f740",
    	"sym-poe-s": "f741",
    	"sym-poe": "f742",
    	"sym-polis-s": "f743",
    	"sym-polis": "f744",
    	"sym-pols-s": "f745",
    	"sym-pols": "f746",
    	"sym-poly-s": "f747",
    	"sym-poly": "f748",
    	"sym-pond-s": "f749",
    	"sym-pond": "f74a",
    	"sym-pot-s": "f74b",
    	"sym-pot": "f74c",
    	"sym-powr-s": "f74d",
    	"sym-powr": "f74e",
    	"sym-ppc-s": "f74f",
    	"sym-ppc": "f750",
    	"sym-ppt-s": "f751",
    	"sym-ppt": "f752",
    	"sym-pra-s": "f753",
    	"sym-pra": "f754",
    	"sym-pre-s": "f755",
    	"sym-pre": "f756",
    	"sym-prg-s": "f757",
    	"sym-prg": "f758",
    	"sym-pro-s": "f759",
    	"sym-pro": "f75a",
    	"sym-prq-s": "f75b",
    	"sym-prq": "f75c",
    	"sym-pst-s": "f75d",
    	"sym-pst": "f75e",
    	"sym-pstake-s": "f75f",
    	"sym-pstake": "f760",
    	"sym-pton-s": "f761",
    	"sym-pton": "f762",
    	"sym-pundix-s": "f763",
    	"sym-pundix": "f764",
    	"sym-pvt-s": "f765",
    	"sym-pvt": "f766",
    	"sym-pxg-s": "f767",
    	"sym-pxg": "f768",
    	"sym-pyr-s": "f769",
    	"sym-pyr": "f76a",
    	"sym-qash-s": "f76b",
    	"sym-qash": "f76c",
    	"sym-qau-s": "f76d",
    	"sym-qau": "f76e",
    	"sym-qc-s": "f76f",
    	"sym-qc": "f770",
    	"sym-qi-s": "f771",
    	"sym-qi": "f772",
    	"sym-qi2-s": "f773",
    	"sym-qi2": "f774",
    	"sym-qkc-s": "f775",
    	"sym-qkc": "f776",
    	"sym-qlc-s": "f777",
    	"sym-qlc": "f778",
    	"sym-qnt-s": "f779",
    	"sym-qnt": "f77a",
    	"sym-qntu-s": "f77b",
    	"sym-qntu": "f77c",
    	"sym-qo-s": "f77d",
    	"sym-qo": "f77e",
    	"sym-qrdo-s": "f77f",
    	"sym-qrdo": "f780",
    	"sym-qrl-s": "f781",
    	"sym-qrl": "f782",
    	"sym-qsp-s": "f783",
    	"sym-qsp": "f784",
    	"sym-qtum-s": "f785",
    	"sym-qtum": "f786",
    	"sym-quick-s": "f787",
    	"sym-quick": "f788",
    	"sym-qun-s": "f789",
    	"sym-qun": "f78a",
    	"sym-r-s": "f78b",
    	"sym-r": "f78c",
    	"sym-rad-s": "f78d",
    	"sym-rad": "f78e",
    	"sym-radar-s": "f78f",
    	"sym-radar": "f790",
    	"sym-rads-s": "f791",
    	"sym-rads": "f792",
    	"sym-ramp-s": "f793",
    	"sym-ramp": "f794",
    	"sym-rare-s": "f795",
    	"sym-rare": "f796",
    	"sym-rari-s": "f797",
    	"sym-rari": "f798",
    	"sym-rating-s": "f799",
    	"sym-rating": "f79a",
    	"sym-ray-s": "f79b",
    	"sym-ray": "f79c",
    	"sym-rb-s": "f79d",
    	"sym-rb": "f79e",
    	"sym-rbc-s": "f79f",
    	"sym-rbc": "f7a0",
    	"sym-rblx-s": "f7a1",
    	"sym-rblx": "f7a2",
    	"sym-rbn-s": "f7a3",
    	"sym-rbn": "f7a4",
    	"sym-rbtc-s": "f7a5",
    	"sym-rbtc": "f7a6",
    	"sym-rby-s": "f7a7",
    	"sym-rby": "f7a8",
    	"sym-rcn-s": "f7a9",
    	"sym-rcn": "f7aa",
    	"sym-rdd-s": "f7ab",
    	"sym-rdd": "f7ac",
    	"sym-rdn-s": "f7ad",
    	"sym-rdn": "f7ae",
    	"sym-real-s": "f7af",
    	"sym-real": "f7b0",
    	"sym-reef-s": "f7b1",
    	"sym-reef": "f7b2",
    	"sym-rem-s": "f7b3",
    	"sym-rem": "f7b4",
    	"sym-ren-s": "f7b5",
    	"sym-ren": "f7b6",
    	"sym-rep-s": "f7b7",
    	"sym-rep": "f7b8",
    	"sym-repv2-s": "f7b9",
    	"sym-repv2": "f7ba",
    	"sym-req-s": "f7bb",
    	"sym-req": "f7bc",
    	"sym-rev-s": "f7bd",
    	"sym-rev": "f7be",
    	"sym-revv-s": "f7bf",
    	"sym-revv": "f7c0",
    	"sym-rfox-s": "f7c1",
    	"sym-rfox": "f7c2",
    	"sym-rfr-s": "f7c3",
    	"sym-rfr": "f7c4",
    	"sym-ric-s": "f7c5",
    	"sym-ric": "f7c6",
    	"sym-rif-s": "f7c7",
    	"sym-rif": "f7c8",
    	"sym-ring-s": "f7c9",
    	"sym-ring": "f7ca",
    	"sym-rlc-s": "f7cb",
    	"sym-rlc": "f7cc",
    	"sym-rly-s": "f7cd",
    	"sym-rly": "f7ce",
    	"sym-rmrk-s": "f7cf",
    	"sym-rmrk": "f7d0",
    	"sym-rndr-s": "f7d1",
    	"sym-rndr": "f7d2",
    	"sym-rntb-s": "f7d3",
    	"sym-rntb": "f7d4",
    	"sym-ron-s": "f7d5",
    	"sym-ron": "f7d6",
    	"sym-rook-s": "f7d7",
    	"sym-rook": "f7d8",
    	"sym-rose-s": "f7d9",
    	"sym-rose": "f7da",
    	"sym-rox-s": "f7db",
    	"sym-rox": "f7dc",
    	"sym-rp-s": "f7dd",
    	"sym-rp": "f7de",
    	"sym-rpx-s": "f7df",
    	"sym-rpx": "f7e0",
    	"sym-rsr-s": "f7e1",
    	"sym-rsr": "f7e2",
    	"sym-rsv-s": "f7e3",
    	"sym-rsv": "f7e4",
    	"sym-rty-s": "f7e5",
    	"sym-rty": "f7e6",
    	"sym-rub-s": "f7e7",
    	"sym-rub": "f7e8",
    	"sym-ruff-s": "f7e9",
    	"sym-ruff": "f7ea",
    	"sym-rune-s": "f7eb",
    	"sym-rune": "f7ec",
    	"sym-rvn-s": "f7ed",
    	"sym-rvn": "f7ee",
    	"sym-rvr-s": "f7ef",
    	"sym-rvr": "f7f0",
    	"sym-rvt-s": "f7f1",
    	"sym-rvt": "f7f2",
    	"sym-sai-s": "f7f3",
    	"sym-sai": "f7f4",
    	"sym-salt-s": "f7f5",
    	"sym-salt": "f7f6",
    	"sym-samo-s": "f7f7",
    	"sym-samo": "f7f8",
    	"sym-san-s": "f7f9",
    	"sym-san": "f7fa",
    	"sym-sand-s": "f7fb",
    	"sym-sand": "f7fc",
    	"sym-sats-s": "f7fd",
    	"sym-sats": "f7fe",
    	"sym-sbd-s": "f7ff",
    	"sym-sbd": "f800",
    	"sym-sbr-s": "f801",
    	"sym-sbr": "f802",
    	"sym-sc-s": "f803",
    	"sym-sc": "f804",
    	"sym-scc-s": "f805",
    	"sym-scc": "f806",
    	"sym-scrt-s": "f807",
    	"sym-scrt": "f808",
    	"sym-sdc-s": "f809",
    	"sym-sdc": "f80a",
    	"sym-sdn-s": "f80b",
    	"sym-sdn": "f80c",
    	"sym-seele-s": "f80d",
    	"sym-seele": "f80e",
    	"sym-sek-s": "f80f",
    	"sym-sek": "f810",
    	"sym-sen-s": "f811",
    	"sym-sen": "f812",
    	"sym-sent-s": "f813",
    	"sym-sent": "f814",
    	"sym-sero-s": "f815",
    	"sym-sero": "f816",
    	"sym-sexc-s": "f817",
    	"sym-sexc": "f818",
    	"sym-sfp-s": "f819",
    	"sym-sfp": "f81a",
    	"sym-sgb-s": "f81b",
    	"sym-sgb": "f81c",
    	"sym-sgc-s": "f81d",
    	"sym-sgc": "f81e",
    	"sym-sgd-s": "f81f",
    	"sym-sgd": "f820",
    	"sym-sgn-s": "f821",
    	"sym-sgn": "f822",
    	"sym-sgu-s": "f823",
    	"sym-sgu": "f824",
    	"sym-shib-s": "f825",
    	"sym-shib": "f826",
    	"sym-shift-s": "f827",
    	"sym-shift": "f828",
    	"sym-ship-s": "f829",
    	"sym-ship": "f82a",
    	"sym-shping-s": "f82b",
    	"sym-shping": "f82c",
    	"sym-si-s": "f82d",
    	"sym-si": "f82e",
    	"sym-sib-s": "f82f",
    	"sym-sib": "f830",
    	"sym-sil-s": "f831",
    	"sym-sil": "f832",
    	"sym-six-s": "f833",
    	"sym-six": "f834",
    	"sym-sjcx-s": "f835",
    	"sym-sjcx": "f836",
    	"sym-skl-s": "f837",
    	"sym-skl": "f838",
    	"sym-skm-s": "f839",
    	"sym-skm": "f83a",
    	"sym-sku-s": "f83b",
    	"sym-sku": "f83c",
    	"sym-sky-s": "f83d",
    	"sym-sky": "f83e",
    	"sym-slp-s": "f83f",
    	"sym-slp": "f840",
    	"sym-slr-s": "f841",
    	"sym-slr": "f842",
    	"sym-sls-s": "f843",
    	"sym-sls": "f844",
    	"sym-slt-s": "f845",
    	"sym-slt": "f846",
    	"sym-slv-s": "f847",
    	"sym-slv": "f848",
    	"sym-smart-s": "f849",
    	"sym-smart": "f84a",
    	"sym-smn-s": "f84b",
    	"sym-smn": "f84c",
    	"sym-smt-s": "f84d",
    	"sym-smt": "f84e",
    	"sym-snc-s": "f84f",
    	"sym-snc": "f850",
    	"sym-snet-s": "f851",
    	"sym-snet": "f852",
    	"sym-sngls-s": "f853",
    	"sym-sngls": "f854",
    	"sym-snm-s": "f855",
    	"sym-snm": "f856",
    	"sym-snt-s": "f857",
    	"sym-snt": "f858",
    	"sym-snx-s": "f859",
    	"sym-snx": "f85a",
    	"sym-soc-s": "f85b",
    	"sym-soc": "f85c",
    	"sym-socks-s": "f85d",
    	"sym-socks": "f85e",
    	"sym-sol-s": "f85f",
    	"sym-sol": "f860",
    	"sym-solid-s": "f861",
    	"sym-solid": "f862",
    	"sym-solo-s": "f863",
    	"sym-solo": "f864",
    	"sym-solve-s": "f865",
    	"sym-solve": "f866",
    	"sym-sos-s": "f867",
    	"sym-sos": "f868",
    	"sym-soul-s": "f869",
    	"sym-soul": "f86a",
    	"sym-sp-s": "f86b",
    	"sym-sp": "f86c",
    	"sym-sparta-s": "f86d",
    	"sym-sparta": "f86e",
    	"sym-spc-s": "f86f",
    	"sym-spc": "f870",
    	"sym-spd-s": "f871",
    	"sym-spd": "f872",
    	"sym-spell-s": "f873",
    	"sym-spell": "f874",
    	"sym-sphr-s": "f875",
    	"sym-sphr": "f876",
    	"sym-sphtx-s": "f877",
    	"sym-sphtx": "f878",
    	"sym-spnd-s": "f879",
    	"sym-spnd": "f87a",
    	"sym-spnk-s": "f87b",
    	"sym-spnk": "f87c",
    	"sym-srm-s": "f87d",
    	"sym-srm": "f87e",
    	"sym-srn-s": "f87f",
    	"sym-srn": "f880",
    	"sym-ssp-s": "f881",
    	"sym-ssp": "f882",
    	"sym-stacs-s": "f883",
    	"sym-stacs": "f884",
    	"sym-step-s": "f885",
    	"sym-step": "f886",
    	"sym-stg-s": "f887",
    	"sym-stg": "f888",
    	"sym-stmx-s": "f889",
    	"sym-stmx": "f88a",
    	"sym-storm-s": "f88b",
    	"sym-storm": "f88c",
    	"sym-stpt-s": "f88d",
    	"sym-stpt": "f88e",
    	"sym-stq-s": "f88f",
    	"sym-stq": "f890",
    	"sym-str-s": "f891",
    	"sym-str": "f892",
    	"sym-strat-s": "f893",
    	"sym-strat": "f894",
    	"sym-strax-s": "f895",
    	"sym-strax": "f896",
    	"sym-strk-s": "f897",
    	"sym-strk": "f898",
    	"sym-strong-s": "f899",
    	"sym-strong": "f89a",
    	"sym-stx-s": "f89b",
    	"sym-stx": "f89c",
    	"sym-sub-s": "f89d",
    	"sym-sub": "f89e",
    	"sym-sun-s": "f89f",
    	"sym-sun": "f8a0",
    	"sym-super-s": "f8a1",
    	"sym-super": "f8a2",
    	"sym-susd-s": "f8a3",
    	"sym-susd": "f8a4",
    	"sym-sushi-s": "f8a5",
    	"sym-sushi": "f8a6",
    	"sym-swftc-s": "f8a7",
    	"sym-swftc": "f8a8",
    	"sym-swm-s": "f8a9",
    	"sym-swm": "f8aa",
    	"sym-swrv-s": "f8ab",
    	"sym-swrv": "f8ac",
    	"sym-swt-s": "f8ad",
    	"sym-swt": "f8ae",
    	"sym-swth-s": "f8af",
    	"sym-swth": "f8b0",
    	"sym-sxp-s": "f8b1",
    	"sym-sxp": "f8b2",
    	"sym-syn-s": "f8b3",
    	"sym-syn": "f8b4",
    	"sym-sys-s": "f8b5",
    	"sym-sys": "f8b6",
    	"sym-t-s": "f8b7",
    	"sym-t": "f8b8",
    	"sym-taas-s": "f8b9",
    	"sym-taas": "f8ba",
    	"sym-tau-s": "f8bb",
    	"sym-tau": "f8bc",
    	"sym-tbtc-s": "f8bd",
    	"sym-tbtc": "f8be",
    	"sym-tct-s": "f8bf",
    	"sym-tct": "f8c0",
    	"sym-teer-s": "f8c1",
    	"sym-teer": "f8c2",
    	"sym-tel-s": "f8c3",
    	"sym-temco-s": "f8c4",
    	"sym-temco": "f8c5",
    	"sym-tfuel-s": "f8c6",
    	"sym-tfuel": "f8c7",
    	"sym-thb-s": "f8c8",
    	"sym-thb": "f8c9",
    	"sym-thc-s": "f8ca",
    	"sym-thc": "f8cb",
    	"sym-theta-s": "f8cc",
    	"sym-theta": "f8cd",
    	"sym-thx-s": "f8ce",
    	"sym-thx": "f8cf",
    	"sym-time-s": "f8d0",
    	"sym-time": "f8d1",
    	"sym-tio-s": "f8d2",
    	"sym-tio": "f8d3",
    	"sym-tix-s": "f8d4",
    	"sym-tix": "f8d5",
    	"sym-tkn-s": "f8d6",
    	"sym-tkn": "f8d7",
    	"sym-tky-s": "f8d8",
    	"sym-tky": "f8d9",
    	"sym-tlm-s": "f8da",
    	"sym-tlm": "f8db",
    	"sym-tnb-s": "f8dc",
    	"sym-tnb": "f8dd",
    	"sym-tnc-s": "f8de",
    	"sym-tnc": "f8df",
    	"sym-tnt-s": "f8e0",
    	"sym-tnt": "f8e1",
    	"sym-toke-s": "f8e2",
    	"sym-toke": "f8e3",
    	"sym-tomb-s": "f8e4",
    	"sym-tomb": "f8e5",
    	"sym-tomo-s": "f8e6",
    	"sym-tomo": "f8e7",
    	"sym-top-s": "f8e8",
    	"sym-top": "f8e9",
    	"sym-torn-s": "f8ea",
    	"sym-torn": "f8eb",
    	"sym-tower-s": "f8ec",
    	"sym-tower": "f8ed",
    	"sym-tpay-s": "f8ee",
    	"sym-tpay": "f8ef",
    	"sym-trac-s": "f8f0",
    	"sym-trac": "f8f1",
    	"sym-trb-s": "f8f2",
    	"sym-trb": "f8f3",
    	"sym-tribe-s": "f8f4",
    	"sym-tribe": "f8f5",
    	"sym-trig-s": "f8f6",
    	"sym-trig": "f8f7",
    	"sym-trio-s": "f8f8",
    	"sym-trio": "f8f9",
    	"sym-troy-s": "f8fa",
    	"sym-troy": "f8fb",
    	"sym-trst-s": "f8fc",
    	"sym-trst": "f8fd",
    	"sym-tru-s": "f8fe",
    	"sym-tru": "f8ff",
    	"sym-true-s": "f900",
    	"sym-true": "f901",
    	"sym-trx-s": "f902",
    	"sym-trx": "f903",
    	"sym-try-s": "f904",
    	"sym-try": "f905",
    	"sym-tryb-s": "f906",
    	"sym-tryb": "f907",
    	"sym-tt-s": "f908",
    	"sym-tt": "f909",
    	"sym-ttc-s": "f90a",
    	"sym-ttc": "f90b",
    	"sym-ttt-s": "f90c",
    	"sym-ttt": "f90d",
    	"sym-ttu-s": "f90e",
    	"sym-ttu": "f90f",
    	"sym-tube-s": "f910",
    	"sym-tube": "f911",
    	"sym-tusd-s": "f912",
    	"sym-tusd": "f913",
    	"sym-tvk-s": "f914",
    	"sym-tvk": "f915",
    	"sym-twt-s": "f916",
    	"sym-twt": "f917",
    	"sym-uah-s": "f918",
    	"sym-uah": "f919",
    	"sym-ubq-s": "f91a",
    	"sym-ubq": "f91b",
    	"sym-ubt-s": "f91c",
    	"sym-ubt": "f91d",
    	"sym-uft-s": "f91e",
    	"sym-uft": "f91f",
    	"sym-ugas-s": "f920",
    	"sym-ugas": "f921",
    	"sym-uip-s": "f922",
    	"sym-uip": "f923",
    	"sym-ukg-s": "f924",
    	"sym-ukg": "f925",
    	"sym-uma-s": "f926",
    	"sym-uma": "f927",
    	"sym-unfi-s": "f928",
    	"sym-unfi": "f929",
    	"sym-uni-s": "f92a",
    	"sym-uni": "f92b",
    	"sym-unq-s": "f92c",
    	"sym-unq": "f92d",
    	"sym-up-s": "f92e",
    	"sym-up": "f92f",
    	"sym-upp-s": "f930",
    	"sym-upp": "f931",
    	"sym-usd-s": "f932",
    	"sym-usd": "f933",
    	"sym-usdc-s": "f934",
    	"sym-usdc": "f935",
    	"sym-usds-s": "f936",
    	"sym-usds": "f937",
    	"sym-usk-s": "f938",
    	"sym-usk": "f939",
    	"sym-ust-s": "f93a",
    	"sym-ust": "f93b",
    	"sym-utk-s": "f93c",
    	"sym-utk": "f93d",
    	"sym-utnp-s": "f93e",
    	"sym-utnp": "f93f",
    	"sym-utt-s": "f940",
    	"sym-utt": "f941",
    	"sym-uuu-s": "f942",
    	"sym-uuu": "f943",
    	"sym-ux-s": "f944",
    	"sym-ux": "f945",
    	"sym-vader-s": "f946",
    	"sym-vader": "f947",
    	"sym-vai-s": "f948",
    	"sym-vai": "f949",
    	"sym-vbk-s": "f94a",
    	"sym-vbk": "f94b",
    	"sym-vdx-s": "f94c",
    	"sym-vdx": "f94d",
    	"sym-vee-s": "f94e",
    	"sym-vee": "f94f",
    	"sym-vemp-s": "f950",
    	"sym-vemp": "f951",
    	"sym-ven-s": "f952",
    	"sym-ven": "f953",
    	"sym-veo-s": "f954",
    	"sym-veo": "f955",
    	"sym-veri-s": "f956",
    	"sym-veri": "f957",
    	"sym-vex-s": "f958",
    	"sym-vex": "f959",
    	"sym-vgx-s": "f95a",
    	"sym-vgx": "f95b",
    	"sym-via-s": "f95c",
    	"sym-via": "f95d",
    	"sym-vib-s": "f95e",
    	"sym-vib": "f95f",
    	"sym-vibe-s": "f960",
    	"sym-vibe": "f961",
    	"sym-vid-s": "f962",
    	"sym-vid": "f963",
    	"sym-vidt-s": "f964",
    	"sym-vidt": "f965",
    	"sym-vidy-s": "f966",
    	"sym-vidy": "f967",
    	"sym-vitae-s": "f968",
    	"sym-vitae": "f969",
    	"sym-vite-s": "f96a",
    	"sym-vite": "f96b",
    	"sym-vlx-s": "f96c",
    	"sym-vlx": "f96d",
    	"sym-vox-s": "f96e",
    	"sym-vox": "f96f",
    	"sym-voxel-s": "f970",
    	"sym-voxel": "f971",
    	"sym-vra-s": "f972",
    	"sym-vra": "f973",
    	"sym-vrc-s": "f974",
    	"sym-vrc": "f975",
    	"sym-vrm-s": "f976",
    	"sym-vrm": "f977",
    	"sym-vsys-s": "f978",
    	"sym-vsys": "f979",
    	"sym-vtc-s": "f97a",
    	"sym-vtc": "f97b",
    	"sym-vtho-s": "f97c",
    	"sym-vtho": "f97d",
    	"sym-wabi-s": "f97e",
    	"sym-wabi": "f97f",
    	"sym-wan-s": "f980",
    	"sym-wan": "f981",
    	"sym-waves-s": "f982",
    	"sym-waves": "f983",
    	"sym-wax-s": "f984",
    	"sym-wax": "f985",
    	"sym-wbtc-s": "f986",
    	"sym-wbtc": "f987",
    	"sym-wet-s": "f988",
    	"sym-wet": "f989",
    	"sym-weth-s": "f98a",
    	"sym-weth": "f98b",
    	"sym-wib-s": "f98c",
    	"sym-wib": "f98d",
    	"sym-wicc-s": "f98e",
    	"sym-wicc": "f98f",
    	"sym-win-s": "f990",
    	"sym-win": "f991",
    	"sym-wing-s": "f992",
    	"sym-wing": "f993",
    	"sym-wings-s": "f994",
    	"sym-wings": "f995",
    	"sym-wnxm-s": "f996",
    	"sym-wnxm": "f997",
    	"sym-woo-s": "f998",
    	"sym-woo": "f999",
    	"sym-wpr-s": "f99a",
    	"sym-wpr": "f99b",
    	"sym-wrx-s": "f99c",
    	"sym-wrx": "f99d",
    	"sym-wtc-s": "f99e",
    	"sym-wtc": "f99f",
    	"sym-wtt-s": "f9a0",
    	"sym-wtt": "f9a1",
    	"sym-wwb-s": "f9a2",
    	"sym-wwb": "f9a3",
    	"sym-wxt-s": "f9a4",
    	"sym-wxt": "f9a5",
    	"sym-xas-s": "f9a6",
    	"sym-xas": "f9a7",
    	"sym-xaur-s": "f9a8",
    	"sym-xaur": "f9a9",
    	"sym-xaut-s": "f9aa",
    	"sym-xaut": "f9ab",
    	"sym-xava-s": "f9ac",
    	"sym-xava": "f9ad",
    	"sym-xbc-s": "f9ae",
    	"sym-xbc": "f9af",
    	"sym-xcn-s": "f9b0",
    	"sym-xcn": "f9b1",
    	"sym-xcon-s": "f9b2",
    	"sym-xcon": "f9b3",
    	"sym-xcp-s": "f9b4",
    	"sym-xcp": "f9b5",
    	"sym-xdefi-s": "f9b6",
    	"sym-xdefi": "f9b7",
    	"sym-xdn-s": "f9b8",
    	"sym-xdn": "f9b9",
    	"sym-xel-s": "f9ba",
    	"sym-xel": "f9bb",
    	"sym-xem-s": "f9bc",
    	"sym-xem": "f9bd",
    	"sym-xes-s": "f9be",
    	"sym-xes": "f9bf",
    	"sym-xhv-s": "f9c0",
    	"sym-xhv": "f9c1",
    	"sym-xin-s": "f9c2",
    	"sym-xin": "f9c3",
    	"sym-xlm-s": "f9c4",
    	"sym-xlm": "f9c5",
    	"sym-xmc-s": "f9c6",
    	"sym-xmc": "f9c7",
    	"sym-xmr-s": "f9c8",
    	"sym-xmr": "f9c9",
    	"sym-xmx-s": "f9ca",
    	"sym-xmx": "f9cb",
    	"sym-xmy-s": "f9cc",
    	"sym-xmy": "f9cd",
    	"sym-xnk-s": "f9ce",
    	"sym-xnk": "f9cf",
    	"sym-xns-s": "f9d0",
    	"sym-xns": "f9d1",
    	"sym-xor-s": "f9d2",
    	"sym-xor": "f9d3",
    	"sym-xos-s": "f9d4",
    	"sym-xos": "f9d5",
    	"sym-xpm-s": "f9d6",
    	"sym-xpm": "f9d7",
    	"sym-xpr-s": "f9d8",
    	"sym-xpr": "f9d9",
    	"sym-xrc-s": "f9da",
    	"sym-xrc": "f9db",
    	"sym-xrp-s": "f9dc",
    	"sym-xrp": "f9dd",
    	"sym-xrpx-s": "f9de",
    	"sym-xrpx": "f9df",
    	"sym-xrt-s": "f9e0",
    	"sym-xrt": "f9e1",
    	"sym-xst-s": "f9e2",
    	"sym-xst": "f9e3",
    	"sym-xtp-s": "f9e4",
    	"sym-xtp": "f9e5",
    	"sym-xtz-s": "f9e6",
    	"sym-xtz": "f9e7",
    	"sym-xtzdown-s": "f9e8",
    	"sym-xtzdown": "f9e9",
    	"sym-xvc-s": "f9ea",
    	"sym-xvc": "f9eb",
    	"sym-xvg-s": "f9ec",
    	"sym-xvg": "f9ed",
    	"sym-xvs-s": "f9ee",
    	"sym-xvs": "f9ef",
    	"sym-xwc-s": "f9f0",
    	"sym-xwc": "f9f1",
    	"sym-xyo-s": "f9f2",
    	"sym-xyo": "f9f3",
    	"sym-xzc-s": "f9f4",
    	"sym-xzc": "f9f5",
    	"sym-yam-s": "f9f6",
    	"sym-yam": "f9f7",
    	"sym-yee-s": "f9f8",
    	"sym-yee": "f9f9",
    	"sym-yeed-s": "f9fa",
    	"sym-yeed": "f9fb",
    	"sym-yfi-s": "f9fc",
    	"sym-yfi": "f9fd",
    	"sym-yfii-s": "f9fe",
    	"sym-yfii": "f9ff",
    	"sym-ygg-s": "fa00",
    	"sym-ygg": "fa01",
    	"sym-yoyow-s": "fa02",
    	"sym-yoyow": "fa03",
    	"sym-zar-s": "fa04",
    	"sym-zar": "fa05",
    	"sym-zcl-s": "fa06",
    	"sym-zcl": "fa07",
    	"sym-zcn-s": "fa08",
    	"sym-zcn": "fa09",
    	"sym-zco-s": "fa0a",
    	"sym-zco": "fa0b",
    	"sym-zec-s": "fa0c",
    	"sym-zec": "fa0d",
    	"sym-zen-s": "fa0e",
    	"sym-zen": "fa0f",
    	"sym-zil-s": "fa10",
    	"sym-zil": "fa11",
    	"sym-zks-s": "fa12",
    	"sym-zks": "fa13",
    	"sym-zla-s": "fa14",
    	"sym-zla": "fa15",
    	"sym-zlk": "fa16",
    	"sym-zondo-s": "fa17",
    	"sym-zondo": "fa18",
    	"sym-zpr-s": "fa19",
    	"sym-zpr": "fa1a",
    	"sym-zpt-s": "fa1b",
    	"sym-zpt": "fa1c",
    	"sym-zrc-s": "fa1d",
    	"sym-zrc": "fa1e",
    	"sym-zrx-s": "fa1f",
    	"sym-zrx": "fa20",
    	"sym-zsc-s": "fa21",
    	"sym-zsc": "fa22",
    	"sym-ztg-s": "fa23",
    	"sym-ztg": "fa24",
    	"ustc-s": "fa25",
    	ustc: ustc,
    	"cur-anct": "f1d2",
    	"cur-anct-s": "f1d1",
    	"cur-aud": "f200",
    	"cur-aud-s": "f1ff",
    	"cur-bnb": "f271",
    	"cur-bnb-s": "f270",
    	"sym-xbt": "f29b",
    	"cur-btc": "f29b",
    	"sym-xbt-s": "f29a",
    	"cur-btc-s": "f29a",
    	"cur-busd": "f2bb",
    	"cur-busd-s": "f2ba",
    	"exc-bitz": "f2bf",
    	"cur-bz": "f2bf",
    	"exc-bitz-s": "f2be",
    	"cur-bz-s": "f2be",
    	"cur-cad": "f2c9",
    	"cur-cad-s": "f2c8",
    	"cur-chf": "f2e9",
    	"cur-chf-s": "f2e8",
    	"cur-cny": "f30d",
    	"cur-cny-s": "f30c",
    	"sym-cs": "f321",
    	"sym-cs-s": "f320",
    	"sym-crm": "f339",
    	"sym-crm-s": "f338",
    	"cur-dai": "f367",
    	"cur-dai-s": "f366",
    	"sym-xdg": "f3a5",
    	"sym-xdg-s": "f3a4",
    	"cur-eos": "f3f2",
    	"cur-eos-s": "f3f1",
    	"sym-eth2": "f402",
    	"sym-eth2s": "f402",
    	"sym-eth2.s": "f402",
    	"cur-eth": "f402",
    	"sym-eth2-s": "f401",
    	"sym-eth2s-s": "f401",
    	"sym-eth2.s-s": "f401",
    	"cur-eth-s": "f401",
    	"cur-eur": "f40a",
    	"cur-eur-s": "f409",
    	"cur-eurs": "f40c",
    	"cur-eurs-s": "f40b",
    	"sym-usdt": "f40e",
    	"cur-usdt": "f40e",
    	"sym-usdt-s": "f40d",
    	"cur-usdt-s": "f40d",
    	"exc-kraken": "f426",
    	"exc-kraken-futures": "f426",
    	"exc-kraken-s": "f425",
    	"exc-kraken-futures-s": "f425",
    	"cur-gbp": "f47a",
    	"cur-gbp-s": "f479",
    	"exc-gemini": "f4c2",
    	"cur-gusd": "f4c2",
    	"exc-gemini-s": "f4c1",
    	"cur-gusd-s": "f4c1",
    	"cur-hkd": "f4e6",
    	"cur-hkd-s": "f4e5",
    	"sym-husd": "f502",
    	"exc-huobi": "f502",
    	"cur-ht": "f502",
    	"sym-husd-s": "f501",
    	"exc-huobi-s": "f501",
    	"cur-ht-s": "f501",
    	"cur-idr": "f522",
    	"cur-idr-s": "f521",
    	"sym-iota": "f54a",
    	"sym-iota-s": "f549",
    	"cur-inr": "f53c",
    	"cur-inr-s": "f53b",
    	"cur-jpy": "f560",
    	"cur-jpy-s": "f55f",
    	"cur-krw": "f592",
    	"cur-krw-s": "f591",
    	"sym-medx": "f60c",
    	"sym-medx-s": "f60b",
    	"cur-mxn": "f662",
    	"cur-mxn-s": "f661",
    	"cur-myr": "f664",
    	"cur-myr-s": "f663",
    	"cur-ngn": "f68e",
    	"cur-ngn-s": "f68d",
    	"cur-pax": "f706",
    	"cur-pax-s": "f705",
    	"cur-php": "f71e",
    	"cur-php-s": "f71d",
    	"cur-pln": "f734",
    	"cur-pln-s": "f733",
    	"cur-qash": "f76c",
    	"cur-qash-s": "f76b",
    	"cur-rub": "f7e8",
    	"cur-rur": "f7e8",
    	"cur-rub-s": "f7e7",
    	"cur-rur-s": "f7e7",
    	"sym-steem": "f800",
    	"sym-steem-s": "f7ff",
    	"sym-xsc": "f804",
    	"sym-xsc-s": "f803",
    	"cur-sgd": "f820",
    	"cur-sgd-s": "f81f",
    	"sym-storj": "f836",
    	"sym-storj-s": "f835",
    	"sym-tel": "f8ba",
    	"cur-trx": "f903",
    	"cur-trx-s": "f902",
    	"cur-tusd": "f913",
    	"cur-tusd-s": "f912",
    	"cur-usd": "f933",
    	"cur-usd-s": "f932",
    	"cur-usdc": "f935",
    	"cur-usdc-s": "f934",
    	"sym-vet": "f953",
    	"sym-vet-s": "f952",
    	"sym-waxp": "f985",
    	"sym-waxp-s": "f984",
    	"cur-xlm": "f9c5",
    	"cur-xlm-s": "f9c4",
    	"cur-xmr": "f9c9",
    	"cur-xmr-s": "f9c8",
    	"cur-xrp": "f9dd",
    	"cur-xrp-s": "f9dc",
    	"cur-zar": "fa05",
    	"cur-zar-s": "fa04",
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
    	"cur-crc": "f32d",
    	"cur-crc-s": "f32c",
    	"cur-lak": "f59c",
    	"cur-lak-s": "f59b",
    	"cur-sek": "f810",
    	"cur-sek-s": "f80f",
    	"cur-thb": "f8c9",
    	"cur-thb-s": "f8c8",
    	"cur-try": "f905",
    	"cur-try-s": "f904",
    	"cur-uah": "f919",
    	"cur-uah-s": "f918",
    	"exc-ftx": "f45a",
    	"exc-ftx-s": "f459",
    	"exc-ftx-us": "f45a",
    	"exc-ftx-us-s": "f459",
    	"sym-cgld": "f2d9",
    	"sym-cgld-s": "f2d8",
    	"exc-uniswap-v2": "f92b",
    	"exc-uniswap-v2-s": "f92a",
    	"sym-kshib": "f826",
    	"sym-kshib-s": "f825",
    	"sym-easy-s": "f3c6",
    	"sym-srare": "f796",
    	"sym-srare-s": "f795",
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
