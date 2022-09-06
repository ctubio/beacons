
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

    var ustc = "fa38";
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
    	"sym-arbi-s": "f1e3",
    	"sym-arbi": "f1e4",
    	"sym-ardr-s": "f1e5",
    	"sym-ardr": "f1e6",
    	"sym-ark-s": "f1e7",
    	"sym-ark": "f1e8",
    	"sym-arn-s": "f1e9",
    	"sym-arn": "f1ea",
    	"sym-arpa-s": "f1eb",
    	"sym-arpa": "f1ec",
    	"sym-art-s": "f1ed",
    	"sym-art": "f1ee",
    	"sym-aspt-s": "f1ef",
    	"sym-aspt": "f1f0",
    	"sym-ast-s": "f1f1",
    	"sym-ast": "f1f2",
    	"sym-astr-s": "f1f3",
    	"sym-astr": "f1f4",
    	"sym-at-s": "f1f5",
    	"sym-at": "f1f6",
    	"sym-atlas-s": "f1f7",
    	"sym-atlas": "f1f8",
    	"sym-atm-s": "f1f9",
    	"sym-atm": "f1fa",
    	"sym-atom-s": "f1fb",
    	"sym-atom": "f1fc",
    	"sym-atp-s": "f1fd",
    	"sym-atp": "f1fe",
    	"sym-atri-s": "f1ff",
    	"sym-atri": "f200",
    	"sym-auction-s": "f201",
    	"sym-auction": "f202",
    	"sym-aud-s": "f203",
    	"sym-aud": "f204",
    	"sym-audio-s": "f205",
    	"sym-audio": "f206",
    	"sym-aup-s": "f207",
    	"sym-aup": "f208",
    	"sym-aury-s": "f209",
    	"sym-aury": "f20a",
    	"sym-ausd-s": "f20b",
    	"sym-ausd": "f20c",
    	"sym-auto-s": "f20d",
    	"sym-auto": "f20e",
    	"sym-ava-s": "f20f",
    	"sym-ava": "f210",
    	"sym-avax-s": "f211",
    	"sym-avax": "f212",
    	"sym-avt-s": "f213",
    	"sym-avt": "f214",
    	"sym-axl-s": "f215",
    	"sym-axl": "f216",
    	"sym-axpr-s": "f217",
    	"sym-axpr": "f218",
    	"sym-axs-s": "f219",
    	"sym-axs": "f21a",
    	"sym-b": "f21b",
    	"sym-b0-s": "f21c",
    	"sym-b0": "f21d",
    	"sym-b2g-s": "f21e",
    	"sym-b2g": "f21f",
    	"sym-bab-s": "f220",
    	"sym-bab": "f221",
    	"sym-badger-s": "f222",
    	"sym-badger": "f223",
    	"sym-bake-s": "f224",
    	"sym-bake": "f225",
    	"sym-bal-s": "f226",
    	"sym-bal": "f227",
    	"sym-banca-s": "f228",
    	"sym-banca": "f229",
    	"sym-band-s": "f22a",
    	"sym-band": "f22b",
    	"sym-bat-s": "f22c",
    	"sym-bat": "f22d",
    	"sym-bay-s": "f22e",
    	"sym-bay": "f22f",
    	"sym-bbc-s": "f230",
    	"sym-bbc": "f231",
    	"sym-bcc-s": "f232",
    	"sym-bcc": "f233",
    	"sym-bcd-s": "f234",
    	"sym-bcd": "f235",
    	"sym-bch-s": "f236",
    	"sym-bch": "f237",
    	"sym-bci-s": "f238",
    	"sym-bci": "f239",
    	"sym-bcn-s": "f23a",
    	"sym-bcn": "f23b",
    	"sym-bcpt-s": "f23c",
    	"sym-bcpt": "f23d",
    	"sym-bcu-s": "f23e",
    	"sym-bcu": "f23f",
    	"sym-bcv-s": "f240",
    	"sym-bcv": "f241",
    	"sym-bcy-s": "f242",
    	"sym-bcy": "f243",
    	"sym-bdg-s": "f244",
    	"sym-bdg": "f245",
    	"sym-beam-s": "f246",
    	"sym-beam": "f247",
    	"sym-beet-s": "f248",
    	"sym-beet": "f249",
    	"sym-bel-s": "f24a",
    	"sym-bel": "f24b",
    	"sym-bela-s": "f24c",
    	"sym-bela": "f24d",
    	"sym-berry-s": "f24e",
    	"sym-berry": "f24f",
    	"sym-beta-s": "f250",
    	"sym-beta": "f251",
    	"sym-betr-s": "f252",
    	"sym-betr": "f253",
    	"sym-bez-s": "f254",
    	"sym-bez": "f255",
    	"sym-bft-s": "f256",
    	"sym-bft": "f257",
    	"sym-bfx-s": "f258",
    	"sym-bfx": "f259",
    	"sym-bhd-s": "f25a",
    	"sym-bhd": "f25b",
    	"sym-bht-s": "f25c",
    	"sym-bht": "f25d",
    	"sym-bico-s": "f25e",
    	"sym-bico": "f25f",
    	"sym-bit-s": "f260",
    	"sym-bit": "f261",
    	"sym-bitb-s": "f262",
    	"sym-bitb": "f263",
    	"sym-bix-s": "f264",
    	"sym-bix": "f265",
    	"sym-bk-s": "f266",
    	"sym-bk": "f267",
    	"sym-bkx-s": "f268",
    	"sym-bkx": "f269",
    	"sym-blk-s": "f26a",
    	"sym-blk": "f26b",
    	"sym-block-s": "f26c",
    	"sym-block": "f26d",
    	"sym-blok-s": "f26e",
    	"sym-blok": "f26f",
    	"sym-blt-s": "f270",
    	"sym-blt": "f271",
    	"sym-blz-s": "f272",
    	"sym-blz": "f273",
    	"sym-bmc-s": "f274",
    	"sym-bmc": "f275",
    	"sym-bnb-s": "f276",
    	"sym-bnb": "f277",
    	"sym-bnc-s": "f278",
    	"sym-bnc": "f279",
    	"sym-bnk-s": "f27a",
    	"sym-bnk": "f27b",
    	"sym-bnt-s": "f27c",
    	"sym-bnt": "f27d",
    	"sym-bo-s": "f27e",
    	"sym-bo": "f27f",
    	"sym-boba-s": "f280",
    	"sym-boba": "f281",
    	"sym-bond-s": "f282",
    	"sym-bond": "f283",
    	"sym-boo-s": "f284",
    	"sym-boo": "f285",
    	"sym-bor-s": "f286",
    	"sym-bor": "f287",
    	"sym-bora-s": "f288",
    	"sym-bora": "f289",
    	"sym-bos-s": "f28a",
    	"sym-bos": "f28b",
    	"sym-box-s": "f28c",
    	"sym-box": "f28d",
    	"sym-brd-s": "f28e",
    	"sym-brd": "f28f",
    	"sym-breed-s": "f290",
    	"sym-breed": "f291",
    	"sym-brg-s": "f292",
    	"sym-brg": "f293",
    	"sym-brick-s": "f294",
    	"sym-brick": "f295",
    	"sym-bsd-s": "f296",
    	"sym-bsd": "f297",
    	"sym-bsv-s": "f298",
    	"sym-bsv": "f299",
    	"sym-bsx-s": "f29a",
    	"sym-bsx": "f29b",
    	"sym-bt1-s": "f29c",
    	"sym-bt1": "f29d",
    	"sym-bt2-s": "f29e",
    	"sym-bt2": "f29f",
    	"sym-btc-s": "f2a0",
    	"sym-btc": "f2a1",
    	"sym-btcd-s": "f2a2",
    	"sym-btcd": "f2a3",
    	"sym-btcfx-s": "f2a4",
    	"sym-btcfx": "f2a5",
    	"sym-btcp-s": "f2a6",
    	"sym-btcp": "f2a7",
    	"sym-btg-s": "f2a8",
    	"sym-btg": "f2a9",
    	"sym-btm-s": "f2aa",
    	"sym-btm": "f2ab",
    	"sym-btn-s": "f2ac",
    	"sym-btn": "f2ad",
    	"sym-bto-s": "f2ae",
    	"sym-bto": "f2af",
    	"sym-btrst-s": "f2b0",
    	"sym-btrst": "f2b1",
    	"sym-bts-s": "f2b2",
    	"sym-bts": "f2b3",
    	"sym-btt-s": "f2b4",
    	"sym-btt": "f2b5",
    	"sym-btu-s": "f2b6",
    	"sym-btu": "f2b7",
    	"sym-btx-s": "f2b8",
    	"sym-btx": "f2b9",
    	"sym-burger-s": "f2ba",
    	"sym-burger": "f2bb",
    	"sym-burst-s": "f2bc",
    	"sym-burst": "f2bd",
    	"sym-bus-s": "f2be",
    	"sym-bus": "f2bf",
    	"sym-busd-s": "f2c0",
    	"sym-busd": "f2c1",
    	"sym-bwx-s": "f2c2",
    	"sym-bwx": "f2c3",
    	"sym-bz-s": "f2c4",
    	"sym-bz": "f2c5",
    	"sym-bzrx-s": "f2c6",
    	"sym-bzrx": "f2c7",
    	"sym-c-s": "f2c8",
    	"sym-c": "f2c9",
    	"sym-c20-s": "f2ca",
    	"sym-c20": "f2cb",
    	"sym-c98-s": "f2cc",
    	"sym-c98": "f2cd",
    	"sym-cad-s": "f2ce",
    	"sym-cad": "f2cf",
    	"sym-cake-s": "f2d0",
    	"sym-cake": "f2d1",
    	"sym-cas-s": "f2d2",
    	"sym-cas": "f2d3",
    	"sym-cat-s": "f2d4",
    	"sym-cat": "f2d5",
    	"sym-cbc-s": "f2d6",
    	"sym-cbc": "f2d7",
    	"sym-cbt-s": "f2d8",
    	"sym-cbt": "f2d9",
    	"sym-cdt-s": "f2da",
    	"sym-cdt": "f2db",
    	"sym-cel-s": "f2dc",
    	"sym-cel": "f2dd",
    	"sym-celo-s": "f2de",
    	"sym-celo": "f2df",
    	"sym-celr-s": "f2e0",
    	"sym-celr": "f2e1",
    	"sym-cennz-s": "f2e2",
    	"sym-cennz": "f2e3",
    	"sym-cfg-s": "f2e4",
    	"sym-cfg": "f2e5",
    	"sym-cfi-s": "f2e6",
    	"sym-cfi": "f2e7",
    	"sym-cfx-s": "f2e8",
    	"sym-cfx": "f2e9",
    	"sym-cgt-s": "f2ea",
    	"sym-cgt": "f2eb",
    	"sym-chat-s": "f2ec",
    	"sym-chat": "f2ed",
    	"sym-chf-s": "f2ee",
    	"sym-chf": "f2ef",
    	"sym-chp-s": "f2f0",
    	"sym-chp": "f2f1",
    	"sym-chr-s": "f2f2",
    	"sym-chr": "f2f3",
    	"sym-chsb-s": "f2f4",
    	"sym-chsb": "f2f5",
    	"sym-chx-s": "f2f6",
    	"sym-chx": "f2f7",
    	"sym-chz-s": "f2f8",
    	"sym-chz": "f2f9",
    	"sym-ckb-s": "f2fa",
    	"sym-ckb": "f2fb",
    	"sym-cl-s": "f2fc",
    	"sym-cl": "f2fd",
    	"sym-clam-s": "f2fe",
    	"sym-clam": "f2ff",
    	"sym-cln-s": "f300",
    	"sym-cln": "f301",
    	"sym-clo-s": "f302",
    	"sym-clo": "f303",
    	"sym-cloak-s": "f304",
    	"sym-cloak": "f305",
    	"sym-clv-s": "f306",
    	"sym-clv": "f307",
    	"sym-cmct-s": "f308",
    	"sym-cmct": "f309",
    	"sym-cmt-s": "f30a",
    	"sym-cmt": "f30b",
    	"sym-cnd-s": "f30c",
    	"sym-cnd": "f30d",
    	"sym-cnn-s": "f30e",
    	"sym-cnn": "f30f",
    	"sym-cnx-s": "f310",
    	"sym-cnx": "f311",
    	"sym-cny-s": "f312",
    	"sym-cny": "f313",
    	"sym-cob-s": "f314",
    	"sym-cob": "f315",
    	"sym-cocos-s": "f316",
    	"sym-cocos": "f317",
    	"sym-comp-s": "f318",
    	"sym-comp": "f319",
    	"sym-cope-s": "f31a",
    	"sym-cope": "f31b",
    	"sym-cos-s": "f31c",
    	"sym-cos": "f31d",
    	"sym-cosm-s": "f31e",
    	"sym-cosm": "f31f",
    	"sym-coss-s": "f320",
    	"sym-coss": "f321",
    	"sym-coti-s": "f322",
    	"sym-coti": "f323",
    	"sym-cov-s": "f324",
    	"sym-cov": "f325",
    	"sym-cova-s": "f326",
    	"sym-cova": "f327",
    	"sym-cpt-s": "f328",
    	"sym-cpt": "f329",
    	"sym-cpx-s": "f32a",
    	"sym-cpx": "f32b",
    	"sym-cqt-s": "f32c",
    	"sym-cqt": "f32d",
    	"sym-cra-s": "f32e",
    	"sym-cra": "f32f",
    	"sym-crab-s": "f330",
    	"sym-crab": "f331",
    	"sym-crc-s": "f332",
    	"sym-crc": "f333",
    	"sym-cre-s": "f334",
    	"sym-cre": "f335",
    	"sym-cream-s": "f336",
    	"sym-cream": "f337",
    	"sym-cring-s": "f338",
    	"sym-cring": "f339",
    	"sym-cro-s": "f33a",
    	"sym-cro": "f33b",
    	"sym-crpt-s": "f33c",
    	"sym-crpt": "f33d",
    	"sym-cru-s": "f33e",
    	"sym-cru": "f33f",
    	"sym-crv-s": "f340",
    	"sym-crv": "f341",
    	"sym-crw-s": "f342",
    	"sym-crw": "f343",
    	"sym-csm-s": "f344",
    	"sym-csm": "f345",
    	"sym-csx-s": "f346",
    	"sym-csx": "f347",
    	"sym-ctc-s": "f348",
    	"sym-ctc": "f349",
    	"sym-ctk-s": "f34a",
    	"sym-ctk": "f34b",
    	"sym-ctsi-s": "f34c",
    	"sym-ctsi": "f34d",
    	"sym-ctxc-s": "f34e",
    	"sym-ctxc": "f34f",
    	"sym-cult-s": "f350",
    	"sym-cult": "f351",
    	"sym-cur-s": "f352",
    	"sym-cur": "f353",
    	"sym-cvc-s": "f354",
    	"sym-cvc": "f355",
    	"sym-cvcoin-s": "f356",
    	"sym-cvcoin": "f357",
    	"sym-cvnt-s": "f358",
    	"sym-cvnt": "f359",
    	"sym-cvp-s": "f35a",
    	"sym-cvp": "f35b",
    	"sym-cvt-s": "f35c",
    	"sym-cvt": "f35d",
    	"sym-cvx-s": "f35e",
    	"sym-cvx": "f35f",
    	"sym-cw-s": "f360",
    	"sym-cw": "f361",
    	"sym-cyc-s": "f362",
    	"sym-cyc": "f363",
    	"sym-dac-s": "f364",
    	"sym-dac": "f365",
    	"sym-dacs-s": "f366",
    	"sym-dacs": "f367",
    	"sym-dadi-s": "f368",
    	"sym-dadi": "f369",
    	"sym-dag-s": "f36a",
    	"sym-dag": "f36b",
    	"sym-dai-s": "f36c",
    	"sym-dai": "f36d",
    	"sym-dao-s": "f36e",
    	"sym-dao": "f36f",
    	"sym-dar-s": "f370",
    	"sym-dar": "f371",
    	"sym-dash-s": "f372",
    	"sym-dash": "f373",
    	"sym-dat-s": "f374",
    	"sym-dat": "f375",
    	"sym-data-s": "f376",
    	"sym-data": "f377",
    	"sym-datx-s": "f378",
    	"sym-datx": "f379",
    	"sym-dbc-s": "f37a",
    	"sym-dbc": "f37b",
    	"sym-dbet-s": "f37c",
    	"sym-dbet": "f37d",
    	"sym-dbix-s": "f37e",
    	"sym-dbix": "f37f",
    	"sym-dcn-s": "f380",
    	"sym-dcn": "f381",
    	"sym-dcr-s": "f382",
    	"sym-dcr": "f383",
    	"sym-dct-s": "f384",
    	"sym-dct": "f385",
    	"sym-ddd-s": "f386",
    	"sym-ddd": "f387",
    	"sym-dego-s": "f388",
    	"sym-dego": "f389",
    	"sym-dent-s": "f38a",
    	"sym-dent": "f38b",
    	"sym-dext-s": "f38c",
    	"sym-dext": "f38d",
    	"sym-dgb-s": "f38e",
    	"sym-dgb": "f38f",
    	"sym-dgd-s": "f390",
    	"sym-dgd": "f391",
    	"sym-dgtx-s": "f392",
    	"sym-dgtx": "f393",
    	"sym-dgx-s": "f394",
    	"sym-dgx": "f395",
    	"sym-dhx-s": "f396",
    	"sym-dhx": "f397",
    	"sym-dia-s": "f398",
    	"sym-dia": "f399",
    	"sym-dice-s": "f39a",
    	"sym-dice": "f39b",
    	"sym-dim-s": "f39c",
    	"sym-dim": "f39d",
    	"sym-dlt-s": "f39e",
    	"sym-dlt": "f39f",
    	"sym-dmd-s": "f3a0",
    	"sym-dmd": "f3a1",
    	"sym-dmt-s": "f3a2",
    	"sym-dmt": "f3a3",
    	"sym-dnt-s": "f3a4",
    	"sym-dnt": "f3a5",
    	"sym-dock-s": "f3a6",
    	"sym-dock": "f3a7",
    	"sym-dodo-s": "f3a8",
    	"sym-dodo": "f3a9",
    	"sym-doge-s": "f3aa",
    	"sym-doge": "f3ab",
    	"sym-dose-s": "f3ac",
    	"sym-dose": "f3ad",
    	"sym-dot-s": "f3ae",
    	"sym-dot": "f3af",
    	"sym-dpx-s": "f3b0",
    	"sym-dpx": "f3b1",
    	"sym-dpy-s": "f3b2",
    	"sym-dpy": "f3b3",
    	"sym-dream-s": "f3b4",
    	"sym-dream": "f3b5",
    	"sym-drep-s": "f3b6",
    	"sym-drep": "f3b7",
    	"sym-drg-s": "f3b8",
    	"sym-drg": "f3b9",
    	"sym-drgn-s": "f3ba",
    	"sym-drgn": "f3bb",
    	"sym-drt-s": "f3bc",
    	"sym-drt": "f3bd",
    	"sym-dta-s": "f3be",
    	"sym-dta": "f3bf",
    	"sym-dtb-s": "f3c0",
    	"sym-dtb": "f3c1",
    	"sym-dtr-s": "f3c2",
    	"sym-dtr": "f3c3",
    	"sym-dusk-s": "f3c4",
    	"sym-dusk": "f3c5",
    	"sym-dx-s": "f3c6",
    	"sym-dx": "f3c7",
    	"sym-dydx-s": "f3c8",
    	"sym-dydx": "f3c9",
    	"sym-dyn-s": "f3ca",
    	"sym-dyn": "f3cb",
    	"sym-easy": "f3cc",
    	"sym-ecom-s": "f3cd",
    	"sym-ecom": "f3ce",
    	"sym-edc-s": "f3cf",
    	"sym-edc": "f3d0",
    	"sym-edg-s": "f3d1",
    	"sym-edg": "f3d2",
    	"sym-edo-s": "f3d3",
    	"sym-edo": "f3d4",
    	"sym-edp-s": "f3d5",
    	"sym-edp": "f3d6",
    	"sym-edr-s": "f3d7",
    	"sym-edr": "f3d8",
    	"sym-efi-s": "f3d9",
    	"sym-efi": "f3da",
    	"sym-egld-s": "f3db",
    	"sym-egld": "f3dc",
    	"sym-egt-s": "f3dd",
    	"sym-egt": "f3de",
    	"sym-ehr-s": "f3df",
    	"sym-ehr": "f3e0",
    	"sym-eko-s": "f3e1",
    	"sym-eko": "f3e2",
    	"sym-ekt-s": "f3e3",
    	"sym-ekt": "f3e4",
    	"sym-ela-s": "f3e5",
    	"sym-ela": "f3e6",
    	"sym-elec-s": "f3e7",
    	"sym-elec": "f3e8",
    	"sym-elf-s": "f3e9",
    	"sym-elf": "f3ea",
    	"sym-em-s": "f3eb",
    	"sym-em": "f3ec",
    	"sym-emc-s": "f3ed",
    	"sym-emc": "f3ee",
    	"sym-emc2-s": "f3ef",
    	"sym-emc2": "f3f0",
    	"sym-eng-s": "f3f1",
    	"sym-eng": "f3f2",
    	"sym-enj-s": "f3f3",
    	"sym-enj": "f3f4",
    	"sym-ens-s": "f3f5",
    	"sym-ens": "f3f6",
    	"sym-eos-s": "f3f7",
    	"sym-eos": "f3f8",
    	"sym-eosdac-s": "f3f9",
    	"sym-eosdac": "f3fa",
    	"sym-eq-s": "f3fb",
    	"sym-eq": "f3fc",
    	"sym-erd-s": "f3fd",
    	"sym-erd": "f3fe",
    	"sym-ern-s": "f3ff",
    	"sym-ern": "f400",
    	"sym-es": "f401",
    	"sym-es-s": "f402",
    	"sym-esd-s": "f403",
    	"sym-esd": "f404",
    	"sym-etc-s": "f405",
    	"sym-etc": "f406",
    	"sym-eth-s": "f407",
    	"sym-eth": "f408",
    	"sym-ethup-s": "f409",
    	"sym-ethup": "f40a",
    	"sym-ethw-s": "f40b",
    	"sym-ethw": "f40c",
    	"sym-etn-s": "f40d",
    	"sym-etn": "f40e",
    	"sym-etp-s": "f40f",
    	"sym-etp": "f410",
    	"sym-eur-s": "f411",
    	"sym-eur": "f412",
    	"sym-euroc-s": "f413",
    	"sym-euroc": "f414",
    	"sym-eurs-s": "f415",
    	"sym-eurs": "f416",
    	"sym-eurt-s": "f417",
    	"sym-eurt": "f418",
    	"sym-evn-s": "f419",
    	"sym-evn": "f41a",
    	"sym-evx-s": "f41b",
    	"sym-evx": "f41c",
    	"sym-ewt-s": "f41d",
    	"sym-ewt": "f41e",
    	"sym-exp-s": "f41f",
    	"sym-exp": "f420",
    	"sym-exrd-s": "f421",
    	"sym-exrd": "f422",
    	"sym-exy-s": "f423",
    	"sym-exy": "f424",
    	"sym-ez-s": "f425",
    	"sym-ez": "f426",
    	"sym-fair-s": "f427",
    	"sym-fair": "f428",
    	"sym-farm-s": "f429",
    	"sym-farm": "f42a",
    	"sym-fct-s": "f42b",
    	"sym-fct": "f42c",
    	"sym-fdz-s": "f42d",
    	"sym-fdz": "f42e",
    	"sym-fee-s": "f42f",
    	"sym-fee": "f430",
    	"sym-fet-s": "f431",
    	"sym-fet": "f432",
    	"sym-fida-s": "f433",
    	"sym-fida": "f434",
    	"sym-fil-s": "f435",
    	"sym-fil": "f436",
    	"sym-fio-s": "f437",
    	"sym-fio": "f438",
    	"sym-firo-s": "f439",
    	"sym-firo": "f43a",
    	"sym-fis-s": "f43b",
    	"sym-fis": "f43c",
    	"sym-fldc-s": "f43d",
    	"sym-fldc": "f43e",
    	"sym-flo-s": "f43f",
    	"sym-flo": "f440",
    	"sym-floki-s": "f441",
    	"sym-floki": "f442",
    	"sym-flow-s": "f443",
    	"sym-flow": "f444",
    	"sym-flr-s": "f445",
    	"sym-flr": "f446",
    	"sym-fluz-s": "f447",
    	"sym-fluz": "f448",
    	"sym-fnb-s": "f449",
    	"sym-fnb": "f44a",
    	"sym-foam-s": "f44b",
    	"sym-foam": "f44c",
    	"sym-for-s": "f44d",
    	"sym-for": "f44e",
    	"sym-forth-s": "f44f",
    	"sym-forth": "f450",
    	"sym-fota-s": "f451",
    	"sym-fota": "f452",
    	"sym-fox-s": "f453",
    	"sym-fox": "f454",
    	"sym-fpis-s": "f455",
    	"sym-fpis": "f456",
    	"sym-frax-s": "f457",
    	"sym-frax": "f458",
    	"sym-front-s": "f459",
    	"sym-front": "f45a",
    	"sym-fsn-s": "f45b",
    	"sym-fsn": "f45c",
    	"sym-ftc-s": "f45d",
    	"sym-ftc": "f45e",
    	"sym-fti-s": "f45f",
    	"sym-fti": "f460",
    	"sym-ftm-s": "f461",
    	"sym-ftm": "f462",
    	"sym-ftt-s": "f463",
    	"sym-ftt": "f464",
    	"sym-ftx-s": "f465",
    	"sym-ftx": "f466",
    	"sym-fuel-s": "f467",
    	"sym-fuel": "f468",
    	"sym-fun-s": "f469",
    	"sym-fun": "f46a",
    	"sym-fx-s": "f46b",
    	"sym-fx": "f46c",
    	"sym-fxc-s": "f46d",
    	"sym-fxc": "f46e",
    	"sym-fxs-s": "f46f",
    	"sym-fxs": "f470",
    	"sym-fxt-s": "f471",
    	"sym-fxt": "f472",
    	"sym-gal-s": "f473",
    	"sym-gal": "f474",
    	"sym-gala-s": "f475",
    	"sym-gala": "f476",
    	"sym-game-s": "f477",
    	"sym-game": "f478",
    	"sym-gamee-s": "f479",
    	"sym-gamee": "f47a",
    	"sym-gard-s": "f47b",
    	"sym-gard": "f47c",
    	"sym-gari-s": "f47d",
    	"sym-gari": "f47e",
    	"sym-gas-s": "f47f",
    	"sym-gas": "f480",
    	"sym-gbc-s": "f481",
    	"sym-gbc": "f482",
    	"sym-gbp-s": "f483",
    	"sym-gbp": "f484",
    	"sym-gbx-s": "f485",
    	"sym-gbx": "f486",
    	"sym-gbyte-s": "f487",
    	"sym-gbyte": "f488",
    	"sym-gc-s": "f489",
    	"sym-gc": "f48a",
    	"sym-gcc-s": "f48b",
    	"sym-gcc": "f48c",
    	"sym-ge-s": "f48d",
    	"sym-ge": "f48e",
    	"sym-geist-s": "f48f",
    	"sym-geist": "f490",
    	"sym-gen-s": "f491",
    	"sym-gen": "f492",
    	"sym-gene-s": "f493",
    	"sym-gene": "f494",
    	"sym-gens-s": "f495",
    	"sym-gens": "f496",
    	"sym-get-s": "f497",
    	"sym-get": "f498",
    	"sym-ghst-s": "f499",
    	"sym-ghst": "f49a",
    	"sym-glc-s": "f49b",
    	"sym-glc": "f49c",
    	"sym-gld-s": "f49d",
    	"sym-gld": "f49e",
    	"sym-glm-s": "f49f",
    	"sym-glm": "f4a0",
    	"sym-glmr-s": "f4a1",
    	"sym-glmr": "f4a2",
    	"sym-gmat-s": "f4a3",
    	"sym-gmat": "f4a4",
    	"sym-gmt-s": "f4a5",
    	"sym-gmt": "f4a6",
    	"sym-gmt2-s": "f4a7",
    	"sym-gmt2": "f4a8",
    	"sym-gno-s": "f4a9",
    	"sym-gno": "f4aa",
    	"sym-gnt-s": "f4ab",
    	"sym-gnt": "f4ac",
    	"sym-gnx-s": "f4ad",
    	"sym-gnx": "f4ae",
    	"sym-go-s": "f4af",
    	"sym-go": "f4b0",
    	"sym-gods-s": "f4b1",
    	"sym-gods": "f4b2",
    	"sym-got-s": "f4b3",
    	"sym-got": "f4b4",
    	"sym-grc-s": "f4b5",
    	"sym-grc": "f4b6",
    	"sym-grin-s": "f4b7",
    	"sym-grin": "f4b8",
    	"sym-grs-s": "f4b9",
    	"sym-grs": "f4ba",
    	"sym-grt-s": "f4bb",
    	"sym-grt": "f4bc",
    	"sym-gsc-s": "f4bd",
    	"sym-gsc": "f4be",
    	"sym-gst-s": "f4bf",
    	"sym-gst": "f4c0",
    	"sym-gt-s": "f4c1",
    	"sym-gt": "f4c2",
    	"sym-gtc-s": "f4c3",
    	"sym-gtc": "f4c4",
    	"sym-gtc2-s": "f4c5",
    	"sym-gtc2": "f4c6",
    	"sym-gto-s": "f4c7",
    	"sym-gto": "f4c8",
    	"sym-gup-s": "f4c9",
    	"sym-gup": "f4ca",
    	"sym-gusd-s": "f4cb",
    	"sym-gusd": "f4cc",
    	"sym-gvt-s": "f4cd",
    	"sym-gvt": "f4ce",
    	"sym-gxc-s": "f4cf",
    	"sym-gxc": "f4d0",
    	"sym-gxs-s": "f4d1",
    	"sym-gxs": "f4d2",
    	"sym-hard-s": "f4d3",
    	"sym-hard": "f4d4",
    	"sym-hbar-s": "f4d5",
    	"sym-hbar": "f4d6",
    	"sym-hc-s": "f4d7",
    	"sym-hc": "f4d8",
    	"sym-hdx-s": "f4d9",
    	"sym-hdx": "f4da",
    	"sym-hedg-s": "f4db",
    	"sym-hedg": "f4dc",
    	"sym-hegic-s": "f4dd",
    	"sym-hegic": "f4de",
    	"sym-hex-s": "f4df",
    	"sym-hex": "f4e0",
    	"sym-hft-s": "f4e1",
    	"sym-hft": "f4e2",
    	"sym-hg-s": "f4e3",
    	"sym-hg": "f4e4",
    	"sym-hgs-s": "f4e5",
    	"sym-hgs": "f4e6",
    	"sym-hh-s": "f4e7",
    	"sym-hh": "f4e8",
    	"sym-high-s": "f4e9",
    	"sym-high": "f4ea",
    	"sym-hit-s": "f4eb",
    	"sym-hit": "f4ec",
    	"sym-hive-s": "f4ed",
    	"sym-hive": "f4ee",
    	"sym-hkd-s": "f4ef",
    	"sym-hkd": "f4f0",
    	"sym-hko-s": "f4f1",
    	"sym-hko": "f4f2",
    	"sym-hmq-s": "f4f3",
    	"sym-hmq": "f4f4",
    	"sym-hns-s": "f4f5",
    	"sym-hns": "f4f6",
    	"sym-ho-s": "f4f7",
    	"sym-ho": "f4f8",
    	"sym-hopr-s": "f4f9",
    	"sym-hopr": "f4fa",
    	"sym-hot-s": "f4fb",
    	"sym-hot": "f4fc",
    	"sym-hp-s": "f4fd",
    	"sym-hp": "f4fe",
    	"sym-hpb-s": "f4ff",
    	"sym-hpb": "f500",
    	"sym-hpc-s": "f501",
    	"sym-hpc": "f502",
    	"sym-hpt-s": "f503",
    	"sym-hpt": "f504",
    	"sym-hrc-s": "f505",
    	"sym-hrc": "f506",
    	"sym-hsc-s": "f507",
    	"sym-hsc": "f508",
    	"sym-hsr-s": "f509",
    	"sym-hsr": "f50a",
    	"sym-hst-s": "f50b",
    	"sym-hst": "f50c",
    	"sym-ht-s": "f50d",
    	"sym-ht": "f50e",
    	"sym-html-s": "f50f",
    	"sym-html": "f510",
    	"sym-htt-s": "f511",
    	"sym-htt": "f512",
    	"sym-huc-s": "f513",
    	"sym-huc": "f514",
    	"sym-hunt-s": "f515",
    	"sym-hunt": "f516",
    	"sym-hvn-s": "f517",
    	"sym-hvn": "f518",
    	"sym-hxro-s": "f519",
    	"sym-hxro": "f51a",
    	"sym-hyc-s": "f51b",
    	"sym-hyc": "f51c",
    	"sym-hydra-s": "f51d",
    	"sym-hydra": "f51e",
    	"sym-hydro-s": "f51f",
    	"sym-hydro": "f520",
    	"sym-icn-s": "f521",
    	"sym-icn": "f522",
    	"sym-icos-s": "f523",
    	"sym-icos": "f524",
    	"sym-icp-s": "f525",
    	"sym-icp": "f526",
    	"sym-icx-s": "f527",
    	"sym-icx": "f528",
    	"sym-idex-s": "f529",
    	"sym-idex": "f52a",
    	"sym-idh-s": "f52b",
    	"sym-idh": "f52c",
    	"sym-idr-s": "f52d",
    	"sym-idr": "f52e",
    	"sym-ift-s": "f52f",
    	"sym-ift": "f530",
    	"sym-ignis-s": "f531",
    	"sym-ignis": "f532",
    	"sym-ihf-s": "f533",
    	"sym-ihf": "f534",
    	"sym-iht-s": "f535",
    	"sym-iht": "f536",
    	"sym-ilc-s": "f537",
    	"sym-ilc": "f538",
    	"sym-ilv-s": "f539",
    	"sym-ilv": "f53a",
    	"sym-imx-s": "f53b",
    	"sym-imx": "f53c",
    	"sym-incnt-s": "f53d",
    	"sym-incnt": "f53e",
    	"sym-ind-s": "f53f",
    	"sym-ind": "f540",
    	"sym-indi-s": "f541",
    	"sym-indi": "f542",
    	"sym-inj-s": "f543",
    	"sym-inj": "f544",
    	"sym-ink-s": "f545",
    	"sym-ink": "f546",
    	"sym-inr-s": "f547",
    	"sym-inr": "f548",
    	"sym-ins-s": "f549",
    	"sym-ins": "f54a",
    	"sym-int-s": "f54b",
    	"sym-int": "f54c",
    	"sym-intr-s": "f54d",
    	"sym-intr": "f54e",
    	"sym-ioc-s": "f54f",
    	"sym-ioc": "f550",
    	"sym-ion-s": "f551",
    	"sym-ion": "f552",
    	"sym-iost-s": "f553",
    	"sym-iost": "f554",
    	"sym-iot-s": "f555",
    	"sym-iot": "f556",
    	"sym-iotx-s": "f557",
    	"sym-iotx": "f558",
    	"sym-iq-s": "f559",
    	"sym-iq": "f55a",
    	"sym-iris-s": "f55b",
    	"sym-iris": "f55c",
    	"sym-itc-s": "f55d",
    	"sym-itc": "f55e",
    	"sym-ivy-s": "f55f",
    	"sym-ivy": "f560",
    	"sym-ixt-s": "f561",
    	"sym-ixt": "f562",
    	"sym-jasmy-s": "f563",
    	"sym-jasmy": "f564",
    	"sym-jnt-s": "f565",
    	"sym-jnt": "f566",
    	"sym-joe-s": "f567",
    	"sym-joe": "f568",
    	"sym-jpeg-s": "f569",
    	"sym-jpeg": "f56a",
    	"sym-jpy-s": "f56b",
    	"sym-jpy": "f56c",
    	"sym-jst-s": "f56d",
    	"sym-jst": "f56e",
    	"sym-juno-s": "f56f",
    	"sym-juno": "f570",
    	"sym-just-s": "f571",
    	"sym-just": "f572",
    	"sym-juv-s": "f573",
    	"sym-juv": "f574",
    	"sym-kan-s": "f575",
    	"sym-kan": "f576",
    	"sym-kapex-s": "f577",
    	"sym-kapex": "f578",
    	"sym-kar-s": "f579",
    	"sym-kar": "f57a",
    	"sym-kava-s": "f57b",
    	"sym-kava": "f57c",
    	"sym-kbc-s": "f57d",
    	"sym-kbc": "f57e",
    	"sym-kcash-s": "f57f",
    	"sym-kcash": "f580",
    	"sym-kda-s": "f581",
    	"sym-kda": "f582",
    	"sym-keep-s": "f583",
    	"sym-keep": "f584",
    	"sym-key-s": "f585",
    	"sym-key": "f586",
    	"sym-kick-s": "f587",
    	"sym-kick": "f588",
    	"sym-kilt-s": "f589",
    	"sym-kilt": "f58a",
    	"sym-kin-s": "f58b",
    	"sym-kin": "f58c",
    	"sym-kint-s": "f58d",
    	"sym-kint": "f58e",
    	"sym-klay-s": "f58f",
    	"sym-klay": "f590",
    	"sym-kma-s": "f591",
    	"sym-kma": "f592",
    	"sym-kmd-s": "f593",
    	"sym-kmd": "f594",
    	"sym-knc-s": "f595",
    	"sym-knc": "f596",
    	"sym-kore-s": "f597",
    	"sym-kore": "f598",
    	"sym-kp3r-s": "f599",
    	"sym-kp3r": "f59a",
    	"sym-krm-s": "f59b",
    	"sym-krm": "f59c",
    	"sym-krw-s": "f59d",
    	"sym-krw": "f59e",
    	"sym-ksm-s": "f59f",
    	"sym-ksm": "f5a0",
    	"sym-ksx-s": "f5a1",
    	"sym-ksx": "f5a2",
    	"sym-kyl-s": "f5a3",
    	"sym-kyl": "f5a4",
    	"sym-la-s": "f5a5",
    	"sym-la": "f5a6",
    	"sym-lak-s": "f5a7",
    	"sym-lak": "f5a8",
    	"sym-lamb-s": "f5a9",
    	"sym-lamb": "f5aa",
    	"sym-latx-s": "f5ab",
    	"sym-latx": "f5ac",
    	"sym-layr-s": "f5ad",
    	"sym-layr": "f5ae",
    	"sym-lba-s": "f5af",
    	"sym-lba": "f5b0",
    	"sym-lbc-s": "f5b1",
    	"sym-lbc": "f5b2",
    	"sym-lcc-s": "f5b3",
    	"sym-lcc": "f5b4",
    	"sym-lcx-s": "f5b5",
    	"sym-lcx": "f5b6",
    	"sym-ldo-s": "f5b7",
    	"sym-ldo": "f5b8",
    	"sym-lend-s": "f5b9",
    	"sym-lend": "f5ba",
    	"sym-leo-s": "f5bb",
    	"sym-leo": "f5bc",
    	"sym-leoc-s": "f5bd",
    	"sym-leoc": "f5be",
    	"sym-let-s": "f5bf",
    	"sym-let": "f5c0",
    	"sym-life-s": "f5c1",
    	"sym-life": "f5c2",
    	"sym-lina-s": "f5c3",
    	"sym-lina": "f5c4",
    	"sym-link-s": "f5c5",
    	"sym-link": "f5c6",
    	"sym-lit-s": "f5c7",
    	"sym-lit": "f5c8",
    	"sym-lmc-s": "f5c9",
    	"sym-lmc": "f5ca",
    	"sym-lml-s": "f5cb",
    	"sym-lml": "f5cc",
    	"sym-lmwr-s": "f5cd",
    	"sym-lmwr": "f5ce",
    	"sym-lnc-s": "f5cf",
    	"sym-lnc": "f5d0",
    	"sym-lnd-s": "f5d1",
    	"sym-lnd": "f5d2",
    	"sym-loc-s": "f5d3",
    	"sym-loc": "f5d4",
    	"sym-loka-s": "f5d5",
    	"sym-loka": "f5d6",
    	"sym-looks-s": "f5d7",
    	"sym-looks": "f5d8",
    	"sym-loom-s": "f5d9",
    	"sym-loom": "f5da",
    	"sym-lpt-s": "f5db",
    	"sym-lpt": "f5dc",
    	"sym-lqty-s": "f5dd",
    	"sym-lqty": "f5de",
    	"sym-lrc-s": "f5df",
    	"sym-lrc": "f5e0",
    	"sym-lrn-s": "f5e1",
    	"sym-lrn": "f5e2",
    	"sym-lsk-s": "f5e3",
    	"sym-lsk": "f5e4",
    	"sym-ltc-s": "f5e5",
    	"sym-ltc": "f5e6",
    	"sym-lto-s": "f5e7",
    	"sym-lto": "f5e8",
    	"sym-lun-s": "f5e9",
    	"sym-lun": "f5ea",
    	"sym-luna-s": "f5eb",
    	"sym-luna": "f5ec",
    	"sym-luna2-s": "f5ed",
    	"sym-luna2": "f5ee",
    	"sym-lxt-s": "f5ef",
    	"sym-lxt": "f5f0",
    	"sym-lym-s": "f5f1",
    	"sym-lym": "f5f2",
    	"sym-m2k-s": "f5f3",
    	"sym-m2k": "f5f4",
    	"sym-ma-s": "f5f5",
    	"sym-ma": "f5f6",
    	"sym-magic-s": "f5f7",
    	"sym-magic": "f5f8",
    	"sym-maid-s": "f5f9",
    	"sym-maid": "f5fa",
    	"sym-man-s": "f5fb",
    	"sym-man": "f5fc",
    	"sym-mana-s": "f5fd",
    	"sym-mana": "f5fe",
    	"sym-maps-s": "f5ff",
    	"sym-maps": "f600",
    	"sym-mask-s": "f601",
    	"sym-mask": "f602",
    	"sym-mass-s": "f603",
    	"sym-mass": "f604",
    	"sym-math-s": "f605",
    	"sym-math": "f606",
    	"sym-matic-s": "f607",
    	"sym-matic": "f608",
    	"sym-mbl-s": "f609",
    	"sym-mbl": "f60a",
    	"sym-mbt-s": "f60b",
    	"sym-mbt": "f60c",
    	"sym-mc-s": "f60d",
    	"sym-mc": "f60e",
    	"sym-mco-s": "f60f",
    	"sym-mco": "f610",
    	"sym-mda-s": "f611",
    	"sym-mda": "f612",
    	"sym-mds-s": "f613",
    	"sym-mds": "f614",
    	"sym-mdt-s": "f615",
    	"sym-mdt": "f616",
    	"sym-mdx-s": "f617",
    	"sym-mdx": "f618",
    	"sym-med-s": "f619",
    	"sym-med": "f61a",
    	"sym-mer-s": "f61b",
    	"sym-mer": "f61c",
    	"sym-mes-s": "f61d",
    	"sym-mes": "f61e",
    	"sym-met-s": "f61f",
    	"sym-met": "f620",
    	"sym-meta-s": "f621",
    	"sym-meta": "f622",
    	"sym-metis-s": "f623",
    	"sym-metis": "f624",
    	"sym-mft-s": "f625",
    	"sym-mft": "f626",
    	"sym-mgc-s": "f627",
    	"sym-mgc": "f628",
    	"sym-mgo-s": "f629",
    	"sym-mgo": "f62a",
    	"sym-mhc-s": "f62b",
    	"sym-mhc": "f62c",
    	"sym-mina-s": "f62d",
    	"sym-mina": "f62e",
    	"sym-mir-s": "f62f",
    	"sym-mir": "f630",
    	"sym-mith-s": "f631",
    	"sym-mith": "f632",
    	"sym-mitx-s": "f633",
    	"sym-mitx": "f634",
    	"sym-mjp-s": "f635",
    	"sym-mjp": "f636",
    	"sym-mkr-s": "f637",
    	"sym-mkr": "f638",
    	"sym-mln-s": "f639",
    	"sym-mln": "f63a",
    	"sym-mngo-s": "f63b",
    	"sym-mngo": "f63c",
    	"sym-mnx-s": "f63d",
    	"sym-mnx": "f63e",
    	"sym-moac-s": "f63f",
    	"sym-moac": "f640",
    	"sym-mob-s": "f641",
    	"sym-mob": "f642",
    	"sym-mobi-s": "f643",
    	"sym-mobi": "f644",
    	"sym-moc-s": "f645",
    	"sym-moc": "f646",
    	"sym-mod-s": "f647",
    	"sym-mod": "f648",
    	"sym-mona-s": "f649",
    	"sym-mona": "f64a",
    	"sym-moon-s": "f64b",
    	"sym-moon": "f64c",
    	"sym-morph-s": "f64d",
    	"sym-morph": "f64e",
    	"sym-movr-s": "f64f",
    	"sym-movr": "f650",
    	"sym-mpl-s": "f651",
    	"sym-mpl": "f652",
    	"sym-mrk-s": "f653",
    	"sym-mrk": "f654",
    	"sym-msol-s": "f655",
    	"sym-msol": "f656",
    	"sym-msp-s": "f657",
    	"sym-msp": "f658",
    	"sym-mta-s": "f659",
    	"sym-mta": "f65a",
    	"sym-mtc-s": "f65b",
    	"sym-mtc": "f65c",
    	"sym-mth-s": "f65d",
    	"sym-mth": "f65e",
    	"sym-mtl-s": "f65f",
    	"sym-mtl": "f660",
    	"sym-mtn-s": "f661",
    	"sym-mtn": "f662",
    	"sym-mtx-s": "f663",
    	"sym-mtx": "f664",
    	"sym-mue-s": "f665",
    	"sym-mue": "f666",
    	"sym-multi-s": "f667",
    	"sym-multi": "f668",
    	"sym-mv-s": "f669",
    	"sym-mv": "f66a",
    	"sym-mx-s": "f66b",
    	"sym-mx": "f66c",
    	"sym-mxc-s": "f66d",
    	"sym-mxc": "f66e",
    	"sym-mxm-s": "f66f",
    	"sym-mxm": "f670",
    	"sym-mxn-s": "f671",
    	"sym-mxn": "f672",
    	"sym-myr-s": "f673",
    	"sym-myr": "f674",
    	"sym-n9l-s": "f675",
    	"sym-n9l": "f676",
    	"sym-nanj-s": "f677",
    	"sym-nanj": "f678",
    	"sym-nano-s": "f679",
    	"sym-nano": "f67a",
    	"sym-nas-s": "f67b",
    	"sym-nas": "f67c",
    	"sym-naut-s": "f67d",
    	"sym-naut": "f67e",
    	"sym-nav-s": "f67f",
    	"sym-nav": "f680",
    	"sym-ncash-s": "f681",
    	"sym-ncash": "f682",
    	"sym-nct-s": "f683",
    	"sym-nct": "f684",
    	"sym-near-s": "f685",
    	"sym-near": "f686",
    	"sym-nebl-s": "f687",
    	"sym-nebl": "f688",
    	"sym-nec-s": "f689",
    	"sym-nec": "f68a",
    	"sym-neo-s": "f68b",
    	"sym-neo": "f68c",
    	"sym-neos-s": "f68d",
    	"sym-neos": "f68e",
    	"sym-nest-s": "f68f",
    	"sym-nest": "f690",
    	"sym-neu-s": "f691",
    	"sym-neu": "f692",
    	"sym-new-s": "f693",
    	"sym-new": "f694",
    	"sym-nexo-s": "f695",
    	"sym-nexo": "f696",
    	"sym-nft-s": "f697",
    	"sym-nft": "f698",
    	"sym-ng-s": "f699",
    	"sym-ng": "f69a",
    	"sym-ngc-s": "f69b",
    	"sym-ngc": "f69c",
    	"sym-ngn-s": "f69d",
    	"sym-ngn": "f69e",
    	"sym-nim-s": "f69f",
    	"sym-nim": "f6a0",
    	"sym-niy-s": "f6a1",
    	"sym-niy": "f6a2",
    	"sym-nkd-s": "f6a3",
    	"sym-nkd": "f6a4",
    	"sym-nkn-s": "f6a5",
    	"sym-nkn": "f6a6",
    	"sym-nlc2-s": "f6a7",
    	"sym-nlc2": "f6a8",
    	"sym-nlg-s": "f6a9",
    	"sym-nlg": "f6aa",
    	"sym-nmc-s": "f6ab",
    	"sym-nmc": "f6ac",
    	"sym-nmr-s": "f6ad",
    	"sym-nmr": "f6ae",
    	"sym-nn-s": "f6af",
    	"sym-nn": "f6b0",
    	"sym-noah-s": "f6b1",
    	"sym-noah": "f6b2",
    	"sym-nodl-s": "f6b3",
    	"sym-nodl": "f6b4",
    	"sym-note-s": "f6b5",
    	"sym-note": "f6b6",
    	"sym-npg-s": "f6b7",
    	"sym-npg": "f6b8",
    	"sym-nplc-s": "f6b9",
    	"sym-nplc": "f6ba",
    	"sym-npxs-s": "f6bb",
    	"sym-npxs": "f6bc",
    	"sym-nq-s": "f6bd",
    	"sym-nq": "f6be",
    	"sym-nrg-s": "f6bf",
    	"sym-nrg": "f6c0",
    	"sym-ntk-s": "f6c1",
    	"sym-ntk": "f6c2",
    	"sym-nu-s": "f6c3",
    	"sym-nu": "f6c4",
    	"sym-nuls-s": "f6c5",
    	"sym-nuls": "f6c6",
    	"sym-nvc-s": "f6c7",
    	"sym-nvc": "f6c8",
    	"sym-nxc-s": "f6c9",
    	"sym-nxc": "f6ca",
    	"sym-nxs-s": "f6cb",
    	"sym-nxs": "f6cc",
    	"sym-nxt-s": "f6cd",
    	"sym-nxt": "f6ce",
    	"sym-nym-s": "f6cf",
    	"sym-nym": "f6d0",
    	"sym-o-s": "f6d1",
    	"sym-o": "f6d2",
    	"sym-oax-s": "f6d3",
    	"sym-oax": "f6d4",
    	"sym-ocean-s": "f6d5",
    	"sym-ocean": "f6d6",
    	"sym-ocn-s": "f6d7",
    	"sym-ocn": "f6d8",
    	"sym-ode-s": "f6d9",
    	"sym-ode": "f6da",
    	"sym-ogn-s": "f6db",
    	"sym-ogn": "f6dc",
    	"sym-ogo-s": "f6dd",
    	"sym-ogo": "f6de",
    	"sym-ok-s": "f6df",
    	"sym-ok": "f6e0",
    	"sym-okb-s": "f6e1",
    	"sym-okb": "f6e2",
    	"sym-om-s": "f6e3",
    	"sym-om": "f6e4",
    	"sym-omg-s": "f6e5",
    	"sym-omg": "f6e6",
    	"sym-omni-s": "f6e7",
    	"sym-omni": "f6e8",
    	"sym-one-s": "f6e9",
    	"sym-one": "f6ea",
    	"sym-ong-s": "f6eb",
    	"sym-ong": "f6ec",
    	"sym-onot-s": "f6ed",
    	"sym-onot": "f6ee",
    	"sym-ont-s": "f6ef",
    	"sym-ont": "f6f0",
    	"sym-ooki-s": "f6f1",
    	"sym-ooki": "f6f2",
    	"sym-orbs-s": "f6f3",
    	"sym-orbs": "f6f4",
    	"sym-orca-s": "f6f5",
    	"sym-orca": "f6f6",
    	"sym-orme-s": "f6f7",
    	"sym-orme": "f6f8",
    	"sym-orn-s": "f6f9",
    	"sym-orn": "f6fa",
    	"sym-ors-s": "f6fb",
    	"sym-ors": "f6fc",
    	"sym-osmo-s": "f6fd",
    	"sym-osmo": "f6fe",
    	"sym-ost-s": "f6ff",
    	"sym-ost": "f700",
    	"sym-otn-s": "f701",
    	"sym-otn": "f702",
    	"sym-oxt-s": "f703",
    	"sym-oxt": "f704",
    	"sym-oxy-s": "f705",
    	"sym-oxy": "f706",
    	"sym-pai-s": "f707",
    	"sym-pai": "f708",
    	"sym-pal-s": "f709",
    	"sym-pal": "f70a",
    	"sym-paper-s": "f70b",
    	"sym-paper": "f70c",
    	"sym-para-s": "f70d",
    	"sym-para": "f70e",
    	"sym-part-s": "f70f",
    	"sym-part": "f710",
    	"sym-pasc-s": "f711",
    	"sym-pasc": "f712",
    	"sym-pat-s": "f713",
    	"sym-pat": "f714",
    	"sym-pax-s": "f715",
    	"sym-pax": "f716",
    	"sym-paxg-s": "f717",
    	"sym-paxg": "f718",
    	"sym-pay-s": "f719",
    	"sym-pay": "f71a",
    	"sym-pbt-s": "f71b",
    	"sym-pbt": "f71c",
    	"sym-pcl-s": "f71d",
    	"sym-pcl": "f71e",
    	"sym-pcx-s": "f71f",
    	"sym-pcx": "f720",
    	"sym-pdex-s": "f721",
    	"sym-pdex": "f722",
    	"sym-people-s": "f723",
    	"sym-people": "f724",
    	"sym-perl-s": "f725",
    	"sym-perl": "f726",
    	"sym-perp-s": "f727",
    	"sym-perp": "f728",
    	"sym-pha-s": "f729",
    	"sym-pha": "f72a",
    	"sym-phb-s": "f72b",
    	"sym-phb": "f72c",
    	"sym-php-s": "f72d",
    	"sym-php": "f72e",
    	"sym-phx-s": "f72f",
    	"sym-phx": "f730",
    	"sym-pi-s": "f731",
    	"sym-pi": "f732",
    	"sym-pica-s": "f733",
    	"sym-pica": "f734",
    	"sym-pink-s": "f735",
    	"sym-pink": "f736",
    	"sym-pivx-s": "f737",
    	"sym-pivx": "f738",
    	"sym-pkt-s": "f739",
    	"sym-pkt": "f73a",
    	"sym-pl-s": "f73b",
    	"sym-pl": "f73c",
    	"sym-pla-s": "f73d",
    	"sym-pla": "f73e",
    	"sym-plbt-s": "f73f",
    	"sym-plbt": "f740",
    	"sym-plm-s": "f741",
    	"sym-plm": "f742",
    	"sym-pln-s": "f743",
    	"sym-pln": "f744",
    	"sym-plr-s": "f745",
    	"sym-plr": "f746",
    	"sym-ply-s": "f747",
    	"sym-ply": "f748",
    	"sym-pma-s": "f749",
    	"sym-pma": "f74a",
    	"sym-png-s": "f74b",
    	"sym-png": "f74c",
    	"sym-pnt-s": "f74d",
    	"sym-pnt": "f74e",
    	"sym-poa-s": "f74f",
    	"sym-poa": "f750",
    	"sym-poe-s": "f751",
    	"sym-poe": "f752",
    	"sym-polis-s": "f753",
    	"sym-polis": "f754",
    	"sym-pols-s": "f755",
    	"sym-pols": "f756",
    	"sym-poly-s": "f757",
    	"sym-poly": "f758",
    	"sym-pond-s": "f759",
    	"sym-pond": "f75a",
    	"sym-pot-s": "f75b",
    	"sym-pot": "f75c",
    	"sym-powr-s": "f75d",
    	"sym-powr": "f75e",
    	"sym-ppc-s": "f75f",
    	"sym-ppc": "f760",
    	"sym-ppt-s": "f761",
    	"sym-ppt": "f762",
    	"sym-pra-s": "f763",
    	"sym-pra": "f764",
    	"sym-pre-s": "f765",
    	"sym-pre": "f766",
    	"sym-prg-s": "f767",
    	"sym-prg": "f768",
    	"sym-pro-s": "f769",
    	"sym-pro": "f76a",
    	"sym-prq-s": "f76b",
    	"sym-prq": "f76c",
    	"sym-pst-s": "f76d",
    	"sym-pst": "f76e",
    	"sym-pstake-s": "f76f",
    	"sym-pstake": "f770",
    	"sym-pton-s": "f771",
    	"sym-pton": "f772",
    	"sym-pundix-s": "f773",
    	"sym-pundix": "f774",
    	"sym-pvt-s": "f775",
    	"sym-pvt": "f776",
    	"sym-pxg-s": "f777",
    	"sym-pxg": "f778",
    	"sym-pyr-s": "f779",
    	"sym-pyr": "f77a",
    	"sym-qash-s": "f77b",
    	"sym-qash": "f77c",
    	"sym-qau-s": "f77d",
    	"sym-qau": "f77e",
    	"sym-qc-s": "f77f",
    	"sym-qc": "f780",
    	"sym-qi-s": "f781",
    	"sym-qi": "f782",
    	"sym-qi2-s": "f783",
    	"sym-qi2": "f784",
    	"sym-qkc-s": "f785",
    	"sym-qkc": "f786",
    	"sym-qlc-s": "f787",
    	"sym-qlc": "f788",
    	"sym-qnt-s": "f789",
    	"sym-qnt": "f78a",
    	"sym-qntu-s": "f78b",
    	"sym-qntu": "f78c",
    	"sym-qo-s": "f78d",
    	"sym-qo": "f78e",
    	"sym-qrdo-s": "f78f",
    	"sym-qrdo": "f790",
    	"sym-qrl-s": "f791",
    	"sym-qrl": "f792",
    	"sym-qsp-s": "f793",
    	"sym-qsp": "f794",
    	"sym-qtum-s": "f795",
    	"sym-qtum": "f796",
    	"sym-quick-s": "f797",
    	"sym-quick": "f798",
    	"sym-qun-s": "f799",
    	"sym-qun": "f79a",
    	"sym-r-s": "f79b",
    	"sym-r": "f79c",
    	"sym-rad-s": "f79d",
    	"sym-rad": "f79e",
    	"sym-radar-s": "f79f",
    	"sym-radar": "f7a0",
    	"sym-rads-s": "f7a1",
    	"sym-rads": "f7a2",
    	"sym-ramp-s": "f7a3",
    	"sym-ramp": "f7a4",
    	"sym-rare-s": "f7a5",
    	"sym-rare": "f7a6",
    	"sym-rari-s": "f7a7",
    	"sym-rari": "f7a8",
    	"sym-rating-s": "f7a9",
    	"sym-rating": "f7aa",
    	"sym-ray-s": "f7ab",
    	"sym-ray": "f7ac",
    	"sym-rb-s": "f7ad",
    	"sym-rb": "f7ae",
    	"sym-rbc-s": "f7af",
    	"sym-rbc": "f7b0",
    	"sym-rblx-s": "f7b1",
    	"sym-rblx": "f7b2",
    	"sym-rbn-s": "f7b3",
    	"sym-rbn": "f7b4",
    	"sym-rbtc-s": "f7b5",
    	"sym-rbtc": "f7b6",
    	"sym-rby-s": "f7b7",
    	"sym-rby": "f7b8",
    	"sym-rcn-s": "f7b9",
    	"sym-rcn": "f7ba",
    	"sym-rdd-s": "f7bb",
    	"sym-rdd": "f7bc",
    	"sym-rdn-s": "f7bd",
    	"sym-rdn": "f7be",
    	"sym-real-s": "f7bf",
    	"sym-real": "f7c0",
    	"sym-reef-s": "f7c1",
    	"sym-reef": "f7c2",
    	"sym-rem-s": "f7c3",
    	"sym-rem": "f7c4",
    	"sym-ren-s": "f7c5",
    	"sym-ren": "f7c6",
    	"sym-rep-s": "f7c7",
    	"sym-rep": "f7c8",
    	"sym-repv2-s": "f7c9",
    	"sym-repv2": "f7ca",
    	"sym-req-s": "f7cb",
    	"sym-req": "f7cc",
    	"sym-rev-s": "f7cd",
    	"sym-rev": "f7ce",
    	"sym-revv-s": "f7cf",
    	"sym-revv": "f7d0",
    	"sym-rfox-s": "f7d1",
    	"sym-rfox": "f7d2",
    	"sym-rfr-s": "f7d3",
    	"sym-rfr": "f7d4",
    	"sym-ric-s": "f7d5",
    	"sym-ric": "f7d6",
    	"sym-rif-s": "f7d7",
    	"sym-rif": "f7d8",
    	"sym-ring-s": "f7d9",
    	"sym-ring": "f7da",
    	"sym-rlc-s": "f7db",
    	"sym-rlc": "f7dc",
    	"sym-rly-s": "f7dd",
    	"sym-rly": "f7de",
    	"sym-rmrk-s": "f7df",
    	"sym-rmrk": "f7e0",
    	"sym-rndr-s": "f7e1",
    	"sym-rndr": "f7e2",
    	"sym-rntb-s": "f7e3",
    	"sym-rntb": "f7e4",
    	"sym-ron-s": "f7e5",
    	"sym-ron": "f7e6",
    	"sym-rook-s": "f7e7",
    	"sym-rook": "f7e8",
    	"sym-rose-s": "f7e9",
    	"sym-rose": "f7ea",
    	"sym-rox-s": "f7eb",
    	"sym-rox": "f7ec",
    	"sym-rp-s": "f7ed",
    	"sym-rp": "f7ee",
    	"sym-rpl-s": "f7ef",
    	"sym-rpl": "f7f0",
    	"sym-rpx-s": "f7f1",
    	"sym-rpx": "f7f2",
    	"sym-rsr-s": "f7f3",
    	"sym-rsr": "f7f4",
    	"sym-rsv-s": "f7f5",
    	"sym-rsv": "f7f6",
    	"sym-rty-s": "f7f7",
    	"sym-rty": "f7f8",
    	"sym-rub-s": "f7f9",
    	"sym-rub": "f7fa",
    	"sym-ruff-s": "f7fb",
    	"sym-ruff": "f7fc",
    	"sym-rune-s": "f7fd",
    	"sym-rune": "f7fe",
    	"sym-rvn-s": "f7ff",
    	"sym-rvn": "f800",
    	"sym-rvr-s": "f801",
    	"sym-rvr": "f802",
    	"sym-rvt-s": "f803",
    	"sym-rvt": "f804",
    	"sym-sai-s": "f805",
    	"sym-sai": "f806",
    	"sym-salt-s": "f807",
    	"sym-salt": "f808",
    	"sym-samo-s": "f809",
    	"sym-samo": "f80a",
    	"sym-san-s": "f80b",
    	"sym-san": "f80c",
    	"sym-sand-s": "f80d",
    	"sym-sand": "f80e",
    	"sym-sats-s": "f80f",
    	"sym-sats": "f810",
    	"sym-sbd-s": "f811",
    	"sym-sbd": "f812",
    	"sym-sbr-s": "f813",
    	"sym-sbr": "f814",
    	"sym-sc-s": "f815",
    	"sym-sc": "f816",
    	"sym-scc-s": "f817",
    	"sym-scc": "f818",
    	"sym-scrt-s": "f819",
    	"sym-scrt": "f81a",
    	"sym-sdc-s": "f81b",
    	"sym-sdc": "f81c",
    	"sym-sdn-s": "f81d",
    	"sym-sdn": "f81e",
    	"sym-seele-s": "f81f",
    	"sym-seele": "f820",
    	"sym-sek-s": "f821",
    	"sym-sek": "f822",
    	"sym-sen-s": "f823",
    	"sym-sen": "f824",
    	"sym-sent-s": "f825",
    	"sym-sent": "f826",
    	"sym-sero-s": "f827",
    	"sym-sero": "f828",
    	"sym-sexc-s": "f829",
    	"sym-sexc": "f82a",
    	"sym-sfp-s": "f82b",
    	"sym-sfp": "f82c",
    	"sym-sgb-s": "f82d",
    	"sym-sgb": "f82e",
    	"sym-sgc-s": "f82f",
    	"sym-sgc": "f830",
    	"sym-sgd-s": "f831",
    	"sym-sgd": "f832",
    	"sym-sgn-s": "f833",
    	"sym-sgn": "f834",
    	"sym-sgu-s": "f835",
    	"sym-sgu": "f836",
    	"sym-shib-s": "f837",
    	"sym-shib": "f838",
    	"sym-shift-s": "f839",
    	"sym-shift": "f83a",
    	"sym-ship-s": "f83b",
    	"sym-ship": "f83c",
    	"sym-shping-s": "f83d",
    	"sym-shping": "f83e",
    	"sym-si-s": "f83f",
    	"sym-si": "f840",
    	"sym-sib-s": "f841",
    	"sym-sib": "f842",
    	"sym-sil-s": "f843",
    	"sym-sil": "f844",
    	"sym-six-s": "f845",
    	"sym-six": "f846",
    	"sym-sjcx-s": "f847",
    	"sym-sjcx": "f848",
    	"sym-skl-s": "f849",
    	"sym-skl": "f84a",
    	"sym-skm-s": "f84b",
    	"sym-skm": "f84c",
    	"sym-sku-s": "f84d",
    	"sym-sku": "f84e",
    	"sym-sky-s": "f84f",
    	"sym-sky": "f850",
    	"sym-slp-s": "f851",
    	"sym-slp": "f852",
    	"sym-slr-s": "f853",
    	"sym-slr": "f854",
    	"sym-sls-s": "f855",
    	"sym-sls": "f856",
    	"sym-slt-s": "f857",
    	"sym-slt": "f858",
    	"sym-slv-s": "f859",
    	"sym-slv": "f85a",
    	"sym-smart-s": "f85b",
    	"sym-smart": "f85c",
    	"sym-smn-s": "f85d",
    	"sym-smn": "f85e",
    	"sym-smt-s": "f85f",
    	"sym-smt": "f860",
    	"sym-snc-s": "f861",
    	"sym-snc": "f862",
    	"sym-snet-s": "f863",
    	"sym-snet": "f864",
    	"sym-sngls-s": "f865",
    	"sym-sngls": "f866",
    	"sym-snm-s": "f867",
    	"sym-snm": "f868",
    	"sym-snt-s": "f869",
    	"sym-snt": "f86a",
    	"sym-snx-s": "f86b",
    	"sym-snx": "f86c",
    	"sym-soc-s": "f86d",
    	"sym-soc": "f86e",
    	"sym-socks-s": "f86f",
    	"sym-socks": "f870",
    	"sym-sol-s": "f871",
    	"sym-sol": "f872",
    	"sym-solid-s": "f873",
    	"sym-solid": "f874",
    	"sym-solo-s": "f875",
    	"sym-solo": "f876",
    	"sym-solve-s": "f877",
    	"sym-solve": "f878",
    	"sym-sos-s": "f879",
    	"sym-sos": "f87a",
    	"sym-soul-s": "f87b",
    	"sym-soul": "f87c",
    	"sym-sp-s": "f87d",
    	"sym-sp": "f87e",
    	"sym-sparta-s": "f87f",
    	"sym-sparta": "f880",
    	"sym-spc-s": "f881",
    	"sym-spc": "f882",
    	"sym-spd-s": "f883",
    	"sym-spd": "f884",
    	"sym-spell-s": "f885",
    	"sym-spell": "f886",
    	"sym-sphr-s": "f887",
    	"sym-sphr": "f888",
    	"sym-sphtx-s": "f889",
    	"sym-sphtx": "f88a",
    	"sym-spnd-s": "f88b",
    	"sym-spnd": "f88c",
    	"sym-spnk-s": "f88d",
    	"sym-spnk": "f88e",
    	"sym-srm-s": "f88f",
    	"sym-srm": "f890",
    	"sym-srn-s": "f891",
    	"sym-srn": "f892",
    	"sym-ssp-s": "f893",
    	"sym-ssp": "f894",
    	"sym-stacs-s": "f895",
    	"sym-stacs": "f896",
    	"sym-step-s": "f897",
    	"sym-step": "f898",
    	"sym-stg-s": "f899",
    	"sym-stg": "f89a",
    	"sym-stmx-s": "f89b",
    	"sym-stmx": "f89c",
    	"sym-storm-s": "f89d",
    	"sym-storm": "f89e",
    	"sym-stpt-s": "f89f",
    	"sym-stpt": "f8a0",
    	"sym-stq-s": "f8a1",
    	"sym-stq": "f8a2",
    	"sym-str-s": "f8a3",
    	"sym-str": "f8a4",
    	"sym-strat-s": "f8a5",
    	"sym-strat": "f8a6",
    	"sym-strax-s": "f8a7",
    	"sym-strax": "f8a8",
    	"sym-strk-s": "f8a9",
    	"sym-strk": "f8aa",
    	"sym-strong-s": "f8ab",
    	"sym-strong": "f8ac",
    	"sym-stx-s": "f8ad",
    	"sym-stx": "f8ae",
    	"sym-sub-s": "f8af",
    	"sym-sub": "f8b0",
    	"sym-sun-s": "f8b1",
    	"sym-sun": "f8b2",
    	"sym-super-s": "f8b3",
    	"sym-super": "f8b4",
    	"sym-susd-s": "f8b5",
    	"sym-susd": "f8b6",
    	"sym-sushi-s": "f8b7",
    	"sym-sushi": "f8b8",
    	"sym-swftc-s": "f8b9",
    	"sym-swftc": "f8ba",
    	"sym-swm-s": "f8bb",
    	"sym-swm": "f8bc",
    	"sym-swrv-s": "f8bd",
    	"sym-swrv": "f8be",
    	"sym-swt-s": "f8bf",
    	"sym-swt": "f8c0",
    	"sym-swth-s": "f8c1",
    	"sym-swth": "f8c2",
    	"sym-sxp-s": "f8c3",
    	"sym-sxp": "f8c4",
    	"sym-syn-s": "f8c5",
    	"sym-syn": "f8c6",
    	"sym-sys-s": "f8c7",
    	"sym-sys": "f8c8",
    	"sym-t-s": "f8c9",
    	"sym-t": "f8ca",
    	"sym-taas-s": "f8cb",
    	"sym-taas": "f8cc",
    	"sym-tau-s": "f8cd",
    	"sym-tau": "f8ce",
    	"sym-tbtc-s": "f8cf",
    	"sym-tbtc": "f8d0",
    	"sym-tct-s": "f8d1",
    	"sym-tct": "f8d2",
    	"sym-teer-s": "f8d3",
    	"sym-teer": "f8d4",
    	"sym-tel-s": "f8d5",
    	"sym-temco-s": "f8d6",
    	"sym-temco": "f8d7",
    	"sym-tfuel-s": "f8d8",
    	"sym-tfuel": "f8d9",
    	"sym-thb-s": "f8da",
    	"sym-thb": "f8db",
    	"sym-thc-s": "f8dc",
    	"sym-thc": "f8dd",
    	"sym-theta-s": "f8de",
    	"sym-theta": "f8df",
    	"sym-thx-s": "f8e0",
    	"sym-thx": "f8e1",
    	"sym-time-s": "f8e2",
    	"sym-time": "f8e3",
    	"sym-tio-s": "f8e4",
    	"sym-tio": "f8e5",
    	"sym-tix-s": "f8e6",
    	"sym-tix": "f8e7",
    	"sym-tkn-s": "f8e8",
    	"sym-tkn": "f8e9",
    	"sym-tky-s": "f8ea",
    	"sym-tky": "f8eb",
    	"sym-tlm-s": "f8ec",
    	"sym-tlm": "f8ed",
    	"sym-tnb-s": "f8ee",
    	"sym-tnb": "f8ef",
    	"sym-tnc-s": "f8f0",
    	"sym-tnc": "f8f1",
    	"sym-tnt-s": "f8f2",
    	"sym-tnt": "f8f3",
    	"sym-toke-s": "f8f4",
    	"sym-toke": "f8f5",
    	"sym-tomb-s": "f8f6",
    	"sym-tomb": "f8f7",
    	"sym-tomo-s": "f8f8",
    	"sym-tomo": "f8f9",
    	"sym-top-s": "f8fa",
    	"sym-top": "f8fb",
    	"sym-torn-s": "f8fc",
    	"sym-torn": "f8fd",
    	"sym-tower-s": "f8fe",
    	"sym-tower": "f8ff",
    	"sym-tpay-s": "f900",
    	"sym-tpay": "f901",
    	"sym-trac-s": "f902",
    	"sym-trac": "f903",
    	"sym-trb-s": "f904",
    	"sym-trb": "f905",
    	"sym-tribe-s": "f906",
    	"sym-tribe": "f907",
    	"sym-trig-s": "f908",
    	"sym-trig": "f909",
    	"sym-trio-s": "f90a",
    	"sym-trio": "f90b",
    	"sym-troy-s": "f90c",
    	"sym-troy": "f90d",
    	"sym-trst-s": "f90e",
    	"sym-trst": "f90f",
    	"sym-tru-s": "f910",
    	"sym-tru": "f911",
    	"sym-true-s": "f912",
    	"sym-true": "f913",
    	"sym-trx-s": "f914",
    	"sym-trx": "f915",
    	"sym-try-s": "f916",
    	"sym-try": "f917",
    	"sym-tryb-s": "f918",
    	"sym-tryb": "f919",
    	"sym-tt-s": "f91a",
    	"sym-tt": "f91b",
    	"sym-ttc-s": "f91c",
    	"sym-ttc": "f91d",
    	"sym-ttt-s": "f91e",
    	"sym-ttt": "f91f",
    	"sym-ttu-s": "f920",
    	"sym-ttu": "f921",
    	"sym-tube-s": "f922",
    	"sym-tube": "f923",
    	"sym-tusd-s": "f924",
    	"sym-tusd": "f925",
    	"sym-tvk-s": "f926",
    	"sym-tvk": "f927",
    	"sym-twt-s": "f928",
    	"sym-twt": "f929",
    	"sym-uah-s": "f92a",
    	"sym-uah": "f92b",
    	"sym-ubq-s": "f92c",
    	"sym-ubq": "f92d",
    	"sym-ubt-s": "f92e",
    	"sym-ubt": "f92f",
    	"sym-uft-s": "f930",
    	"sym-uft": "f931",
    	"sym-ugas-s": "f932",
    	"sym-ugas": "f933",
    	"sym-uip-s": "f934",
    	"sym-uip": "f935",
    	"sym-ukg-s": "f936",
    	"sym-ukg": "f937",
    	"sym-uma-s": "f938",
    	"sym-uma": "f939",
    	"sym-unfi-s": "f93a",
    	"sym-unfi": "f93b",
    	"sym-uni-s": "f93c",
    	"sym-uni": "f93d",
    	"sym-unq-s": "f93e",
    	"sym-unq": "f93f",
    	"sym-up-s": "f940",
    	"sym-up": "f941",
    	"sym-upp-s": "f942",
    	"sym-upp": "f943",
    	"sym-usd-s": "f944",
    	"sym-usd": "f945",
    	"sym-usdc-s": "f946",
    	"sym-usdc": "f947",
    	"sym-usds-s": "f948",
    	"sym-usds": "f949",
    	"sym-usk-s": "f94a",
    	"sym-usk": "f94b",
    	"sym-ust-s": "f94c",
    	"sym-ust": "f94d",
    	"sym-utk-s": "f94e",
    	"sym-utk": "f94f",
    	"sym-utnp-s": "f950",
    	"sym-utnp": "f951",
    	"sym-utt-s": "f952",
    	"sym-utt": "f953",
    	"sym-uuu-s": "f954",
    	"sym-uuu": "f955",
    	"sym-ux-s": "f956",
    	"sym-ux": "f957",
    	"sym-vader-s": "f958",
    	"sym-vader": "f959",
    	"sym-vai-s": "f95a",
    	"sym-vai": "f95b",
    	"sym-vbk-s": "f95c",
    	"sym-vbk": "f95d",
    	"sym-vdx-s": "f95e",
    	"sym-vdx": "f95f",
    	"sym-vee-s": "f960",
    	"sym-vee": "f961",
    	"sym-vemp-s": "f962",
    	"sym-vemp": "f963",
    	"sym-ven-s": "f964",
    	"sym-ven": "f965",
    	"sym-veo-s": "f966",
    	"sym-veo": "f967",
    	"sym-veri-s": "f968",
    	"sym-veri": "f969",
    	"sym-vex-s": "f96a",
    	"sym-vex": "f96b",
    	"sym-vgx-s": "f96c",
    	"sym-vgx": "f96d",
    	"sym-via-s": "f96e",
    	"sym-via": "f96f",
    	"sym-vib-s": "f970",
    	"sym-vib": "f971",
    	"sym-vibe-s": "f972",
    	"sym-vibe": "f973",
    	"sym-vid-s": "f974",
    	"sym-vid": "f975",
    	"sym-vidt-s": "f976",
    	"sym-vidt": "f977",
    	"sym-vidy-s": "f978",
    	"sym-vidy": "f979",
    	"sym-vitae-s": "f97a",
    	"sym-vitae": "f97b",
    	"sym-vite-s": "f97c",
    	"sym-vite": "f97d",
    	"sym-vlx-s": "f97e",
    	"sym-vlx": "f97f",
    	"sym-vox-s": "f980",
    	"sym-vox": "f981",
    	"sym-voxel-s": "f982",
    	"sym-voxel": "f983",
    	"sym-vra-s": "f984",
    	"sym-vra": "f985",
    	"sym-vrc-s": "f986",
    	"sym-vrc": "f987",
    	"sym-vrm-s": "f988",
    	"sym-vrm": "f989",
    	"sym-vsys-s": "f98a",
    	"sym-vsys": "f98b",
    	"sym-vtc-s": "f98c",
    	"sym-vtc": "f98d",
    	"sym-vtho-s": "f98e",
    	"sym-vtho": "f98f",
    	"sym-wabi-s": "f990",
    	"sym-wabi": "f991",
    	"sym-wan-s": "f992",
    	"sym-wan": "f993",
    	"sym-waves-s": "f994",
    	"sym-waves": "f995",
    	"sym-wax-s": "f996",
    	"sym-wax": "f997",
    	"sym-wbtc-s": "f998",
    	"sym-wbtc": "f999",
    	"sym-wet-s": "f99a",
    	"sym-wet": "f99b",
    	"sym-weth-s": "f99c",
    	"sym-weth": "f99d",
    	"sym-wib-s": "f99e",
    	"sym-wib": "f99f",
    	"sym-wicc-s": "f9a0",
    	"sym-wicc": "f9a1",
    	"sym-win-s": "f9a2",
    	"sym-win": "f9a3",
    	"sym-wing-s": "f9a4",
    	"sym-wing": "f9a5",
    	"sym-wings-s": "f9a6",
    	"sym-wings": "f9a7",
    	"sym-wnxm-s": "f9a8",
    	"sym-wnxm": "f9a9",
    	"sym-woo-s": "f9aa",
    	"sym-woo": "f9ab",
    	"sym-wpr-s": "f9ac",
    	"sym-wpr": "f9ad",
    	"sym-wrx-s": "f9ae",
    	"sym-wrx": "f9af",
    	"sym-wtc-s": "f9b0",
    	"sym-wtc": "f9b1",
    	"sym-wtt-s": "f9b2",
    	"sym-wtt": "f9b3",
    	"sym-wwb-s": "f9b4",
    	"sym-wwb": "f9b5",
    	"sym-wxt-s": "f9b6",
    	"sym-wxt": "f9b7",
    	"sym-xas-s": "f9b8",
    	"sym-xas": "f9b9",
    	"sym-xaur-s": "f9ba",
    	"sym-xaur": "f9bb",
    	"sym-xaut-s": "f9bc",
    	"sym-xaut": "f9bd",
    	"sym-xava-s": "f9be",
    	"sym-xava": "f9bf",
    	"sym-xbc-s": "f9c0",
    	"sym-xbc": "f9c1",
    	"sym-xcn-s": "f9c2",
    	"sym-xcn": "f9c3",
    	"sym-xcon-s": "f9c4",
    	"sym-xcon": "f9c5",
    	"sym-xcp-s": "f9c6",
    	"sym-xcp": "f9c7",
    	"sym-xdefi-s": "f9c8",
    	"sym-xdefi": "f9c9",
    	"sym-xdn-s": "f9ca",
    	"sym-xdn": "f9cb",
    	"sym-xel-s": "f9cc",
    	"sym-xel": "f9cd",
    	"sym-xem-s": "f9ce",
    	"sym-xem": "f9cf",
    	"sym-xes-s": "f9d0",
    	"sym-xes": "f9d1",
    	"sym-xhv-s": "f9d2",
    	"sym-xhv": "f9d3",
    	"sym-xin-s": "f9d4",
    	"sym-xin": "f9d5",
    	"sym-xlm-s": "f9d6",
    	"sym-xlm": "f9d7",
    	"sym-xmc-s": "f9d8",
    	"sym-xmc": "f9d9",
    	"sym-xmr-s": "f9da",
    	"sym-xmr": "f9db",
    	"sym-xmx-s": "f9dc",
    	"sym-xmx": "f9dd",
    	"sym-xmy-s": "f9de",
    	"sym-xmy": "f9df",
    	"sym-xnk-s": "f9e0",
    	"sym-xnk": "f9e1",
    	"sym-xns-s": "f9e2",
    	"sym-xns": "f9e3",
    	"sym-xor-s": "f9e4",
    	"sym-xor": "f9e5",
    	"sym-xos-s": "f9e6",
    	"sym-xos": "f9e7",
    	"sym-xpm-s": "f9e8",
    	"sym-xpm": "f9e9",
    	"sym-xpr-s": "f9ea",
    	"sym-xpr": "f9eb",
    	"sym-xrc-s": "f9ec",
    	"sym-xrc": "f9ed",
    	"sym-xrp-s": "f9ee",
    	"sym-xrp": "f9ef",
    	"sym-xrpx-s": "f9f0",
    	"sym-xrpx": "f9f1",
    	"sym-xrt-s": "f9f2",
    	"sym-xrt": "f9f3",
    	"sym-xst-s": "f9f4",
    	"sym-xst": "f9f5",
    	"sym-xtp-s": "f9f6",
    	"sym-xtp": "f9f7",
    	"sym-xtz-s": "f9f8",
    	"sym-xtz": "f9f9",
    	"sym-xtzdown-s": "f9fa",
    	"sym-xtzdown": "f9fb",
    	"sym-xvc-s": "f9fc",
    	"sym-xvc": "f9fd",
    	"sym-xvg-s": "f9fe",
    	"sym-xvg": "f9ff",
    	"sym-xvs-s": "fa00",
    	"sym-xvs": "fa01",
    	"sym-xwc-s": "fa02",
    	"sym-xwc": "fa03",
    	"sym-xyo-s": "fa04",
    	"sym-xyo": "fa05",
    	"sym-xzc-s": "fa06",
    	"sym-xzc": "fa07",
    	"sym-yam-s": "fa08",
    	"sym-yam": "fa09",
    	"sym-yee-s": "fa0a",
    	"sym-yee": "fa0b",
    	"sym-yeed-s": "fa0c",
    	"sym-yeed": "fa0d",
    	"sym-yfi-s": "fa0e",
    	"sym-yfi": "fa0f",
    	"sym-yfii-s": "fa10",
    	"sym-yfii": "fa11",
    	"sym-ygg-s": "fa12",
    	"sym-ygg": "fa13",
    	"sym-yoyow-s": "fa14",
    	"sym-yoyow": "fa15",
    	"sym-zar-s": "fa16",
    	"sym-zar": "fa17",
    	"sym-zcl-s": "fa18",
    	"sym-zcl": "fa19",
    	"sym-zcn-s": "fa1a",
    	"sym-zcn": "fa1b",
    	"sym-zco-s": "fa1c",
    	"sym-zco": "fa1d",
    	"sym-zec-s": "fa1e",
    	"sym-zec": "fa1f",
    	"sym-zen-s": "fa20",
    	"sym-zen": "fa21",
    	"sym-zil-s": "fa22",
    	"sym-zil": "fa23",
    	"sym-zks-s": "fa24",
    	"sym-zks": "fa25",
    	"sym-zla-s": "fa26",
    	"sym-zla": "fa27",
    	"sym-zlk": "fa28",
    	"sym-zondo-s": "fa29",
    	"sym-zondo": "fa2a",
    	"sym-zpr-s": "fa2b",
    	"sym-zpr": "fa2c",
    	"sym-zpt-s": "fa2d",
    	"sym-zpt": "fa2e",
    	"sym-zrc-s": "fa2f",
    	"sym-zrc": "fa30",
    	"sym-zrx-s": "fa31",
    	"sym-zrx": "fa32",
    	"sym-zsc-s": "fa33",
    	"sym-zsc": "fa34",
    	"sym-ztg-s": "fa35",
    	"sym-ztg": "fa36",
    	"ustc-s": "fa37",
    	ustc: ustc,
    	"cur-anct": "f1d2",
    	"cur-anct-s": "f1d1",
    	"cur-aud": "f204",
    	"cur-aud-s": "f203",
    	"cur-bnb": "f277",
    	"cur-bnb-s": "f276",
    	"sym-xbt": "f2a1",
    	"cur-btc": "f2a1",
    	"sym-xbt-s": "f2a0",
    	"cur-btc-s": "f2a0",
    	"cur-busd": "f2c1",
    	"cur-busd-s": "f2c0",
    	"exc-bitz": "f2c5",
    	"cur-bz": "f2c5",
    	"exc-bitz-s": "f2c4",
    	"cur-bz-s": "f2c4",
    	"cur-cad": "f2cf",
    	"cur-cad-s": "f2ce",
    	"cur-chf": "f2ef",
    	"cur-chf-s": "f2ee",
    	"cur-cny": "f313",
    	"cur-cny-s": "f312",
    	"sym-cs": "f327",
    	"sym-cs-s": "f326",
    	"sym-crm": "f33f",
    	"sym-crm-s": "f33e",
    	"cur-dai": "f36d",
    	"cur-dai-s": "f36c",
    	"sym-xdg": "f3ab",
    	"sym-xdg-s": "f3aa",
    	"cur-eos": "f3f8",
    	"cur-eos-s": "f3f7",
    	"sym-eth2": "f408",
    	"sym-eth2s": "f408",
    	"sym-eth2.s": "f408",
    	"cur-eth": "f408",
    	"sym-eth2-s": "f407",
    	"sym-eth2s-s": "f407",
    	"sym-eth2.s-s": "f407",
    	"cur-eth-s": "f407",
    	"cur-eur": "f412",
    	"cur-eur-s": "f411",
    	"cur-eurs": "f416",
    	"cur-eurs-s": "f415",
    	"sym-usdt": "f418",
    	"cur-usdt": "f418",
    	"sym-usdt-s": "f417",
    	"cur-usdt-s": "f417",
    	"exc-kraken": "f430",
    	"exc-kraken-futures": "f430",
    	"exc-kraken-s": "f42f",
    	"exc-kraken-futures-s": "f42f",
    	"cur-gbp": "f484",
    	"cur-gbp-s": "f483",
    	"exc-gemini": "f4cc",
    	"cur-gusd": "f4cc",
    	"exc-gemini-s": "f4cb",
    	"cur-gusd-s": "f4cb",
    	"cur-hkd": "f4f0",
    	"cur-hkd-s": "f4ef",
    	"sym-husd": "f50e",
    	"exc-huobi": "f50e",
    	"cur-ht": "f50e",
    	"sym-husd-s": "f50d",
    	"exc-huobi-s": "f50d",
    	"cur-ht-s": "f50d",
    	"cur-idr": "f52e",
    	"cur-idr-s": "f52d",
    	"sym-iota": "f556",
    	"sym-iota-s": "f555",
    	"cur-inr": "f548",
    	"cur-inr-s": "f547",
    	"cur-jpy": "f56c",
    	"cur-jpy-s": "f56b",
    	"cur-krw": "f59e",
    	"cur-krw-s": "f59d",
    	"sym-medx": "f61a",
    	"sym-medx-s": "f619",
    	"cur-mxn": "f672",
    	"cur-mxn-s": "f671",
    	"cur-myr": "f674",
    	"cur-myr-s": "f673",
    	"cur-ngn": "f69e",
    	"cur-ngn-s": "f69d",
    	"cur-pax": "f716",
    	"cur-pax-s": "f715",
    	"cur-php": "f72e",
    	"cur-php-s": "f72d",
    	"cur-pln": "f744",
    	"cur-pln-s": "f743",
    	"cur-qash": "f77c",
    	"cur-qash-s": "f77b",
    	"cur-rub": "f7fa",
    	"cur-rur": "f7fa",
    	"cur-rub-s": "f7f9",
    	"cur-rur-s": "f7f9",
    	"sym-steem": "f812",
    	"sym-steem-s": "f811",
    	"sym-xsc": "f816",
    	"sym-xsc-s": "f815",
    	"cur-sgd": "f832",
    	"cur-sgd-s": "f831",
    	"sym-storj": "f848",
    	"sym-storj-s": "f847",
    	"sym-tel": "f8cc",
    	"cur-trx": "f915",
    	"cur-trx-s": "f914",
    	"cur-tusd": "f925",
    	"cur-tusd-s": "f924",
    	"cur-usd": "f945",
    	"cur-usd-s": "f944",
    	"cur-usdc": "f947",
    	"cur-usdc-s": "f946",
    	"sym-vet": "f965",
    	"sym-vet-s": "f964",
    	"sym-waxp": "f997",
    	"sym-waxp-s": "f996",
    	"cur-xlm": "f9d7",
    	"cur-xlm-s": "f9d6",
    	"cur-xmr": "f9db",
    	"cur-xmr-s": "f9da",
    	"cur-xrp": "f9ef",
    	"cur-xrp-s": "f9ee",
    	"cur-zar": "fa17",
    	"cur-zar-s": "fa16",
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
    	"cur-crc": "f333",
    	"cur-crc-s": "f332",
    	"cur-lak": "f5a8",
    	"cur-lak-s": "f5a7",
    	"cur-sek": "f822",
    	"cur-sek-s": "f821",
    	"cur-thb": "f8db",
    	"cur-thb-s": "f8da",
    	"cur-try": "f917",
    	"cur-try-s": "f916",
    	"cur-uah": "f92b",
    	"cur-uah-s": "f92a",
    	"exc-ftx": "f464",
    	"exc-ftx-s": "f463",
    	"exc-ftx-us": "f464",
    	"exc-ftx-us-s": "f463",
    	"sym-cgld": "f2df",
    	"sym-cgld-s": "f2de",
    	"exc-uniswap-v2": "f93d",
    	"exc-uniswap-v2-s": "f93c",
    	"sym-kshib": "f838",
    	"sym-kshib-s": "f837",
    	"sym-easy-s": "f3cc",
    	"sym-srare": "f7a6",
    	"sym-srare-s": "f7a5",
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
    var arbi = "";
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
    var ethw = "Ethereum PoW Fork IOU";
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
    var gal = "Project Galaxy";
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
    var inj = "Injective";
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
    var lmwr = "";
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
    var syn = "Synapse";
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
    	arbi: arbi,
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
    	ethw: ethw,
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
    	lmwr: lmwr,
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
