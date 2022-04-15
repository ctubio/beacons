
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

    var beacons = {
    	"exc-_default-s": "f101",
    	"exc-_default": "f102",
    	"sym-_default-s": "f165",
    	"sym-_default": "f166",
    	"sym-d": "f166",
    	"sym-d-s": "f165",
    	"sym-default": "f166",
    	"sym-default-s": "f165",
    	"exc-d": "f102",
    	"exc-d-s": "f101",
    	"exc-default": "f102",
    	"exc-default-s": "f101",
    	"cur-default": "f166",
    	"cur-default-s": "f165",
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
    	"exc-cexio-s": "f123",
    	"exc-cexio": "f124",
    	"exc-cme-s": "f125",
    	"exc-cme": "f126",
    	"exc-coinbase-s": "f127",
    	"exc-coinbase": "f128",
    	"exc-coinbasepro-s": "f129",
    	"exc-coinbasepro": "f12a",
    	"exc-coinone-s": "f12b",
    	"exc-coinone": "f12c",
    	"exc-comex-s": "f12d",
    	"exc-comex": "f12e",
    	"exc-cryptofacilities-s": "f12f",
    	"exc-cryptofacilities": "f130",
    	"exc-deribit-s": "f131",
    	"exc-deribit": "f132",
    	"exc-dex-aggregated-s": "f133",
    	"exc-dex-aggregated": "f134",
    	"exc-gateio-s": "f135",
    	"exc-gateio": "f136",
    	"exc-hitbtc-s": "f137",
    	"exc-hitbtc": "f138",
    	"exc-kucoin-s": "f139",
    	"exc-kucoin": "f13a",
    	"exc-liquid-s": "f13b",
    	"exc-liquid": "f13c",
    	"exc-luno-s": "f13d",
    	"exc-luno": "f13e",
    	"exc-mtgox-s": "f13f",
    	"exc-mtgox": "f140",
    	"exc-mxc-s": "f141",
    	"exc-mxc": "f142",
    	"exc-nbatopshop-s": "f143",
    	"exc-nbatopshop": "f144",
    	"exc-nymex-s": "f145",
    	"exc-nymex": "f146",
    	"exc-okcoin-s": "f147",
    	"exc-okcoin": "f148",
    	"exc-okx-s": "f149",
    	"exc-okx": "f14a",
    	"exc-opensea-s": "f14b",
    	"exc-opensea": "f14c",
    	"exc-poloniex-s": "f14d",
    	"exc-poloniex": "f14e",
    	"exc-qryptos-s": "f14f",
    	"exc-qryptos": "f150",
    	"exc-quadrigacx-s": "f151",
    	"exc-quadrigacx": "f152",
    	"exc-quick-s": "f153",
    	"exc-quick": "f154",
    	"exc-quoine-s": "f155",
    	"exc-quoine": "f156",
    	"exc-rarible-s": "f157",
    	"exc-rarible": "f158",
    	"exc-totle-s": "f159",
    	"exc-totle": "f15a",
    	"exc-upbit-s": "f15b",
    	"exc-upbit": "f15c",
    	"exc-vaultofsatoshi-s": "f15d",
    	"exc-vaultofsatoshi": "f15e",
    	"exc-wex-s": "f15f",
    	"exc-wex": "f160",
    	"exc-zaif-s": "f161",
    	"exc-zaif": "f162",
    	"exc-zonda-s": "f163",
    	"exc-zonda": "f164",
    	"sym-1inch-s": "f167",
    	"sym-1inch": "f168",
    	"sym-1st-s": "f169",
    	"sym-1st": "f16a",
    	"sym-6a-s": "f16b",
    	"sym-6a": "f16c",
    	"sym-6b-s": "f16d",
    	"sym-6b": "f16e",
    	"sym-6c-s": "f16f",
    	"sym-6c": "f170",
    	"sym-6e-s": "f171",
    	"sym-6e": "f172",
    	"sym-6j-s": "f173",
    	"sym-6j": "f174",
    	"sym-6l-s": "f175",
    	"sym-6l": "f176",
    	"sym-6m-s": "f177",
    	"sym-6m": "f178",
    	"sym-6n-s": "f179",
    	"sym-6n": "f17a",
    	"sym-6s-s": "f17b",
    	"sym-6s": "f17c",
    	"sym-a38-s": "f17d",
    	"sym-a38": "f17e",
    	"sym-aac-s": "f17f",
    	"sym-aac": "f180",
    	"sym-aave-s": "f181",
    	"sym-aave": "f182",
    	"sym-abbc-s": "f183",
    	"sym-abbc": "f184",
    	"sym-abt-s": "f185",
    	"sym-abt": "f186",
    	"sym-abyss-s": "f187",
    	"sym-abyss": "f188",
    	"sym-aca-s": "f189",
    	"sym-aca": "f18a",
    	"sym-acat-s": "f18b",
    	"sym-acat": "f18c",
    	"sym-ach-s": "f18d",
    	"sym-ach": "f18e",
    	"sym-act-s": "f18f",
    	"sym-act": "f190",
    	"sym-ad0-s": "f191",
    	"sym-ad0": "f192",
    	"sym-ada-s": "f193",
    	"sym-ada": "f194",
    	"sym-adel-s": "f195",
    	"sym-adel": "f196",
    	"sym-adh-s": "f197",
    	"sym-adh": "f198",
    	"sym-adm-s": "f199",
    	"sym-adm": "f19a",
    	"sym-ado-s": "f19b",
    	"sym-ado": "f19c",
    	"sym-adt-s": "f19d",
    	"sym-adt": "f19e",
    	"sym-adx-s": "f19f",
    	"sym-adx": "f1a0",
    	"sym-ae-s": "f1a1",
    	"sym-ae": "f1a2",
    	"sym-aed-s": "f1a3",
    	"sym-aed": "f1a4",
    	"sym-aeon-s": "f1a5",
    	"sym-aeon": "f1a6",
    	"sym-aep-s": "f1a7",
    	"sym-aep": "f1a8",
    	"sym-aergo-s": "f1a9",
    	"sym-aergo": "f1aa",
    	"sym-agi-s": "f1ab",
    	"sym-agi": "f1ac",
    	"sym-agld-s": "f1ad",
    	"sym-agld": "f1ae",
    	"sym-aid-s": "f1af",
    	"sym-aid": "f1b0",
    	"sym-aion-s": "f1b1",
    	"sym-aion": "f1b2",
    	"sym-air-s": "f1b3",
    	"sym-air": "f1b4",
    	"sym-akro-s": "f1b5",
    	"sym-akro": "f1b6",
    	"sym-akt-s": "f1b7",
    	"sym-akt": "f1b8",
    	"sym-alcx-s": "f1b9",
    	"sym-alcx": "f1ba",
    	"sym-algo-s": "f1bb",
    	"sym-algo": "f1bc",
    	"sym-ali-s": "f1bd",
    	"sym-ali": "f1be",
    	"sym-alice-s": "f1bf",
    	"sym-alice": "f1c0",
    	"sym-alpha-s": "f1c1",
    	"sym-alpha": "f1c2",
    	"sym-amb-s": "f1c3",
    	"sym-amb": "f1c4",
    	"sym-amlt-s": "f1c5",
    	"sym-amlt": "f1c6",
    	"sym-amp-s": "f1c7",
    	"sym-amp": "f1c8",
    	"sym-ampl-s": "f1c9",
    	"sym-ampl": "f1ca",
    	"sym-anc-s": "f1cb",
    	"sym-anc": "f1cc",
    	"sym-anct-s": "f1cd",
    	"sym-anct": "f1ce",
    	"sym-ankr-s": "f1cf",
    	"sym-ankr": "f1d0",
    	"sym-ant-s": "f1d1",
    	"sym-ant": "f1d2",
    	"sym-ape-s": "f1d3",
    	"sym-ape": "f1d4",
    	"sym-api3-s": "f1d5",
    	"sym-api3": "f1d6",
    	"sym-apis-s": "f1d7",
    	"sym-apis": "f1d8",
    	"sym-appc-s": "f1d9",
    	"sym-appc": "f1da",
    	"sym-ar-s": "f1db",
    	"sym-ar": "f1dc",
    	"sym-ardr-s": "f1dd",
    	"sym-ardr": "f1de",
    	"sym-ark-s": "f1df",
    	"sym-ark": "f1e0",
    	"sym-arn-s": "f1e1",
    	"sym-arn": "f1e2",
    	"sym-arpa-s": "f1e3",
    	"sym-arpa": "f1e4",
    	"sym-art-s": "f1e5",
    	"sym-art": "f1e6",
    	"sym-aspt-s": "f1e7",
    	"sym-aspt": "f1e8",
    	"sym-ast-s": "f1e9",
    	"sym-ast": "f1ea",
    	"sym-astr-s": "f1eb",
    	"sym-astr": "f1ec",
    	"sym-at-s": "f1ed",
    	"sym-at": "f1ee",
    	"sym-atlas-s": "f1ef",
    	"sym-atlas": "f1f0",
    	"sym-atm-s": "f1f1",
    	"sym-atm": "f1f2",
    	"sym-atom-s": "f1f3",
    	"sym-atom": "f1f4",
    	"sym-atp-s": "f1f5",
    	"sym-atp": "f1f6",
    	"sym-atri-s": "f1f7",
    	"sym-atri": "f1f8",
    	"sym-auction-s": "f1f9",
    	"sym-auction": "f1fa",
    	"sym-aud-s": "f1fb",
    	"sym-aud": "f1fc",
    	"sym-audio-s": "f1fd",
    	"sym-audio": "f1fe",
    	"sym-aup-s": "f1ff",
    	"sym-aup": "f200",
    	"sym-aury-s": "f201",
    	"sym-aury": "f202",
    	"sym-auto-s": "f203",
    	"sym-auto": "f204",
    	"sym-ava-s": "f205",
    	"sym-ava": "f206",
    	"sym-avax-s": "f207",
    	"sym-avax": "f208",
    	"sym-avt-s": "f209",
    	"sym-avt": "f20a",
    	"sym-axp-s": "f20b",
    	"sym-axp": "f20c",
    	"sym-axs-s": "f20d",
    	"sym-axs": "f20e",
    	"sym-b": "f20f",
    	"sym-b0-s": "f210",
    	"sym-b0": "f211",
    	"sym-b2g-s": "f212",
    	"sym-b2g": "f213",
    	"sym-bab-s": "f214",
    	"sym-bab": "f215",
    	"sym-badger-s": "f216",
    	"sym-badger": "f217",
    	"sym-bake-s": "f218",
    	"sym-bake": "f219",
    	"sym-bal-s": "f21a",
    	"sym-bal": "f21b",
    	"sym-banca-s": "f21c",
    	"sym-banca": "f21d",
    	"sym-band-s": "f21e",
    	"sym-band": "f21f",
    	"sym-bat-s": "f220",
    	"sym-bat": "f221",
    	"sym-bay-s": "f222",
    	"sym-bay": "f223",
    	"sym-bbc-s": "f224",
    	"sym-bbc": "f225",
    	"sym-bcc-s": "f226",
    	"sym-bcc": "f227",
    	"sym-bcd-s": "f228",
    	"sym-bcd": "f229",
    	"sym-bch-s": "f22a",
    	"sym-bch": "f22b",
    	"sym-bci-s": "f22c",
    	"sym-bci": "f22d",
    	"sym-bcn-s": "f22e",
    	"sym-bcn": "f22f",
    	"sym-bcpt-s": "f230",
    	"sym-bcpt": "f231",
    	"sym-bcu-s": "f232",
    	"sym-bcu": "f233",
    	"sym-bcv-s": "f234",
    	"sym-bcv": "f235",
    	"sym-bcy-s": "f236",
    	"sym-bcy": "f237",
    	"sym-bdg-s": "f238",
    	"sym-bdg": "f239",
    	"sym-beam-s": "f23a",
    	"sym-beam": "f23b",
    	"sym-beet-s": "f23c",
    	"sym-beet": "f23d",
    	"sym-bel-s": "f23e",
    	"sym-bel": "f23f",
    	"sym-bela-s": "f240",
    	"sym-bela": "f241",
    	"sym-berry-s": "f242",
    	"sym-berry": "f243",
    	"sym-betr-s": "f244",
    	"sym-betr": "f245",
    	"sym-bez-s": "f246",
    	"sym-bez": "f247",
    	"sym-bft-s": "f248",
    	"sym-bft": "f249",
    	"sym-bfx-s": "f24a",
    	"sym-bfx": "f24b",
    	"sym-bhd-s": "f24c",
    	"sym-bhd": "f24d",
    	"sym-bht-s": "f24e",
    	"sym-bht": "f24f",
    	"sym-bico-s": "f250",
    	"sym-bico": "f251",
    	"sym-bitb-s": "f252",
    	"sym-bitb": "f253",
    	"sym-bix-s": "f254",
    	"sym-bix": "f255",
    	"sym-bk-s": "f256",
    	"sym-bk": "f257",
    	"sym-bkx-s": "f258",
    	"sym-bkx": "f259",
    	"sym-blk-s": "f25a",
    	"sym-blk": "f25b",
    	"sym-block-s": "f25c",
    	"sym-block": "f25d",
    	"sym-blt-s": "f25e",
    	"sym-blt": "f25f",
    	"sym-blz-s": "f260",
    	"sym-blz": "f261",
    	"sym-bmc-s": "f262",
    	"sym-bmc": "f263",
    	"sym-bnb-s": "f264",
    	"sym-bnb": "f265",
    	"sym-bnc-s": "f266",
    	"sym-bnc": "f267",
    	"sym-bnk-s": "f268",
    	"sym-bnk": "f269",
    	"sym-bnt-s": "f26a",
    	"sym-bnt": "f26b",
    	"sym-bo-s": "f26c",
    	"sym-bo": "f26d",
    	"sym-bond-s": "f26e",
    	"sym-bond": "f26f",
    	"sym-boo-s": "f270",
    	"sym-boo": "f271",
    	"sym-bor-s": "f272",
    	"sym-bor": "f273",
    	"sym-bora-s": "f274",
    	"sym-bora": "f275",
    	"sym-bos-s": "f276",
    	"sym-bos": "f277",
    	"sym-box-s": "f278",
    	"sym-box": "f279",
    	"sym-brd-s": "f27a",
    	"sym-brd": "f27b",
    	"sym-brg-s": "f27c",
    	"sym-brg": "f27d",
    	"sym-brick-s": "f27e",
    	"sym-brick": "f27f",
    	"sym-bsd-s": "f280",
    	"sym-bsd": "f281",
    	"sym-bsv-s": "f282",
    	"sym-bsv": "f283",
    	"sym-bsx-s": "f284",
    	"sym-bsx": "f285",
    	"sym-bt1-s": "f286",
    	"sym-bt1": "f287",
    	"sym-bt2-s": "f288",
    	"sym-bt2": "f289",
    	"sym-btc-s": "f28a",
    	"sym-btc": "f28b",
    	"sym-btcd-s": "f28c",
    	"sym-btcd": "f28d",
    	"sym-btcfx-s": "f28e",
    	"sym-btcfx": "f28f",
    	"sym-btcp-s": "f290",
    	"sym-btcp": "f291",
    	"sym-btg-s": "f292",
    	"sym-btg": "f293",
    	"sym-btm-s": "f294",
    	"sym-btm": "f295",
    	"sym-btn-s": "f296",
    	"sym-btn": "f297",
    	"sym-bto-s": "f298",
    	"sym-bto": "f299",
    	"sym-btrst-s": "f29a",
    	"sym-btrst": "f29b",
    	"sym-bts-s": "f29c",
    	"sym-bts": "f29d",
    	"sym-btt-s": "f29e",
    	"sym-btt": "f29f",
    	"sym-btu-s": "f2a0",
    	"sym-btu": "f2a1",
    	"sym-btx-s": "f2a2",
    	"sym-btx": "f2a3",
    	"sym-burger-s": "f2a4",
    	"sym-burger": "f2a5",
    	"sym-burst-s": "f2a6",
    	"sym-burst": "f2a7",
    	"sym-bus-s": "f2a8",
    	"sym-bus": "f2a9",
    	"sym-busd-s": "f2aa",
    	"sym-busd": "f2ab",
    	"sym-bwx-s": "f2ac",
    	"sym-bwx": "f2ad",
    	"sym-bz-s": "f2ae",
    	"sym-bz": "f2af",
    	"sym-bzrx-s": "f2b0",
    	"sym-bzrx": "f2b1",
    	"sym-c-s": "f2b2",
    	"sym-c": "f2b3",
    	"sym-c20-s": "f2b4",
    	"sym-c20": "f2b5",
    	"sym-c98-s": "f2b6",
    	"sym-c98": "f2b7",
    	"sym-cad-s": "f2b8",
    	"sym-cad": "f2b9",
    	"sym-cake-s": "f2ba",
    	"sym-cake": "f2bb",
    	"sym-cas-s": "f2bc",
    	"sym-cas": "f2bd",
    	"sym-cat-s": "f2be",
    	"sym-cat": "f2bf",
    	"sym-cbc-s": "f2c0",
    	"sym-cbc": "f2c1",
    	"sym-cbt-s": "f2c2",
    	"sym-cbt": "f2c3",
    	"sym-cdt-s": "f2c4",
    	"sym-cdt": "f2c5",
    	"sym-cel-s": "f2c6",
    	"sym-cel": "f2c7",
    	"sym-celo-s": "f2c8",
    	"sym-celo": "f2c9",
    	"sym-celr-s": "f2ca",
    	"sym-celr": "f2cb",
    	"sym-cennz-s": "f2cc",
    	"sym-cennz": "f2cd",
    	"sym-cfg-s": "f2ce",
    	"sym-cfg": "f2cf",
    	"sym-cfi-s": "f2d0",
    	"sym-cfi": "f2d1",
    	"sym-cfx-s": "f2d2",
    	"sym-cfx": "f2d3",
    	"sym-cgt-s": "f2d4",
    	"sym-cgt": "f2d5",
    	"sym-chat-s": "f2d6",
    	"sym-chat": "f2d7",
    	"sym-chf-s": "f2d8",
    	"sym-chf": "f2d9",
    	"sym-chp-s": "f2da",
    	"sym-chp": "f2db",
    	"sym-chr-s": "f2dc",
    	"sym-chr": "f2dd",
    	"sym-chsb-s": "f2de",
    	"sym-chsb": "f2df",
    	"sym-chx-s": "f2e0",
    	"sym-chx": "f2e1",
    	"sym-chz-s": "f2e2",
    	"sym-chz": "f2e3",
    	"sym-ckb-s": "f2e4",
    	"sym-ckb": "f2e5",
    	"sym-cl-s": "f2e6",
    	"sym-cl": "f2e7",
    	"sym-clam-s": "f2e8",
    	"sym-clam": "f2e9",
    	"sym-cln-s": "f2ea",
    	"sym-cln": "f2eb",
    	"sym-clo-s": "f2ec",
    	"sym-clo": "f2ed",
    	"sym-cloak-s": "f2ee",
    	"sym-cloak": "f2ef",
    	"sym-clv-s": "f2f0",
    	"sym-clv": "f2f1",
    	"sym-cmct-s": "f2f2",
    	"sym-cmct": "f2f3",
    	"sym-cmt-s": "f2f4",
    	"sym-cmt": "f2f5",
    	"sym-cnd-s": "f2f6",
    	"sym-cnd": "f2f7",
    	"sym-cnn-s": "f2f8",
    	"sym-cnn": "f2f9",
    	"sym-cnx-s": "f2fa",
    	"sym-cnx": "f2fb",
    	"sym-cny-s": "f2fc",
    	"sym-cny": "f2fd",
    	"sym-cob-s": "f2fe",
    	"sym-cob": "f2ff",
    	"sym-cocos-s": "f300",
    	"sym-cocos": "f301",
    	"sym-comp-s": "f302",
    	"sym-comp": "f303",
    	"sym-cope-s": "f304",
    	"sym-cope": "f305",
    	"sym-cos-s": "f306",
    	"sym-cos": "f307",
    	"sym-cosm-s": "f308",
    	"sym-cosm": "f309",
    	"sym-coss-s": "f30a",
    	"sym-coss": "f30b",
    	"sym-coti-s": "f30c",
    	"sym-coti": "f30d",
    	"sym-cov-s": "f30e",
    	"sym-cov": "f30f",
    	"sym-cova-s": "f310",
    	"sym-cova": "f311",
    	"sym-cpt-s": "f312",
    	"sym-cpt": "f313",
    	"sym-cpx-s": "f314",
    	"sym-cpx": "f315",
    	"sym-cqt-s": "f316",
    	"sym-cqt": "f317",
    	"sym-cra-s": "f318",
    	"sym-cra": "f319",
    	"sym-crab-s": "f31a",
    	"sym-crab": "f31b",
    	"sym-crc-s": "f31c",
    	"sym-crc": "f31d",
    	"sym-cre-s": "f31e",
    	"sym-cre": "f31f",
    	"sym-cream-s": "f320",
    	"sym-cream": "f321",
    	"sym-cring-s": "f322",
    	"sym-cring": "f323",
    	"sym-cro-s": "f324",
    	"sym-cro": "f325",
    	"sym-crpt-s": "f326",
    	"sym-crpt": "f327",
    	"sym-cru-s": "f328",
    	"sym-cru": "f329",
    	"sym-crv-s": "f32a",
    	"sym-crv": "f32b",
    	"sym-crw-s": "f32c",
    	"sym-crw": "f32d",
    	"sym-csm-s": "f32e",
    	"sym-csm": "f32f",
    	"sym-csx-s": "f330",
    	"sym-csx": "f331",
    	"sym-ctc-s": "f332",
    	"sym-ctc": "f333",
    	"sym-ctk-s": "f334",
    	"sym-ctk": "f335",
    	"sym-ctsi-s": "f336",
    	"sym-ctsi": "f337",
    	"sym-ctxc-s": "f338",
    	"sym-ctxc": "f339",
    	"sym-cur-s": "f33a",
    	"sym-cur": "f33b",
    	"sym-cvc-s": "f33c",
    	"sym-cvc": "f33d",
    	"sym-cvcoin-s": "f33e",
    	"sym-cvcoin": "f33f",
    	"sym-cvnt-s": "f340",
    	"sym-cvnt": "f341",
    	"sym-cvp-s": "f342",
    	"sym-cvp": "f343",
    	"sym-cvt-s": "f344",
    	"sym-cvt": "f345",
    	"sym-cvx-s": "f346",
    	"sym-cvx": "f347",
    	"sym-cw-s": "f348",
    	"sym-cw": "f349",
    	"sym-cyc-s": "f34a",
    	"sym-cyc": "f34b",
    	"sym-dac-s": "f34c",
    	"sym-dac": "f34d",
    	"sym-dacs-s": "f34e",
    	"sym-dacs": "f34f",
    	"sym-dadi-s": "f350",
    	"sym-dadi": "f351",
    	"sym-dag-s": "f352",
    	"sym-dag": "f353",
    	"sym-dai-s": "f354",
    	"sym-dai": "f355",
    	"sym-dao-s": "f356",
    	"sym-dao": "f357",
    	"sym-dar-s": "f358",
    	"sym-dar": "f359",
    	"sym-dash-s": "f35a",
    	"sym-dash": "f35b",
    	"sym-dat-s": "f35c",
    	"sym-dat": "f35d",
    	"sym-data-s": "f35e",
    	"sym-data": "f35f",
    	"sym-datx-s": "f360",
    	"sym-datx": "f361",
    	"sym-dbc-s": "f362",
    	"sym-dbc": "f363",
    	"sym-dbet-s": "f364",
    	"sym-dbet": "f365",
    	"sym-dbix-s": "f366",
    	"sym-dbix": "f367",
    	"sym-dcn-s": "f368",
    	"sym-dcn": "f369",
    	"sym-dcr-s": "f36a",
    	"sym-dcr": "f36b",
    	"sym-dct-s": "f36c",
    	"sym-dct": "f36d",
    	"sym-ddd-s": "f36e",
    	"sym-ddd": "f36f",
    	"sym-dego-s": "f370",
    	"sym-dego": "f371",
    	"sym-dent-s": "f372",
    	"sym-dent": "f373",
    	"sym-dgb-s": "f374",
    	"sym-dgb": "f375",
    	"sym-dgd-s": "f376",
    	"sym-dgd": "f377",
    	"sym-dgtx-s": "f378",
    	"sym-dgtx": "f379",
    	"sym-dgx-s": "f37a",
    	"sym-dgx": "f37b",
    	"sym-dhx-s": "f37c",
    	"sym-dhx": "f37d",
    	"sym-dia-s": "f37e",
    	"sym-dia": "f37f",
    	"sym-dice-s": "f380",
    	"sym-dice": "f381",
    	"sym-dim-s": "f382",
    	"sym-dim": "f383",
    	"sym-dlt-s": "f384",
    	"sym-dlt": "f385",
    	"sym-dmd-s": "f386",
    	"sym-dmd": "f387",
    	"sym-dmt-s": "f388",
    	"sym-dmt": "f389",
    	"sym-dnt-s": "f38a",
    	"sym-dnt": "f38b",
    	"sym-dock-s": "f38c",
    	"sym-dock": "f38d",
    	"sym-dodo-s": "f38e",
    	"sym-dodo": "f38f",
    	"sym-doge-s": "f390",
    	"sym-doge": "f391",
    	"sym-dot-s": "f392",
    	"sym-dot": "f393",
    	"sym-dpy-s": "f394",
    	"sym-dpy": "f395",
    	"sym-dream-s": "f396",
    	"sym-dream": "f397",
    	"sym-drep-s": "f398",
    	"sym-drep": "f399",
    	"sym-drg-s": "f39a",
    	"sym-drg": "f39b",
    	"sym-drgn-s": "f39c",
    	"sym-drgn": "f39d",
    	"sym-drt-s": "f39e",
    	"sym-drt": "f39f",
    	"sym-dta-s": "f3a0",
    	"sym-dta": "f3a1",
    	"sym-dtb-s": "f3a2",
    	"sym-dtb": "f3a3",
    	"sym-dtr-s": "f3a4",
    	"sym-dtr": "f3a5",
    	"sym-dusk-s": "f3a6",
    	"sym-dusk": "f3a7",
    	"sym-dx-s": "f3a8",
    	"sym-dx": "f3a9",
    	"sym-dydx-s": "f3aa",
    	"sym-dydx": "f3ab",
    	"sym-dyn-s": "f3ac",
    	"sym-dyn": "f3ad",
    	"sym-easy": "f3ae",
    	"sym-ecom-s": "f3af",
    	"sym-ecom": "f3b0",
    	"sym-edc-s": "f3b1",
    	"sym-edc": "f3b2",
    	"sym-edg-s": "f3b3",
    	"sym-edg": "f3b4",
    	"sym-edo-s": "f3b5",
    	"sym-edo": "f3b6",
    	"sym-edp-s": "f3b7",
    	"sym-edp": "f3b8",
    	"sym-edr-s": "f3b9",
    	"sym-edr": "f3ba",
    	"sym-efi-s": "f3bb",
    	"sym-efi": "f3bc",
    	"sym-egld-s": "f3bd",
    	"sym-egld": "f3be",
    	"sym-egt-s": "f3bf",
    	"sym-egt": "f3c0",
    	"sym-ehr-s": "f3c1",
    	"sym-ehr": "f3c2",
    	"sym-eko-s": "f3c3",
    	"sym-eko": "f3c4",
    	"sym-ekt-s": "f3c5",
    	"sym-ekt": "f3c6",
    	"sym-ela-s": "f3c7",
    	"sym-ela": "f3c8",
    	"sym-elec-s": "f3c9",
    	"sym-elec": "f3ca",
    	"sym-elf-s": "f3cb",
    	"sym-elf": "f3cc",
    	"sym-em-s": "f3cd",
    	"sym-em": "f3ce",
    	"sym-emc-s": "f3cf",
    	"sym-emc": "f3d0",
    	"sym-emc2-s": "f3d1",
    	"sym-emc2": "f3d2",
    	"sym-eng-s": "f3d3",
    	"sym-eng": "f3d4",
    	"sym-enj-s": "f3d5",
    	"sym-enj": "f3d6",
    	"sym-ens-s": "f3d7",
    	"sym-ens": "f3d8",
    	"sym-eos-s": "f3d9",
    	"sym-eos": "f3da",
    	"sym-eosdac-s": "f3db",
    	"sym-eosdac": "f3dc",
    	"sym-eq-s": "f3dd",
    	"sym-eq": "f3de",
    	"sym-erd-s": "f3df",
    	"sym-erd": "f3e0",
    	"sym-ern-s": "f3e1",
    	"sym-ern": "f3e2",
    	"sym-es": "f3e3",
    	"sym-es-s": "f3e4",
    	"sym-esd-s": "f3e5",
    	"sym-esd": "f3e6",
    	"sym-etc-s": "f3e7",
    	"sym-etc": "f3e8",
    	"sym-eth-s": "f3e9",
    	"sym-eth": "f3ea",
    	"sym-ethup-s": "f3eb",
    	"sym-ethup": "f3ec",
    	"sym-etn-s": "f3ed",
    	"sym-etn": "f3ee",
    	"sym-etp-s": "f3ef",
    	"sym-etp": "f3f0",
    	"sym-eur-s": "f3f1",
    	"sym-eur": "f3f2",
    	"sym-eurs-s": "f3f3",
    	"sym-eurs": "f3f4",
    	"sym-eurt-s": "f3f5",
    	"sym-eurt": "f3f6",
    	"sym-evn-s": "f3f7",
    	"sym-evn": "f3f8",
    	"sym-evx-s": "f3f9",
    	"sym-evx": "f3fa",
    	"sym-ewt-s": "f3fb",
    	"sym-ewt": "f3fc",
    	"sym-exp-s": "f3fd",
    	"sym-exp": "f3fe",
    	"sym-exrd-s": "f3ff",
    	"sym-exrd": "f400",
    	"sym-exy-s": "f401",
    	"sym-exy": "f402",
    	"sym-ez-s": "f403",
    	"sym-ez": "f404",
    	"sym-fair-s": "f405",
    	"sym-fair": "f406",
    	"sym-farm-s": "f407",
    	"sym-farm": "f408",
    	"sym-fct-s": "f409",
    	"sym-fct": "f40a",
    	"sym-fdz-s": "f40b",
    	"sym-fdz": "f40c",
    	"sym-fee-s": "f40d",
    	"sym-fee": "f40e",
    	"sym-fet-s": "f40f",
    	"sym-fet": "f410",
    	"sym-fida-s": "f411",
    	"sym-fida": "f412",
    	"sym-fil-s": "f413",
    	"sym-fil": "f414",
    	"sym-fio-s": "f415",
    	"sym-fio": "f416",
    	"sym-firo-s": "f417",
    	"sym-firo": "f418",
    	"sym-fis-s": "f419",
    	"sym-fis": "f41a",
    	"sym-fldc-s": "f41b",
    	"sym-fldc": "f41c",
    	"sym-flo-s": "f41d",
    	"sym-flo": "f41e",
    	"sym-floki-s": "f41f",
    	"sym-floki": "f420",
    	"sym-flow-s": "f421",
    	"sym-flow": "f422",
    	"sym-flr-s": "f423",
    	"sym-flr": "f424",
    	"sym-fluz-s": "f425",
    	"sym-fluz": "f426",
    	"sym-fnb-s": "f427",
    	"sym-fnb": "f428",
    	"sym-foam-s": "f429",
    	"sym-foam": "f42a",
    	"sym-for-s": "f42b",
    	"sym-for": "f42c",
    	"sym-forth-s": "f42d",
    	"sym-forth": "f42e",
    	"sym-fota-s": "f42f",
    	"sym-fota": "f430",
    	"sym-frax-s": "f431",
    	"sym-frax": "f432",
    	"sym-front-s": "f433",
    	"sym-front": "f434",
    	"sym-fsn-s": "f435",
    	"sym-fsn": "f436",
    	"sym-ftc-s": "f437",
    	"sym-ftc": "f438",
    	"sym-fti-s": "f439",
    	"sym-fti": "f43a",
    	"sym-ftm-s": "f43b",
    	"sym-ftm": "f43c",
    	"sym-ftt-s": "f43d",
    	"sym-ftt": "f43e",
    	"sym-ftx-s": "f43f",
    	"sym-ftx": "f440",
    	"sym-fuel-s": "f441",
    	"sym-fuel": "f442",
    	"sym-fun-s": "f443",
    	"sym-fun": "f444",
    	"sym-fx-s": "f445",
    	"sym-fx": "f446",
    	"sym-fxc-s": "f447",
    	"sym-fxc": "f448",
    	"sym-fxs-s": "f449",
    	"sym-fxs": "f44a",
    	"sym-fxt-s": "f44b",
    	"sym-fxt": "f44c",
    	"sym-gala-s": "f44d",
    	"sym-gala": "f44e",
    	"sym-game-s": "f44f",
    	"sym-game": "f450",
    	"sym-gard-s": "f451",
    	"sym-gard": "f452",
    	"sym-gari-s": "f453",
    	"sym-gari": "f454",
    	"sym-gas-s": "f455",
    	"sym-gas": "f456",
    	"sym-gbc-s": "f457",
    	"sym-gbc": "f458",
    	"sym-gbp-s": "f459",
    	"sym-gbp": "f45a",
    	"sym-gbx-s": "f45b",
    	"sym-gbx": "f45c",
    	"sym-gbyte-s": "f45d",
    	"sym-gbyte": "f45e",
    	"sym-gc-s": "f45f",
    	"sym-gc": "f460",
    	"sym-gcc-s": "f461",
    	"sym-gcc": "f462",
    	"sym-ge-s": "f463",
    	"sym-ge": "f464",
    	"sym-geist-s": "f465",
    	"sym-geist": "f466",
    	"sym-gen-s": "f467",
    	"sym-gen": "f468",
    	"sym-gens-s": "f469",
    	"sym-gens": "f46a",
    	"sym-get-s": "f46b",
    	"sym-get": "f46c",
    	"sym-ghst-s": "f46d",
    	"sym-ghst": "f46e",
    	"sym-glc-s": "f46f",
    	"sym-glc": "f470",
    	"sym-gld-s": "f471",
    	"sym-gld": "f472",
    	"sym-glm-s": "f473",
    	"sym-glm": "f474",
    	"sym-glmr-s": "f475",
    	"sym-glmr": "f476",
    	"sym-gmat-s": "f477",
    	"sym-gmat": "f478",
    	"sym-gmt-s": "f479",
    	"sym-gmt": "f47a",
    	"sym-gno-s": "f47b",
    	"sym-gno": "f47c",
    	"sym-gnt-s": "f47d",
    	"sym-gnt": "f47e",
    	"sym-gnx-s": "f47f",
    	"sym-gnx": "f480",
    	"sym-go-s": "f481",
    	"sym-go": "f482",
    	"sym-gods-s": "f483",
    	"sym-gods": "f484",
    	"sym-got-s": "f485",
    	"sym-got": "f486",
    	"sym-grc-s": "f487",
    	"sym-grc": "f488",
    	"sym-grin-s": "f489",
    	"sym-grin": "f48a",
    	"sym-grs-s": "f48b",
    	"sym-grs": "f48c",
    	"sym-grt-s": "f48d",
    	"sym-grt": "f48e",
    	"sym-gsc-s": "f48f",
    	"sym-gsc": "f490",
    	"sym-gst-s": "f491",
    	"sym-gst": "f492",
    	"sym-gt-s": "f493",
    	"sym-gt": "f494",
    	"sym-gtc-s": "f495",
    	"sym-gtc": "f496",
    	"sym-gtc2-s": "f497",
    	"sym-gtc2": "f498",
    	"sym-gto-s": "f499",
    	"sym-gto": "f49a",
    	"sym-gup-s": "f49b",
    	"sym-gup": "f49c",
    	"sym-gusd-s": "f49d",
    	"sym-gusd": "f49e",
    	"sym-gvt-s": "f49f",
    	"sym-gvt": "f4a0",
    	"sym-gxc-s": "f4a1",
    	"sym-gxc": "f4a2",
    	"sym-gxs-s": "f4a3",
    	"sym-gxs": "f4a4",
    	"sym-hard-s": "f4a5",
    	"sym-hard": "f4a6",
    	"sym-hbar-s": "f4a7",
    	"sym-hbar": "f4a8",
    	"sym-hc-s": "f4a9",
    	"sym-hc": "f4aa",
    	"sym-hdx-s": "f4ab",
    	"sym-hdx": "f4ac",
    	"sym-hedg-s": "f4ad",
    	"sym-hedg": "f4ae",
    	"sym-hegic-s": "f4af",
    	"sym-hegic": "f4b0",
    	"sym-hex-s": "f4b1",
    	"sym-hex": "f4b2",
    	"sym-hft-s": "f4b3",
    	"sym-hft": "f4b4",
    	"sym-hg-s": "f4b5",
    	"sym-hg": "f4b6",
    	"sym-hgs-s": "f4b7",
    	"sym-hgs": "f4b8",
    	"sym-hh-s": "f4b9",
    	"sym-hh": "f4ba",
    	"sym-high-s": "f4bb",
    	"sym-high": "f4bc",
    	"sym-hit-s": "f4bd",
    	"sym-hit": "f4be",
    	"sym-hive-s": "f4bf",
    	"sym-hive": "f4c0",
    	"sym-hkd-s": "f4c1",
    	"sym-hkd": "f4c2",
    	"sym-hmq-s": "f4c3",
    	"sym-hmq": "f4c4",
    	"sym-hns-s": "f4c5",
    	"sym-hns": "f4c6",
    	"sym-ho-s": "f4c7",
    	"sym-ho": "f4c8",
    	"sym-hot-s": "f4c9",
    	"sym-hot": "f4ca",
    	"sym-hp-s": "f4cb",
    	"sym-hp": "f4cc",
    	"sym-hpb-s": "f4cd",
    	"sym-hpb": "f4ce",
    	"sym-hpc-s": "f4cf",
    	"sym-hpc": "f4d0",
    	"sym-hpt-s": "f4d1",
    	"sym-hpt": "f4d2",
    	"sym-hrc-s": "f4d3",
    	"sym-hrc": "f4d4",
    	"sym-hsc-s": "f4d5",
    	"sym-hsc": "f4d6",
    	"sym-hsr-s": "f4d7",
    	"sym-hsr": "f4d8",
    	"sym-hst-s": "f4d9",
    	"sym-hst": "f4da",
    	"sym-ht-s": "f4db",
    	"sym-ht": "f4dc",
    	"sym-html-s": "f4dd",
    	"sym-html": "f4de",
    	"sym-htt-s": "f4df",
    	"sym-htt": "f4e0",
    	"sym-huc-s": "f4e1",
    	"sym-huc": "f4e2",
    	"sym-hvn-s": "f4e3",
    	"sym-hvn": "f4e4",
    	"sym-hxro-s": "f4e5",
    	"sym-hxro": "f4e6",
    	"sym-hyc-s": "f4e7",
    	"sym-hyc": "f4e8",
    	"sym-hydra-s": "f4e9",
    	"sym-hydra": "f4ea",
    	"sym-hydro-s": "f4eb",
    	"sym-hydro": "f4ec",
    	"sym-icn-s": "f4ed",
    	"sym-icn": "f4ee",
    	"sym-icos-s": "f4ef",
    	"sym-icos": "f4f0",
    	"sym-icp-s": "f4f1",
    	"sym-icp": "f4f2",
    	"sym-icx-s": "f4f3",
    	"sym-icx": "f4f4",
    	"sym-idex-s": "f4f5",
    	"sym-idex": "f4f6",
    	"sym-idh-s": "f4f7",
    	"sym-idh": "f4f8",
    	"sym-idr-s": "f4f9",
    	"sym-idr": "f4fa",
    	"sym-ift-s": "f4fb",
    	"sym-ift": "f4fc",
    	"sym-ignis-s": "f4fd",
    	"sym-ignis": "f4fe",
    	"sym-ihf-s": "f4ff",
    	"sym-ihf": "f500",
    	"sym-iht-s": "f501",
    	"sym-iht": "f502",
    	"sym-ilc-s": "f503",
    	"sym-ilc": "f504",
    	"sym-ilv-s": "f505",
    	"sym-ilv": "f506",
    	"sym-imx-s": "f507",
    	"sym-imx": "f508",
    	"sym-incnt-s": "f509",
    	"sym-incnt": "f50a",
    	"sym-ind-s": "f50b",
    	"sym-ind": "f50c",
    	"sym-indi-s": "f50d",
    	"sym-indi": "f50e",
    	"sym-inj-s": "f50f",
    	"sym-inj": "f510",
    	"sym-ink-s": "f511",
    	"sym-ink": "f512",
    	"sym-inr-s": "f513",
    	"sym-inr": "f514",
    	"sym-ins-s": "f515",
    	"sym-ins": "f516",
    	"sym-int-s": "f517",
    	"sym-int": "f518",
    	"sym-intr-s": "f519",
    	"sym-intr": "f51a",
    	"sym-ioc-s": "f51b",
    	"sym-ioc": "f51c",
    	"sym-ion-s": "f51d",
    	"sym-ion": "f51e",
    	"sym-iost-s": "f51f",
    	"sym-iost": "f520",
    	"sym-iot-s": "f521",
    	"sym-iot": "f522",
    	"sym-iotx-s": "f523",
    	"sym-iotx": "f524",
    	"sym-iq-s": "f525",
    	"sym-iq": "f526",
    	"sym-iris-s": "f527",
    	"sym-iris": "f528",
    	"sym-itc-s": "f529",
    	"sym-itc": "f52a",
    	"sym-ivy-s": "f52b",
    	"sym-ivy": "f52c",
    	"sym-ixt-s": "f52d",
    	"sym-ixt": "f52e",
    	"sym-jasmy-s": "f52f",
    	"sym-jasmy": "f530",
    	"sym-jnt-s": "f531",
    	"sym-jnt": "f532",
    	"sym-joe-s": "f533",
    	"sym-joe": "f534",
    	"sym-jpy-s": "f535",
    	"sym-jpy": "f536",
    	"sym-jst-s": "f537",
    	"sym-jst": "f538",
    	"sym-juno-s": "f539",
    	"sym-juno": "f53a",
    	"sym-juv-s": "f53b",
    	"sym-juv": "f53c",
    	"sym-kan-s": "f53d",
    	"sym-kan": "f53e",
    	"sym-kar-s": "f53f",
    	"sym-kar": "f540",
    	"sym-kava-s": "f541",
    	"sym-kava": "f542",
    	"sym-kbc-s": "f543",
    	"sym-kbc": "f544",
    	"sym-kcash-s": "f545",
    	"sym-kcash": "f546",
    	"sym-kda-s": "f547",
    	"sym-kda": "f548",
    	"sym-keep-s": "f549",
    	"sym-keep": "f54a",
    	"sym-key-s": "f54b",
    	"sym-key": "f54c",
    	"sym-kick-s": "f54d",
    	"sym-kick": "f54e",
    	"sym-kilt-s": "f54f",
    	"sym-kilt": "f550",
    	"sym-kin-s": "f551",
    	"sym-kin": "f552",
    	"sym-kint-s": "f553",
    	"sym-kint": "f554",
    	"sym-klay-s": "f555",
    	"sym-klay": "f556",
    	"sym-kma-s": "f557",
    	"sym-kma": "f558",
    	"sym-kmd-s": "f559",
    	"sym-kmd": "f55a",
    	"sym-knc-s": "f55b",
    	"sym-knc": "f55c",
    	"sym-kore-s": "f55d",
    	"sym-kore": "f55e",
    	"sym-kp3r-s": "f55f",
    	"sym-kp3r": "f560",
    	"sym-krm-s": "f561",
    	"sym-krm": "f562",
    	"sym-krw-s": "f563",
    	"sym-krw": "f564",
    	"sym-ksm-s": "f565",
    	"sym-ksm": "f566",
    	"sym-ksx-s": "f567",
    	"sym-ksx": "f568",
    	"sym-kyl-s": "f569",
    	"sym-kyl": "f56a",
    	"sym-la-s": "f56b",
    	"sym-la": "f56c",
    	"sym-lak-s": "f56d",
    	"sym-lak": "f56e",
    	"sym-lamb-s": "f56f",
    	"sym-lamb": "f570",
    	"sym-latx-s": "f571",
    	"sym-latx": "f572",
    	"sym-layr-s": "f573",
    	"sym-layr": "f574",
    	"sym-lba-s": "f575",
    	"sym-lba": "f576",
    	"sym-lbc-s": "f577",
    	"sym-lbc": "f578",
    	"sym-lcc-s": "f579",
    	"sym-lcc": "f57a",
    	"sym-lcx-s": "f57b",
    	"sym-lcx": "f57c",
    	"sym-ldo-s": "f57d",
    	"sym-ldo": "f57e",
    	"sym-lend-s": "f57f",
    	"sym-lend": "f580",
    	"sym-leo-s": "f581",
    	"sym-leo": "f582",
    	"sym-leoc-s": "f583",
    	"sym-leoc": "f584",
    	"sym-let-s": "f585",
    	"sym-let": "f586",
    	"sym-life-s": "f587",
    	"sym-life": "f588",
    	"sym-lina-s": "f589",
    	"sym-lina": "f58a",
    	"sym-link-s": "f58b",
    	"sym-link": "f58c",
    	"sym-lit-s": "f58d",
    	"sym-lit": "f58e",
    	"sym-lmc-s": "f58f",
    	"sym-lmc": "f590",
    	"sym-lml-s": "f591",
    	"sym-lml": "f592",
    	"sym-lnc-s": "f593",
    	"sym-lnc": "f594",
    	"sym-lnd-s": "f595",
    	"sym-lnd": "f596",
    	"sym-loc-s": "f597",
    	"sym-loc": "f598",
    	"sym-looks-s": "f599",
    	"sym-looks": "f59a",
    	"sym-loom-s": "f59b",
    	"sym-loom": "f59c",
    	"sym-lpt-s": "f59d",
    	"sym-lpt": "f59e",
    	"sym-lrc-s": "f59f",
    	"sym-lrc": "f5a0",
    	"sym-lrn-s": "f5a1",
    	"sym-lrn": "f5a2",
    	"sym-lsk-s": "f5a3",
    	"sym-lsk": "f5a4",
    	"sym-ltc-s": "f5a5",
    	"sym-ltc": "f5a6",
    	"sym-lto-s": "f5a7",
    	"sym-lto": "f5a8",
    	"sym-lun-s": "f5a9",
    	"sym-lun": "f5aa",
    	"sym-luna-s": "f5ab",
    	"sym-luna": "f5ac",
    	"sym-lxt-s": "f5ad",
    	"sym-lxt": "f5ae",
    	"sym-lym-s": "f5af",
    	"sym-lym": "f5b0",
    	"sym-m2k-s": "f5b1",
    	"sym-m2k": "f5b2",
    	"sym-ma-s": "f5b3",
    	"sym-ma": "f5b4",
    	"sym-maid-s": "f5b5",
    	"sym-maid": "f5b6",
    	"sym-man-s": "f5b7",
    	"sym-man": "f5b8",
    	"sym-mana-s": "f5b9",
    	"sym-mana": "f5ba",
    	"sym-mask-s": "f5bb",
    	"sym-mask": "f5bc",
    	"sym-mass-s": "f5bd",
    	"sym-mass": "f5be",
    	"sym-matic-s": "f5bf",
    	"sym-matic": "f5c0",
    	"sym-mbl-s": "f5c1",
    	"sym-mbl": "f5c2",
    	"sym-mbt-s": "f5c3",
    	"sym-mbt": "f5c4",
    	"sym-mc-s": "f5c5",
    	"sym-mc": "f5c6",
    	"sym-mco-s": "f5c7",
    	"sym-mco": "f5c8",
    	"sym-mda-s": "f5c9",
    	"sym-mda": "f5ca",
    	"sym-mds-s": "f5cb",
    	"sym-mds": "f5cc",
    	"sym-mdt-s": "f5cd",
    	"sym-mdt": "f5ce",
    	"sym-mdx-s": "f5cf",
    	"sym-mdx": "f5d0",
    	"sym-med-s": "f5d1",
    	"sym-med": "f5d2",
    	"sym-mer-s": "f5d3",
    	"sym-mer": "f5d4",
    	"sym-mes-s": "f5d5",
    	"sym-mes": "f5d6",
    	"sym-met-s": "f5d7",
    	"sym-met": "f5d8",
    	"sym-meta-s": "f5d9",
    	"sym-meta": "f5da",
    	"sym-mft-s": "f5db",
    	"sym-mft": "f5dc",
    	"sym-mgc-s": "f5dd",
    	"sym-mgc": "f5de",
    	"sym-mgo-s": "f5df",
    	"sym-mgo": "f5e0",
    	"sym-mhc-s": "f5e1",
    	"sym-mhc": "f5e2",
    	"sym-mina-s": "f5e3",
    	"sym-mina": "f5e4",
    	"sym-mir-s": "f5e5",
    	"sym-mir": "f5e6",
    	"sym-mith-s": "f5e7",
    	"sym-mith": "f5e8",
    	"sym-mitx-s": "f5e9",
    	"sym-mitx": "f5ea",
    	"sym-mjp-s": "f5eb",
    	"sym-mjp": "f5ec",
    	"sym-mkr-s": "f5ed",
    	"sym-mkr": "f5ee",
    	"sym-mln-s": "f5ef",
    	"sym-mln": "f5f0",
    	"sym-mngo-s": "f5f1",
    	"sym-mngo": "f5f2",
    	"sym-mnx-s": "f5f3",
    	"sym-mnx": "f5f4",
    	"sym-moac-s": "f5f5",
    	"sym-moac": "f5f6",
    	"sym-mob-s": "f5f7",
    	"sym-mob": "f5f8",
    	"sym-mobi-s": "f5f9",
    	"sym-mobi": "f5fa",
    	"sym-moc-s": "f5fb",
    	"sym-moc": "f5fc",
    	"sym-mod-s": "f5fd",
    	"sym-mod": "f5fe",
    	"sym-mona-s": "f5ff",
    	"sym-mona": "f600",
    	"sym-moon-s": "f601",
    	"sym-moon": "f602",
    	"sym-morph-s": "f603",
    	"sym-morph": "f604",
    	"sym-movr-s": "f605",
    	"sym-movr": "f606",
    	"sym-mpl-s": "f607",
    	"sym-mpl": "f608",
    	"sym-mrk-s": "f609",
    	"sym-mrk": "f60a",
    	"sym-msol-s": "f60b",
    	"sym-msol": "f60c",
    	"sym-msp-s": "f60d",
    	"sym-msp": "f60e",
    	"sym-mta-s": "f60f",
    	"sym-mta": "f610",
    	"sym-mtc-s": "f611",
    	"sym-mtc": "f612",
    	"sym-mth-s": "f613",
    	"sym-mth": "f614",
    	"sym-mtl-s": "f615",
    	"sym-mtl": "f616",
    	"sym-mtn-s": "f617",
    	"sym-mtn": "f618",
    	"sym-mtx-s": "f619",
    	"sym-mtx": "f61a",
    	"sym-mue-s": "f61b",
    	"sym-mue": "f61c",
    	"sym-multi-s": "f61d",
    	"sym-multi": "f61e",
    	"sym-mv-s": "f61f",
    	"sym-mv": "f620",
    	"sym-mx-s": "f621",
    	"sym-mx": "f622",
    	"sym-mxc-s": "f623",
    	"sym-mxc": "f624",
    	"sym-mxm-s": "f625",
    	"sym-mxm": "f626",
    	"sym-mxn-s": "f627",
    	"sym-mxn": "f628",
    	"sym-myr-s": "f629",
    	"sym-myr": "f62a",
    	"sym-n9l-s": "f62b",
    	"sym-n9l": "f62c",
    	"sym-nanj-s": "f62d",
    	"sym-nanj": "f62e",
    	"sym-nano-s": "f62f",
    	"sym-nano": "f630",
    	"sym-nas-s": "f631",
    	"sym-nas": "f632",
    	"sym-naut-s": "f633",
    	"sym-naut": "f634",
    	"sym-nav-s": "f635",
    	"sym-nav": "f636",
    	"sym-ncash-s": "f637",
    	"sym-ncash": "f638",
    	"sym-nct-s": "f639",
    	"sym-nct": "f63a",
    	"sym-near-s": "f63b",
    	"sym-near": "f63c",
    	"sym-nebl-s": "f63d",
    	"sym-nebl": "f63e",
    	"sym-nec-s": "f63f",
    	"sym-nec": "f640",
    	"sym-neo-s": "f641",
    	"sym-neo": "f642",
    	"sym-neos-s": "f643",
    	"sym-neos": "f644",
    	"sym-nest-s": "f645",
    	"sym-nest": "f646",
    	"sym-neu-s": "f647",
    	"sym-neu": "f648",
    	"sym-new-s": "f649",
    	"sym-new": "f64a",
    	"sym-nexo-s": "f64b",
    	"sym-nexo": "f64c",
    	"sym-nft-s": "f64d",
    	"sym-nft": "f64e",
    	"sym-ng-s": "f64f",
    	"sym-ng": "f650",
    	"sym-ngc-s": "f651",
    	"sym-ngc": "f652",
    	"sym-ngn-s": "f653",
    	"sym-ngn": "f654",
    	"sym-nim-s": "f655",
    	"sym-nim": "f656",
    	"sym-niy-s": "f657",
    	"sym-niy": "f658",
    	"sym-nkd-s": "f659",
    	"sym-nkd": "f65a",
    	"sym-nkn-s": "f65b",
    	"sym-nkn": "f65c",
    	"sym-nlc2-s": "f65d",
    	"sym-nlc2": "f65e",
    	"sym-nlg-s": "f65f",
    	"sym-nlg": "f660",
    	"sym-nmc-s": "f661",
    	"sym-nmc": "f662",
    	"sym-nmr-s": "f663",
    	"sym-nmr": "f664",
    	"sym-nn-s": "f665",
    	"sym-nn": "f666",
    	"sym-noah-s": "f667",
    	"sym-noah": "f668",
    	"sym-nodl-s": "f669",
    	"sym-nodl": "f66a",
    	"sym-note-s": "f66b",
    	"sym-note": "f66c",
    	"sym-npg-s": "f66d",
    	"sym-npg": "f66e",
    	"sym-nplc-s": "f66f",
    	"sym-nplc": "f670",
    	"sym-npxs-s": "f671",
    	"sym-npxs": "f672",
    	"sym-nq-s": "f673",
    	"sym-nq": "f674",
    	"sym-nrg-s": "f675",
    	"sym-nrg": "f676",
    	"sym-ntk-s": "f677",
    	"sym-ntk": "f678",
    	"sym-nu-s": "f679",
    	"sym-nu": "f67a",
    	"sym-nuls-s": "f67b",
    	"sym-nuls": "f67c",
    	"sym-nvc-s": "f67d",
    	"sym-nvc": "f67e",
    	"sym-nxc-s": "f67f",
    	"sym-nxc": "f680",
    	"sym-nxs-s": "f681",
    	"sym-nxs": "f682",
    	"sym-nxt-s": "f683",
    	"sym-nxt": "f684",
    	"sym-nym-s": "f685",
    	"sym-nym": "f686",
    	"sym-o-s": "f687",
    	"sym-o": "f688",
    	"sym-oax-s": "f689",
    	"sym-oax": "f68a",
    	"sym-ocean-s": "f68b",
    	"sym-ocean": "f68c",
    	"sym-ocn-s": "f68d",
    	"sym-ocn": "f68e",
    	"sym-ode-s": "f68f",
    	"sym-ode": "f690",
    	"sym-ogn-s": "f691",
    	"sym-ogn": "f692",
    	"sym-ogo-s": "f693",
    	"sym-ogo": "f694",
    	"sym-ok-s": "f695",
    	"sym-ok": "f696",
    	"sym-okb-s": "f697",
    	"sym-okb": "f698",
    	"sym-om-s": "f699",
    	"sym-om": "f69a",
    	"sym-omg-s": "f69b",
    	"sym-omg": "f69c",
    	"sym-omni-s": "f69d",
    	"sym-omni": "f69e",
    	"sym-one-s": "f69f",
    	"sym-one": "f6a0",
    	"sym-ong-s": "f6a1",
    	"sym-ong": "f6a2",
    	"sym-onot-s": "f6a3",
    	"sym-onot": "f6a4",
    	"sym-ont-s": "f6a5",
    	"sym-ont": "f6a6",
    	"sym-orbs-s": "f6a7",
    	"sym-orbs": "f6a8",
    	"sym-orca-s": "f6a9",
    	"sym-orca": "f6aa",
    	"sym-orme-s": "f6ab",
    	"sym-orme": "f6ac",
    	"sym-orn-s": "f6ad",
    	"sym-orn": "f6ae",
    	"sym-ors-s": "f6af",
    	"sym-ors": "f6b0",
    	"sym-osmo-s": "f6b1",
    	"sym-osmo": "f6b2",
    	"sym-ost-s": "f6b3",
    	"sym-ost": "f6b4",
    	"sym-otn-s": "f6b5",
    	"sym-otn": "f6b6",
    	"sym-oxt-s": "f6b7",
    	"sym-oxt": "f6b8",
    	"sym-oxy-s": "f6b9",
    	"sym-oxy": "f6ba",
    	"sym-pai-s": "f6bb",
    	"sym-pai": "f6bc",
    	"sym-pal-s": "f6bd",
    	"sym-pal": "f6be",
    	"sym-para-s": "f6bf",
    	"sym-para": "f6c0",
    	"sym-part-s": "f6c1",
    	"sym-part": "f6c2",
    	"sym-pasc-s": "f6c3",
    	"sym-pasc": "f6c4",
    	"sym-pat-s": "f6c5",
    	"sym-pat": "f6c6",
    	"sym-pax-s": "f6c7",
    	"sym-pax": "f6c8",
    	"sym-paxg-s": "f6c9",
    	"sym-paxg": "f6ca",
    	"sym-pay-s": "f6cb",
    	"sym-pay": "f6cc",
    	"sym-pbt-s": "f6cd",
    	"sym-pbt": "f6ce",
    	"sym-pcl-s": "f6cf",
    	"sym-pcl": "f6d0",
    	"sym-pcx-s": "f6d1",
    	"sym-pcx": "f6d2",
    	"sym-pdex-s": "f6d3",
    	"sym-pdex": "f6d4",
    	"sym-people-s": "f6d5",
    	"sym-people": "f6d6",
    	"sym-perl-s": "f6d7",
    	"sym-perl": "f6d8",
    	"sym-perp-s": "f6d9",
    	"sym-perp": "f6da",
    	"sym-pha-s": "f6db",
    	"sym-pha": "f6dc",
    	"sym-phb-s": "f6dd",
    	"sym-phb": "f6de",
    	"sym-php-s": "f6df",
    	"sym-php": "f6e0",
    	"sym-phx-s": "f6e1",
    	"sym-phx": "f6e2",
    	"sym-pi-s": "f6e3",
    	"sym-pi": "f6e4",
    	"sym-pica-s": "f6e5",
    	"sym-pica": "f6e6",
    	"sym-pink-s": "f6e7",
    	"sym-pink": "f6e8",
    	"sym-pivx-s": "f6e9",
    	"sym-pivx": "f6ea",
    	"sym-pkt-s": "f6eb",
    	"sym-pkt": "f6ec",
    	"sym-pl-s": "f6ed",
    	"sym-pl": "f6ee",
    	"sym-pla-s": "f6ef",
    	"sym-pla": "f6f0",
    	"sym-plbt-s": "f6f1",
    	"sym-plbt": "f6f2",
    	"sym-plm-s": "f6f3",
    	"sym-plm": "f6f4",
    	"sym-pln-s": "f6f5",
    	"sym-pln": "f6f6",
    	"sym-plr-s": "f6f7",
    	"sym-plr": "f6f8",
    	"sym-ply-s": "f6f9",
    	"sym-ply": "f6fa",
    	"sym-pma-s": "f6fb",
    	"sym-pma": "f6fc",
    	"sym-png-s": "f6fd",
    	"sym-png": "f6fe",
    	"sym-pnt-s": "f6ff",
    	"sym-pnt": "f700",
    	"sym-poa-s": "f701",
    	"sym-poa": "f702",
    	"sym-poe-s": "f703",
    	"sym-poe": "f704",
    	"sym-polis-s": "f705",
    	"sym-polis": "f706",
    	"sym-pols-s": "f707",
    	"sym-pols": "f708",
    	"sym-poly-s": "f709",
    	"sym-poly": "f70a",
    	"sym-pond-s": "f70b",
    	"sym-pond": "f70c",
    	"sym-pot-s": "f70d",
    	"sym-pot": "f70e",
    	"sym-powr-s": "f70f",
    	"sym-powr": "f710",
    	"sym-ppc-s": "f711",
    	"sym-ppc": "f712",
    	"sym-ppt-s": "f713",
    	"sym-ppt": "f714",
    	"sym-pra-s": "f715",
    	"sym-pra": "f716",
    	"sym-pre-s": "f717",
    	"sym-pre": "f718",
    	"sym-prg-s": "f719",
    	"sym-prg": "f71a",
    	"sym-pro-s": "f71b",
    	"sym-pro": "f71c",
    	"sym-pst-s": "f71d",
    	"sym-pst": "f71e",
    	"sym-pstake-s": "f71f",
    	"sym-pstake": "f720",
    	"sym-pton-s": "f721",
    	"sym-pton": "f722",
    	"sym-pvt-s": "f723",
    	"sym-pvt": "f724",
    	"sym-pxg-s": "f725",
    	"sym-pxg": "f726",
    	"sym-pyr-s": "f727",
    	"sym-pyr": "f728",
    	"sym-qash-s": "f729",
    	"sym-qash": "f72a",
    	"sym-qau-s": "f72b",
    	"sym-qau": "f72c",
    	"sym-qc-s": "f72d",
    	"sym-qc": "f72e",
    	"sym-qi-s": "f72f",
    	"sym-qi": "f730",
    	"sym-qi2-s": "f731",
    	"sym-qi2": "f732",
    	"sym-qkc-s": "f733",
    	"sym-qkc": "f734",
    	"sym-qlc-s": "f735",
    	"sym-qlc": "f736",
    	"sym-qnt-s": "f737",
    	"sym-qnt": "f738",
    	"sym-qntu-s": "f739",
    	"sym-qntu": "f73a",
    	"sym-qo-s": "f73b",
    	"sym-qo": "f73c",
    	"sym-qrl-s": "f73d",
    	"sym-qrl": "f73e",
    	"sym-qsp-s": "f73f",
    	"sym-qsp": "f740",
    	"sym-qtum-s": "f741",
    	"sym-qtum": "f742",
    	"sym-quick-s": "f743",
    	"sym-quick": "f744",
    	"sym-qun-s": "f745",
    	"sym-qun": "f746",
    	"sym-r-s": "f747",
    	"sym-r": "f748",
    	"sym-rad-s": "f749",
    	"sym-rad": "f74a",
    	"sym-rads-s": "f74b",
    	"sym-rads": "f74c",
    	"sym-rare-s": "f74d",
    	"sym-rare": "f74e",
    	"sym-rari-s": "f74f",
    	"sym-rari": "f750",
    	"sym-rating-s": "f751",
    	"sym-rating": "f752",
    	"sym-ray-s": "f753",
    	"sym-ray": "f754",
    	"sym-rb-s": "f755",
    	"sym-rb": "f756",
    	"sym-rbc-s": "f757",
    	"sym-rbc": "f758",
    	"sym-rblx-s": "f759",
    	"sym-rblx": "f75a",
    	"sym-rbtc-s": "f75b",
    	"sym-rbtc": "f75c",
    	"sym-rby-s": "f75d",
    	"sym-rby": "f75e",
    	"sym-rcn-s": "f75f",
    	"sym-rcn": "f760",
    	"sym-rdd-s": "f761",
    	"sym-rdd": "f762",
    	"sym-rdn-s": "f763",
    	"sym-rdn": "f764",
    	"sym-reef-s": "f765",
    	"sym-reef": "f766",
    	"sym-rem-s": "f767",
    	"sym-rem": "f768",
    	"sym-ren-s": "f769",
    	"sym-ren": "f76a",
    	"sym-rep-s": "f76b",
    	"sym-rep": "f76c",
    	"sym-repv2-s": "f76d",
    	"sym-repv2": "f76e",
    	"sym-req-s": "f76f",
    	"sym-req": "f770",
    	"sym-rev-s": "f771",
    	"sym-rev": "f772",
    	"sym-rfox-s": "f773",
    	"sym-rfox": "f774",
    	"sym-rfr-s": "f775",
    	"sym-rfr": "f776",
    	"sym-ric-s": "f777",
    	"sym-ric": "f778",
    	"sym-rif-s": "f779",
    	"sym-rif": "f77a",
    	"sym-ring-s": "f77b",
    	"sym-ring": "f77c",
    	"sym-rlc-s": "f77d",
    	"sym-rlc": "f77e",
    	"sym-rly-s": "f77f",
    	"sym-rly": "f780",
    	"sym-rmrk-s": "f781",
    	"sym-rmrk": "f782",
    	"sym-rndr-s": "f783",
    	"sym-rndr": "f784",
    	"sym-rntb-s": "f785",
    	"sym-rntb": "f786",
    	"sym-ron-s": "f787",
    	"sym-ron": "f788",
    	"sym-rook-s": "f789",
    	"sym-rook": "f78a",
    	"sym-rose-s": "f78b",
    	"sym-rose": "f78c",
    	"sym-rox-s": "f78d",
    	"sym-rox": "f78e",
    	"sym-rp-s": "f78f",
    	"sym-rp": "f790",
    	"sym-rpx-s": "f791",
    	"sym-rpx": "f792",
    	"sym-rsr-s": "f793",
    	"sym-rsr": "f794",
    	"sym-rsv-s": "f795",
    	"sym-rsv": "f796",
    	"sym-rty-s": "f797",
    	"sym-rty": "f798",
    	"sym-rub-s": "f799",
    	"sym-rub": "f79a",
    	"sym-ruff-s": "f79b",
    	"sym-ruff": "f79c",
    	"sym-rune-s": "f79d",
    	"sym-rune": "f79e",
    	"sym-rvn-s": "f79f",
    	"sym-rvn": "f7a0",
    	"sym-rvr-s": "f7a1",
    	"sym-rvr": "f7a2",
    	"sym-rvt-s": "f7a3",
    	"sym-rvt": "f7a4",
    	"sym-sai-s": "f7a5",
    	"sym-sai": "f7a6",
    	"sym-salt-s": "f7a7",
    	"sym-salt": "f7a8",
    	"sym-samo-s": "f7a9",
    	"sym-samo": "f7aa",
    	"sym-san-s": "f7ab",
    	"sym-san": "f7ac",
    	"sym-sand-s": "f7ad",
    	"sym-sand": "f7ae",
    	"sym-sats-s": "f7af",
    	"sym-sats": "f7b0",
    	"sym-sbd-s": "f7b1",
    	"sym-sbd": "f7b2",
    	"sym-sbr-s": "f7b3",
    	"sym-sbr": "f7b4",
    	"sym-sc-s": "f7b5",
    	"sym-sc": "f7b6",
    	"sym-scc-s": "f7b7",
    	"sym-scc": "f7b8",
    	"sym-scrt-s": "f7b9",
    	"sym-scrt": "f7ba",
    	"sym-sdc-s": "f7bb",
    	"sym-sdc": "f7bc",
    	"sym-sdn-s": "f7bd",
    	"sym-sdn": "f7be",
    	"sym-seele-s": "f7bf",
    	"sym-seele": "f7c0",
    	"sym-sek-s": "f7c1",
    	"sym-sek": "f7c2",
    	"sym-sen-s": "f7c3",
    	"sym-sen": "f7c4",
    	"sym-sent-s": "f7c5",
    	"sym-sent": "f7c6",
    	"sym-sero-s": "f7c7",
    	"sym-sero": "f7c8",
    	"sym-sexc-s": "f7c9",
    	"sym-sexc": "f7ca",
    	"sym-sfp-s": "f7cb",
    	"sym-sfp": "f7cc",
    	"sym-sgb-s": "f7cd",
    	"sym-sgb": "f7ce",
    	"sym-sgc-s": "f7cf",
    	"sym-sgc": "f7d0",
    	"sym-sgd-s": "f7d1",
    	"sym-sgd": "f7d2",
    	"sym-sgn-s": "f7d3",
    	"sym-sgn": "f7d4",
    	"sym-sgu-s": "f7d5",
    	"sym-sgu": "f7d6",
    	"sym-shib-s": "f7d7",
    	"sym-shib": "f7d8",
    	"sym-shift-s": "f7d9",
    	"sym-shift": "f7da",
    	"sym-ship-s": "f7db",
    	"sym-ship": "f7dc",
    	"sym-si-s": "f7dd",
    	"sym-si": "f7de",
    	"sym-sib-s": "f7df",
    	"sym-sib": "f7e0",
    	"sym-sil-s": "f7e1",
    	"sym-sil": "f7e2",
    	"sym-six-s": "f7e3",
    	"sym-six": "f7e4",
    	"sym-sjcx-s": "f7e5",
    	"sym-sjcx": "f7e6",
    	"sym-skl-s": "f7e7",
    	"sym-skl": "f7e8",
    	"sym-skm-s": "f7e9",
    	"sym-skm": "f7ea",
    	"sym-sku-s": "f7eb",
    	"sym-sku": "f7ec",
    	"sym-sky-s": "f7ed",
    	"sym-sky": "f7ee",
    	"sym-slp-s": "f7ef",
    	"sym-slp": "f7f0",
    	"sym-slr-s": "f7f1",
    	"sym-slr": "f7f2",
    	"sym-sls-s": "f7f3",
    	"sym-sls": "f7f4",
    	"sym-slt-s": "f7f5",
    	"sym-slt": "f7f6",
    	"sym-slv-s": "f7f7",
    	"sym-slv": "f7f8",
    	"sym-smart-s": "f7f9",
    	"sym-smart": "f7fa",
    	"sym-smn-s": "f7fb",
    	"sym-smn": "f7fc",
    	"sym-smt-s": "f7fd",
    	"sym-smt": "f7fe",
    	"sym-snc-s": "f7ff",
    	"sym-snc": "f800",
    	"sym-snet-s": "f801",
    	"sym-snet": "f802",
    	"sym-sngls-s": "f803",
    	"sym-sngls": "f804",
    	"sym-snm-s": "f805",
    	"sym-snm": "f806",
    	"sym-snt-s": "f807",
    	"sym-snt": "f808",
    	"sym-snx-s": "f809",
    	"sym-snx": "f80a",
    	"sym-soc-s": "f80b",
    	"sym-soc": "f80c",
    	"sym-socks-s": "f80d",
    	"sym-socks": "f80e",
    	"sym-sol-s": "f80f",
    	"sym-sol": "f810",
    	"sym-solid-s": "f811",
    	"sym-solid": "f812",
    	"sym-solo-s": "f813",
    	"sym-solo": "f814",
    	"sym-solve-s": "f815",
    	"sym-solve": "f816",
    	"sym-sos-s": "f817",
    	"sym-sos": "f818",
    	"sym-soul-s": "f819",
    	"sym-soul": "f81a",
    	"sym-sp-s": "f81b",
    	"sym-sp": "f81c",
    	"sym-sparta-s": "f81d",
    	"sym-sparta": "f81e",
    	"sym-spc-s": "f81f",
    	"sym-spc": "f820",
    	"sym-spd-s": "f821",
    	"sym-spd": "f822",
    	"sym-spell-s": "f823",
    	"sym-spell": "f824",
    	"sym-sphr-s": "f825",
    	"sym-sphr": "f826",
    	"sym-sphtx-s": "f827",
    	"sym-sphtx": "f828",
    	"sym-spnd-s": "f829",
    	"sym-spnd": "f82a",
    	"sym-spnk-s": "f82b",
    	"sym-spnk": "f82c",
    	"sym-srm-s": "f82d",
    	"sym-srm": "f82e",
    	"sym-srn-s": "f82f",
    	"sym-srn": "f830",
    	"sym-ssp-s": "f831",
    	"sym-ssp": "f832",
    	"sym-stacs-s": "f833",
    	"sym-stacs": "f834",
    	"sym-step-s": "f835",
    	"sym-step": "f836",
    	"sym-stg-s": "f837",
    	"sym-stg": "f838",
    	"sym-storm-s": "f839",
    	"sym-storm": "f83a",
    	"sym-stpt-s": "f83b",
    	"sym-stpt": "f83c",
    	"sym-stq-s": "f83d",
    	"sym-stq": "f83e",
    	"sym-str-s": "f83f",
    	"sym-str": "f840",
    	"sym-strat-s": "f841",
    	"sym-strat": "f842",
    	"sym-strax-s": "f843",
    	"sym-strax": "f844",
    	"sym-strong-s": "f845",
    	"sym-strong": "f846",
    	"sym-stx-s": "f847",
    	"sym-stx": "f848",
    	"sym-sub-s": "f849",
    	"sym-sub": "f84a",
    	"sym-super-s": "f84b",
    	"sym-super": "f84c",
    	"sym-susd-s": "f84d",
    	"sym-susd": "f84e",
    	"sym-sushi-s": "f84f",
    	"sym-sushi": "f850",
    	"sym-swftc-s": "f851",
    	"sym-swftc": "f852",
    	"sym-swm-s": "f853",
    	"sym-swm": "f854",
    	"sym-swrv-s": "f855",
    	"sym-swrv": "f856",
    	"sym-swt-s": "f857",
    	"sym-swt": "f858",
    	"sym-swth-s": "f859",
    	"sym-swth": "f85a",
    	"sym-sxp-s": "f85b",
    	"sym-sxp": "f85c",
    	"sym-syn-s": "f85d",
    	"sym-syn": "f85e",
    	"sym-sys-s": "f85f",
    	"sym-sys": "f860",
    	"sym-t-s": "f861",
    	"sym-t": "f862",
    	"sym-taas-s": "f863",
    	"sym-taas": "f864",
    	"sym-tau-s": "f865",
    	"sym-tau": "f866",
    	"sym-tbtc-s": "f867",
    	"sym-tbtc": "f868",
    	"sym-tct-s": "f869",
    	"sym-tct": "f86a",
    	"sym-teer-s": "f86b",
    	"sym-teer": "f86c",
    	"sym-tel-s": "f86d",
    	"sym-temco-s": "f86e",
    	"sym-temco": "f86f",
    	"sym-tfuel-s": "f870",
    	"sym-tfuel": "f871",
    	"sym-thb-s": "f872",
    	"sym-thb": "f873",
    	"sym-thc-s": "f874",
    	"sym-thc": "f875",
    	"sym-theta-s": "f876",
    	"sym-theta": "f877",
    	"sym-thx-s": "f878",
    	"sym-thx": "f879",
    	"sym-time-s": "f87a",
    	"sym-time": "f87b",
    	"sym-tio-s": "f87c",
    	"sym-tio": "f87d",
    	"sym-tix-s": "f87e",
    	"sym-tix": "f87f",
    	"sym-tkn-s": "f880",
    	"sym-tkn": "f881",
    	"sym-tky-s": "f882",
    	"sym-tky": "f883",
    	"sym-tlm-s": "f884",
    	"sym-tlm": "f885",
    	"sym-tnb-s": "f886",
    	"sym-tnb": "f887",
    	"sym-tnc-s": "f888",
    	"sym-tnc": "f889",
    	"sym-tnt-s": "f88a",
    	"sym-tnt": "f88b",
    	"sym-toke-s": "f88c",
    	"sym-toke": "f88d",
    	"sym-tomo-s": "f88e",
    	"sym-tomo": "f88f",
    	"sym-top-s": "f890",
    	"sym-top": "f891",
    	"sym-torn-s": "f892",
    	"sym-torn": "f893",
    	"sym-tpay-s": "f894",
    	"sym-tpay": "f895",
    	"sym-trac-s": "f896",
    	"sym-trac": "f897",
    	"sym-trb-s": "f898",
    	"sym-trb": "f899",
    	"sym-tribe-s": "f89a",
    	"sym-tribe": "f89b",
    	"sym-trig-s": "f89c",
    	"sym-trig": "f89d",
    	"sym-trio-s": "f89e",
    	"sym-trio": "f89f",
    	"sym-troy-s": "f8a0",
    	"sym-troy": "f8a1",
    	"sym-trst-s": "f8a2",
    	"sym-trst": "f8a3",
    	"sym-tru-s": "f8a4",
    	"sym-tru": "f8a5",
    	"sym-true-s": "f8a6",
    	"sym-true": "f8a7",
    	"sym-trx-s": "f8a8",
    	"sym-trx": "f8a9",
    	"sym-try-s": "f8aa",
    	"sym-try": "f8ab",
    	"sym-tryb-s": "f8ac",
    	"sym-tryb": "f8ad",
    	"sym-tt-s": "f8ae",
    	"sym-tt": "f8af",
    	"sym-ttc-s": "f8b0",
    	"sym-ttc": "f8b1",
    	"sym-ttt-s": "f8b2",
    	"sym-ttt": "f8b3",
    	"sym-ttu-s": "f8b4",
    	"sym-ttu": "f8b5",
    	"sym-tube-s": "f8b6",
    	"sym-tube": "f8b7",
    	"sym-tusd-s": "f8b8",
    	"sym-tusd": "f8b9",
    	"sym-tvk-s": "f8ba",
    	"sym-tvk": "f8bb",
    	"sym-twt-s": "f8bc",
    	"sym-twt": "f8bd",
    	"sym-uah-s": "f8be",
    	"sym-uah": "f8bf",
    	"sym-ubq-s": "f8c0",
    	"sym-ubq": "f8c1",
    	"sym-ubt-s": "f8c2",
    	"sym-ubt": "f8c3",
    	"sym-uft-s": "f8c4",
    	"sym-uft": "f8c5",
    	"sym-ugas-s": "f8c6",
    	"sym-ugas": "f8c7",
    	"sym-uip-s": "f8c8",
    	"sym-uip": "f8c9",
    	"sym-ukg-s": "f8ca",
    	"sym-ukg": "f8cb",
    	"sym-uma-s": "f8cc",
    	"sym-uma": "f8cd",
    	"sym-unfi-s": "f8ce",
    	"sym-unfi": "f8cf",
    	"sym-uni-s": "f8d0",
    	"sym-uni": "f8d1",
    	"sym-unq-s": "f8d2",
    	"sym-unq": "f8d3",
    	"sym-up-s": "f8d4",
    	"sym-up": "f8d5",
    	"sym-upp-s": "f8d6",
    	"sym-upp": "f8d7",
    	"sym-usd-s": "f8d8",
    	"sym-usd": "f8d9",
    	"sym-usdc-s": "f8da",
    	"sym-usdc": "f8db",
    	"sym-usds-s": "f8dc",
    	"sym-usds": "f8dd",
    	"sym-usk-s": "f8de",
    	"sym-usk": "f8df",
    	"sym-ust-s": "f8e0",
    	"sym-ust": "f8e1",
    	"sym-utk-s": "f8e2",
    	"sym-utk": "f8e3",
    	"sym-utnp-s": "f8e4",
    	"sym-utnp": "f8e5",
    	"sym-utt-s": "f8e6",
    	"sym-utt": "f8e7",
    	"sym-uuu-s": "f8e8",
    	"sym-uuu": "f8e9",
    	"sym-ux-s": "f8ea",
    	"sym-ux": "f8eb",
    	"sym-vader-s": "f8ec",
    	"sym-vader": "f8ed",
    	"sym-vai-s": "f8ee",
    	"sym-vai": "f8ef",
    	"sym-vbk-s": "f8f0",
    	"sym-vbk": "f8f1",
    	"sym-vdx-s": "f8f2",
    	"sym-vdx": "f8f3",
    	"sym-vee-s": "f8f4",
    	"sym-vee": "f8f5",
    	"sym-ven-s": "f8f6",
    	"sym-ven": "f8f7",
    	"sym-veo-s": "f8f8",
    	"sym-veo": "f8f9",
    	"sym-veri-s": "f8fa",
    	"sym-veri": "f8fb",
    	"sym-vex-s": "f8fc",
    	"sym-vex": "f8fd",
    	"sym-vgx-s": "f8fe",
    	"sym-vgx": "f8ff",
    	"sym-via-s": "f900",
    	"sym-via": "f901",
    	"sym-vib-s": "f902",
    	"sym-vib": "f903",
    	"sym-vibe-s": "f904",
    	"sym-vibe": "f905",
    	"sym-vid-s": "f906",
    	"sym-vid": "f907",
    	"sym-vidt-s": "f908",
    	"sym-vidt": "f909",
    	"sym-vidy-s": "f90a",
    	"sym-vidy": "f90b",
    	"sym-vitae-s": "f90c",
    	"sym-vitae": "f90d",
    	"sym-vite-s": "f90e",
    	"sym-vite": "f90f",
    	"sym-vlx-s": "f910",
    	"sym-vlx": "f911",
    	"sym-vox-s": "f912",
    	"sym-vox": "f913",
    	"sym-vra-s": "f914",
    	"sym-vra": "f915",
    	"sym-vrc-s": "f916",
    	"sym-vrc": "f917",
    	"sym-vrm-s": "f918",
    	"sym-vrm": "f919",
    	"sym-vsys-s": "f91a",
    	"sym-vsys": "f91b",
    	"sym-vtc-s": "f91c",
    	"sym-vtc": "f91d",
    	"sym-vtho-s": "f91e",
    	"sym-vtho": "f91f",
    	"sym-wabi-s": "f920",
    	"sym-wabi": "f921",
    	"sym-wan-s": "f922",
    	"sym-wan": "f923",
    	"sym-waves-s": "f924",
    	"sym-waves": "f925",
    	"sym-wax-s": "f926",
    	"sym-wax": "f927",
    	"sym-wbtc-s": "f928",
    	"sym-wbtc": "f929",
    	"sym-wet-s": "f92a",
    	"sym-wet": "f92b",
    	"sym-weth-s": "f92c",
    	"sym-weth": "f92d",
    	"sym-wib-s": "f92e",
    	"sym-wib": "f92f",
    	"sym-wicc-s": "f930",
    	"sym-wicc": "f931",
    	"sym-win-s": "f932",
    	"sym-win": "f933",
    	"sym-wing-s": "f934",
    	"sym-wing": "f935",
    	"sym-wings-s": "f936",
    	"sym-wings": "f937",
    	"sym-wnxm-s": "f938",
    	"sym-wnxm": "f939",
    	"sym-woo-s": "f93a",
    	"sym-woo": "f93b",
    	"sym-wpr-s": "f93c",
    	"sym-wpr": "f93d",
    	"sym-wrx-s": "f93e",
    	"sym-wrx": "f93f",
    	"sym-wtc-s": "f940",
    	"sym-wtc": "f941",
    	"sym-wtt-s": "f942",
    	"sym-wtt": "f943",
    	"sym-wwb-s": "f944",
    	"sym-wwb": "f945",
    	"sym-wxt-s": "f946",
    	"sym-wxt": "f947",
    	"sym-xas-s": "f948",
    	"sym-xas": "f949",
    	"sym-xaur-s": "f94a",
    	"sym-xaur": "f94b",
    	"sym-xaut-s": "f94c",
    	"sym-xaut": "f94d",
    	"sym-xava-s": "f94e",
    	"sym-xava": "f94f",
    	"sym-xbc-s": "f950",
    	"sym-xbc": "f951",
    	"sym-xcon-s": "f952",
    	"sym-xcon": "f953",
    	"sym-xcp-s": "f954",
    	"sym-xcp": "f955",
    	"sym-xdn-s": "f956",
    	"sym-xdn": "f957",
    	"sym-xel-s": "f958",
    	"sym-xel": "f959",
    	"sym-xem-s": "f95a",
    	"sym-xem": "f95b",
    	"sym-xes-s": "f95c",
    	"sym-xes": "f95d",
    	"sym-xhv-s": "f95e",
    	"sym-xhv": "f95f",
    	"sym-xin-s": "f960",
    	"sym-xin": "f961",
    	"sym-xlm-s": "f962",
    	"sym-xlm": "f963",
    	"sym-xmc-s": "f964",
    	"sym-xmc": "f965",
    	"sym-xmr-s": "f966",
    	"sym-xmr": "f967",
    	"sym-xmx-s": "f968",
    	"sym-xmx": "f969",
    	"sym-xmy-s": "f96a",
    	"sym-xmy": "f96b",
    	"sym-xnk-s": "f96c",
    	"sym-xnk": "f96d",
    	"sym-xns-s": "f96e",
    	"sym-xns": "f96f",
    	"sym-xor-s": "f970",
    	"sym-xor": "f971",
    	"sym-xos-s": "f972",
    	"sym-xos": "f973",
    	"sym-xpm-s": "f974",
    	"sym-xpm": "f975",
    	"sym-xpr-s": "f976",
    	"sym-xpr": "f977",
    	"sym-xrc-s": "f978",
    	"sym-xrc": "f979",
    	"sym-xrp-s": "f97a",
    	"sym-xrp": "f97b",
    	"sym-xrpx-s": "f97c",
    	"sym-xrpx": "f97d",
    	"sym-xrt-s": "f97e",
    	"sym-xrt": "f97f",
    	"sym-xst-s": "f980",
    	"sym-xst": "f981",
    	"sym-xtp-s": "f982",
    	"sym-xtp": "f983",
    	"sym-xtz-s": "f984",
    	"sym-xtz": "f985",
    	"sym-xtzdown-s": "f986",
    	"sym-xtzdown": "f987",
    	"sym-xvc-s": "f988",
    	"sym-xvc": "f989",
    	"sym-xvg-s": "f98a",
    	"sym-xvg": "f98b",
    	"sym-xvs-s": "f98c",
    	"sym-xvs": "f98d",
    	"sym-xwc-s": "f98e",
    	"sym-xwc": "f98f",
    	"sym-xyo-s": "f990",
    	"sym-xyo": "f991",
    	"sym-xzc-s": "f992",
    	"sym-xzc": "f993",
    	"sym-yam-s": "f994",
    	"sym-yam": "f995",
    	"sym-yee-s": "f996",
    	"sym-yee": "f997",
    	"sym-yeed-s": "f998",
    	"sym-yeed": "f999",
    	"sym-yfi-s": "f99a",
    	"sym-yfi": "f99b",
    	"sym-yfii-s": "f99c",
    	"sym-yfii": "f99d",
    	"sym-ygg-s": "f99e",
    	"sym-ygg": "f99f",
    	"sym-yoyow-s": "f9a0",
    	"sym-yoyow": "f9a1",
    	"sym-zar-s": "f9a2",
    	"sym-zar": "f9a3",
    	"sym-zcl-s": "f9a4",
    	"sym-zcl": "f9a5",
    	"sym-zcn-s": "f9a6",
    	"sym-zcn": "f9a7",
    	"sym-zco-s": "f9a8",
    	"sym-zco": "f9a9",
    	"sym-zec-s": "f9aa",
    	"sym-zec": "f9ab",
    	"sym-zen-s": "f9ac",
    	"sym-zen": "f9ad",
    	"sym-zil-s": "f9ae",
    	"sym-zil": "f9af",
    	"sym-zks-s": "f9b0",
    	"sym-zks": "f9b1",
    	"sym-zla-s": "f9b2",
    	"sym-zla": "f9b3",
    	"sym-zlk": "f9b4",
    	"sym-zondo-s": "f9b5",
    	"sym-zondo": "f9b6",
    	"sym-zpr-s": "f9b7",
    	"sym-zpr": "f9b8",
    	"sym-zpt-s": "f9b9",
    	"sym-zpt": "f9ba",
    	"sym-zrc-s": "f9bb",
    	"sym-zrc": "f9bc",
    	"sym-zrx-s": "f9bd",
    	"sym-zrx": "f9be",
    	"sym-zsc-s": "f9bf",
    	"sym-zsc": "f9c0",
    	"sym-ztg-s": "f9c1",
    	"sym-ztg": "f9c2",
    	"cur-anct": "f1ce",
    	"cur-anct-s": "f1cd",
    	"cur-aud": "f1fc",
    	"cur-aud-s": "f1fb",
    	"cur-bnb": "f265",
    	"cur-bnb-s": "f264",
    	"sym-xbt": "f28b",
    	"cur-btc": "f28b",
    	"sym-xbt-s": "f28a",
    	"cur-btc-s": "f28a",
    	"cur-busd": "f2ab",
    	"cur-busd-s": "f2aa",
    	"exc-bitz": "f2af",
    	"cur-bz": "f2af",
    	"exc-bitz-s": "f2ae",
    	"cur-bz-s": "f2ae",
    	"cur-cad": "f2b9",
    	"cur-cad-s": "f2b8",
    	"cur-chf": "f2d9",
    	"cur-chf-s": "f2d8",
    	"cur-cny": "f2fd",
    	"cur-cny-s": "f2fc",
    	"sym-cs": "f311",
    	"sym-cs-s": "f310",
    	"sym-crm": "f329",
    	"sym-crm-s": "f328",
    	"cur-dai": "f355",
    	"cur-dai-s": "f354",
    	"sym-xdg": "f391",
    	"sym-xdg-s": "f390",
    	"cur-eos": "f3da",
    	"cur-eos-s": "f3d9",
    	"sym-eth2": "f3ea",
    	"sym-eth2s": "f3ea",
    	"sym-eth2.s": "f3ea",
    	"cur-eth": "f3ea",
    	"sym-eth2-s": "f3e9",
    	"sym-eth2s-s": "f3e9",
    	"sym-eth2.s-s": "f3e9",
    	"cur-eth-s": "f3e9",
    	"cur-eur": "f3f2",
    	"cur-eur-s": "f3f1",
    	"cur-eurs": "f3f4",
    	"cur-eurs-s": "f3f3",
    	"sym-usdt": "f3f6",
    	"cur-usdt": "f3f6",
    	"sym-usdt-s": "f3f5",
    	"cur-usdt-s": "f3f5",
    	"exc-kraken": "f40e",
    	"exc-kraken-futures": "f40e",
    	"exc-kraken-s": "f40d",
    	"exc-kraken-futures-s": "f40d",
    	"cur-gbp": "f45a",
    	"cur-gbp-s": "f459",
    	"exc-gemini": "f49e",
    	"cur-gusd": "f49e",
    	"exc-gemini-s": "f49d",
    	"cur-gusd-s": "f49d",
    	"cur-hkd": "f4c2",
    	"cur-hkd-s": "f4c1",
    	"sym-husd": "f4dc",
    	"exc-huobi": "f4dc",
    	"cur-ht": "f4dc",
    	"sym-husd-s": "f4db",
    	"exc-huobi-s": "f4db",
    	"cur-ht-s": "f4db",
    	"cur-idr": "f4fa",
    	"cur-idr-s": "f4f9",
    	"sym-iota": "f522",
    	"sym-iota-s": "f521",
    	"cur-inr": "f514",
    	"cur-inr-s": "f513",
    	"cur-jpy": "f536",
    	"cur-jpy-s": "f535",
    	"cur-krw": "f564",
    	"cur-krw-s": "f563",
    	"sym-medx": "f5d2",
    	"sym-medx-s": "f5d1",
    	"cur-mxn": "f628",
    	"cur-mxn-s": "f627",
    	"cur-myr": "f62a",
    	"cur-myr-s": "f629",
    	"cur-ngn": "f654",
    	"cur-ngn-s": "f653",
    	"cur-pax": "f6c8",
    	"cur-pax-s": "f6c7",
    	"cur-php": "f6e0",
    	"cur-php-s": "f6df",
    	"cur-pln": "f6f6",
    	"cur-pln-s": "f6f5",
    	"cur-qash": "f72a",
    	"cur-qash-s": "f729",
    	"cur-rub": "f79a",
    	"cur-rur": "f79a",
    	"cur-rub-s": "f799",
    	"cur-rur-s": "f799",
    	"sym-steem": "f7b2",
    	"sym-steem-s": "f7b1",
    	"sym-xsc": "f7b6",
    	"sym-xsc-s": "f7b5",
    	"cur-sgd": "f7d2",
    	"cur-sgd-s": "f7d1",
    	"sym-storj": "f7e6",
    	"sym-storj-s": "f7e5",
    	"sym-tel": "f864",
    	"cur-trx": "f8a9",
    	"cur-trx-s": "f8a8",
    	"cur-tusd": "f8b9",
    	"cur-tusd-s": "f8b8",
    	"cur-usd": "f8d9",
    	"cur-usd-s": "f8d8",
    	"cur-usdc": "f8db",
    	"cur-usdc-s": "f8da",
    	"sym-vet": "f8f7",
    	"sym-vet-s": "f8f6",
    	"sym-waxp": "f927",
    	"sym-waxp-s": "f926",
    	"cur-xlm": "f963",
    	"cur-xlm-s": "f962",
    	"cur-xmr": "f967",
    	"cur-xmr-s": "f966",
    	"cur-xrp": "f97b",
    	"cur-xrp-s": "f97a",
    	"cur-zar": "f9a3",
    	"cur-zar-s": "f9a2",
    	"exc-binance-us": "f108",
    	"exc-binance-us-s": "f107",
    	"exc-mexbt": "f11e",
    	"exc-mexbt-s": "f11d",
    	"exc-coinbase-pro": "f12a",
    	"exc-gdax": "f12a",
    	"exc-coinbase-pro-s": "f129",
    	"exc-gdax-s": "f129",
    	"exc-quadriga": "f152",
    	"exc-quadriga-s": "f151",
    	"cur-crc": "f31d",
    	"cur-crc-s": "f31c",
    	"cur-lak": "f56e",
    	"cur-lak-s": "f56d",
    	"cur-sek": "f7c2",
    	"cur-sek-s": "f7c1",
    	"cur-thb": "f873",
    	"cur-thb-s": "f872",
    	"cur-try": "f8ab",
    	"cur-try-s": "f8aa",
    	"cur-uah": "f8bf",
    	"cur-uah-s": "f8be",
    	"exc-ftx": "f43e",
    	"exc-ftx-s": "f43d",
    	"exc-ftx-us": "f43e",
    	"exc-ftx-us-s": "f43d",
    	"sym-cgld": "f2c9",
    	"sym-cgld-s": "f2c8",
    	"exc-uniswap-v2": "f8d1",
    	"exc-uniswap-v2-s": "f8d0",
    	"sym-kshib": "f7d8",
    	"sym-kshib-s": "f7d7",
    	"sym-easy-s": "f3ae",
    	"sym-srare": "f74e",
    	"sym-srare-s": "f74d",
    	"sym-ape.2": "f1d4",
    	"sym-ape.2-s": "f1d3"
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
    var mxc = "Machine Xchange Coin";
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
    var adx = "AdEx";
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
    var betr = "BetterBetting";
    var bez = "Bezop";
    var bft = "BnkToTheFuture";
    var bfx = "BFX";
    var bhd = "BitcoinHD";
    var bht = "BHEX Token";
    var bico = "BICONOMY";
    var bitb = "Bean Cash";
    var bix = "Bibox Token";
    var bk = "";
    var bkx = "Bankex";
    var blk = "BlackCoin";
    var block = "Blocknet";
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
    var dot = "Polkadot";
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
    var fis = "Stafi";
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
    var gala = "Gala";
    var game = "GameCredits";
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
    var gens = "";
    var get = "GET Protocol";
    var ghst = "Aavegotchi";
    var glc = "GoldCoin";
    var gld = "GoldCoin";
    var glm = "Golem";
    var glmr = "Moonbeam";
    var gmat = "GoWithMi";
    var gmt = "GoMining token";
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
    var gtc = "Game.com";
    var gtc2 = "";
    var gto = "Gifto";
    var gup = "Matchpool";
    var gusd = "Gemini Dollar";
    var gvt = "Genesis Vision";
    var gxc = "GXChain";
    var gxs = "GXChain";
    var hard = "HARD Protocol";
    var hbar = "Hedera Hashgraph";
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
    var jpy = "Japanese Yen";
    var jst = "JUST";
    var juno = "";
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
    var looks = "LooksRare";
    var loom = "Loom Network";
    var lpt = "Livepeer";
    var lrc = "Loopring";
    var lrn = "Loopring [NEO]";
    var lsk = "Lisk";
    var ltc = "Litecoin";
    var lto = "LTO Network";
    var lun = "Lunyr";
    var luna = "Terra";
    var lxt = "Litex";
    var lym = "Lympo";
    var m2k = "Micro E-mini Russell 2000 Index";
    var ma = "";
    var maid = "MaidSafe";
    var man = "Matrix AI Network";
    var mana = "Decentraland";
    var mask = "Mask Network";
    var mass = "Massnet";
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
    var msol = "MARINADE STAKED SOL";
    var msp = "Mothership";
    var mta = "Meta";
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
    var pst = "Primas";
    var pstake = "Pstake";
    var pton = "PTON";
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
    var qrl = "Quantum Resistant Ledger";
    var qsp = "Quantstamp";
    var qtum = "Qtum";
    var qun = "QunQun";
    var r = "Revain";
    var rad = "Radicle";
    var rads = "Radium";
    var rare = "SuperRare";
    var rari = "Rarible";
    var rating = "DPRating";
    var ray = "Raydium";
    var rb = "";
    var rbc = "Rubic";
    var rblx = "Rublix";
    var rbtc = "Smart Bitcoin";
    var rby = "Rubycoin";
    var rcn = "Ripio Credit Network";
    var rdd = "ReddCoin";
    var rdn = "Raiden Network Token";
    var reef = "Reef";
    var rem = "Remme";
    var ren = "Republic Protocol";
    var rep = "Augur";
    var repv2 = "Augur v2";
    var req = "Request";
    var rev = "Revain";
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
    var si = "Silver Futures";
    var sib = "SIBCoin";
    var sil = "1,000-oz. Silver Futures";
    var six = "SIX";
    var sjcx = "Storjcoin X";
    var skl = "SKALE Network";
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
    var storm = "Storm";
    var stpt = "STPT";
    var stq = "Storiqa";
    var str = "Stellar";
    var strat = "Stratis";
    var strax = "Stratis";
    var strong = "Strong";
    var stx = "Stox";
    var sub = "substratum";
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
    var tomo = "TomoChain";
    var top = "TOP";
    var torn = "Tornado Cash";
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
    var ust = "TerraUSD";
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
    	betr: betr,
    	bez: bez,
    	bft: bft,
    	bfx: bfx,
    	bhd: bhd,
    	bht: bht,
    	bico: bico,
    	bitb: bitb,
    	bix: bix,
    	bk: bk,
    	bkx: bkx,
    	blk: blk,
    	block: block,
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
    	dot: dot,
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
    	gala: gala,
    	game: game,
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
    	gens: gens,
    	get: get,
    	ghst: ghst,
    	glc: glc,
    	gld: gld,
    	glm: glm,
    	glmr: glmr,
    	gmat: gmat,
    	gmt: gmt,
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
    	jpy: jpy,
    	jst: jst,
    	juno: juno,
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
    	looks: looks,
    	loom: loom,
    	lpt: lpt,
    	lrc: lrc,
    	lrn: lrn,
    	lsk: lsk,
    	ltc: ltc,
    	lto: lto,
    	lun: lun,
    	luna: luna,
    	lxt: lxt,
    	lym: lym,
    	m2k: m2k,
    	ma: ma,
    	maid: maid,
    	man: man,
    	mana: mana,
    	mask: mask,
    	mass: mass,
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
    	pst: pst,
    	pstake: pstake,
    	pton: pton,
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
    	qrl: qrl,
    	qsp: qsp,
    	qtum: qtum,
    	qun: qun,
    	r: r,
    	rad: rad,
    	rads: rads,
    	rare: rare,
    	rari: rari,
    	rating: rating,
    	ray: ray,
    	rb: rb,
    	rbc: rbc,
    	rblx: rblx,
    	rbtc: rbtc,
    	rby: rby,
    	rcn: rcn,
    	rdd: rdd,
    	rdn: rdn,
    	reef: reef,
    	rem: rem,
    	ren: ren,
    	rep: rep,
    	repv2: repv2,
    	req: req,
    	rev: rev,
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
    	storm: storm,
    	stpt: stpt,
    	stq: stq,
    	str: str,
    	strat: strat,
    	strax: strax,
    	strong: strong,
    	stx: stx,
    	sub: sub,
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
    	tomo: tomo,
    	top: top,
    	torn: torn,
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
