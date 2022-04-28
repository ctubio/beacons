
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
    	"sym-aleph-s": "f1bb",
    	"sym-aleph": "f1bc",
    	"sym-algo-s": "f1bd",
    	"sym-algo": "f1be",
    	"sym-ali-s": "f1bf",
    	"sym-ali": "f1c0",
    	"sym-alice-s": "f1c1",
    	"sym-alice": "f1c2",
    	"sym-alpha-s": "f1c3",
    	"sym-alpha": "f1c4",
    	"sym-amb-s": "f1c5",
    	"sym-amb": "f1c6",
    	"sym-amlt-s": "f1c7",
    	"sym-amlt": "f1c8",
    	"sym-amp-s": "f1c9",
    	"sym-amp": "f1ca",
    	"sym-ampl-s": "f1cb",
    	"sym-ampl": "f1cc",
    	"sym-anc-s": "f1cd",
    	"sym-anc": "f1ce",
    	"sym-anct-s": "f1cf",
    	"sym-anct": "f1d0",
    	"sym-ankr-s": "f1d1",
    	"sym-ankr": "f1d2",
    	"sym-ant-s": "f1d3",
    	"sym-ant": "f1d4",
    	"sym-ape-s": "f1d5",
    	"sym-ape": "f1d6",
    	"sym-api3-s": "f1d7",
    	"sym-api3": "f1d8",
    	"sym-apis-s": "f1d9",
    	"sym-apis": "f1da",
    	"sym-appc-s": "f1db",
    	"sym-appc": "f1dc",
    	"sym-ar-s": "f1dd",
    	"sym-ar": "f1de",
    	"sym-ardr-s": "f1df",
    	"sym-ardr": "f1e0",
    	"sym-ark-s": "f1e1",
    	"sym-ark": "f1e2",
    	"sym-arn-s": "f1e3",
    	"sym-arn": "f1e4",
    	"sym-arpa-s": "f1e5",
    	"sym-arpa": "f1e6",
    	"sym-art-s": "f1e7",
    	"sym-art": "f1e8",
    	"sym-aspt-s": "f1e9",
    	"sym-aspt": "f1ea",
    	"sym-ast-s": "f1eb",
    	"sym-ast": "f1ec",
    	"sym-astr-s": "f1ed",
    	"sym-astr": "f1ee",
    	"sym-at-s": "f1ef",
    	"sym-at": "f1f0",
    	"sym-atlas-s": "f1f1",
    	"sym-atlas": "f1f2",
    	"sym-atm-s": "f1f3",
    	"sym-atm": "f1f4",
    	"sym-atom-s": "f1f5",
    	"sym-atom": "f1f6",
    	"sym-atp-s": "f1f7",
    	"sym-atp": "f1f8",
    	"sym-atri-s": "f1f9",
    	"sym-atri": "f1fa",
    	"sym-auction-s": "f1fb",
    	"sym-auction": "f1fc",
    	"sym-aud-s": "f1fd",
    	"sym-aud": "f1fe",
    	"sym-audio-s": "f1ff",
    	"sym-audio": "f200",
    	"sym-aup-s": "f201",
    	"sym-aup": "f202",
    	"sym-aury-s": "f203",
    	"sym-aury": "f204",
    	"sym-auto-s": "f205",
    	"sym-auto": "f206",
    	"sym-ava-s": "f207",
    	"sym-ava": "f208",
    	"sym-avax-s": "f209",
    	"sym-avax": "f20a",
    	"sym-avt-s": "f20b",
    	"sym-avt": "f20c",
    	"sym-axp-s": "f20d",
    	"sym-axp": "f20e",
    	"sym-axs-s": "f20f",
    	"sym-axs": "f210",
    	"sym-b": "f211",
    	"sym-b0-s": "f212",
    	"sym-b0": "f213",
    	"sym-b2g-s": "f214",
    	"sym-b2g": "f215",
    	"sym-bab-s": "f216",
    	"sym-bab": "f217",
    	"sym-badger-s": "f218",
    	"sym-badger": "f219",
    	"sym-bake-s": "f21a",
    	"sym-bake": "f21b",
    	"sym-bal-s": "f21c",
    	"sym-bal": "f21d",
    	"sym-banca-s": "f21e",
    	"sym-banca": "f21f",
    	"sym-band-s": "f220",
    	"sym-band": "f221",
    	"sym-bat-s": "f222",
    	"sym-bat": "f223",
    	"sym-bay-s": "f224",
    	"sym-bay": "f225",
    	"sym-bbc-s": "f226",
    	"sym-bbc": "f227",
    	"sym-bcc-s": "f228",
    	"sym-bcc": "f229",
    	"sym-bcd-s": "f22a",
    	"sym-bcd": "f22b",
    	"sym-bch-s": "f22c",
    	"sym-bch": "f22d",
    	"sym-bci-s": "f22e",
    	"sym-bci": "f22f",
    	"sym-bcn-s": "f230",
    	"sym-bcn": "f231",
    	"sym-bcpt-s": "f232",
    	"sym-bcpt": "f233",
    	"sym-bcu-s": "f234",
    	"sym-bcu": "f235",
    	"sym-bcv-s": "f236",
    	"sym-bcv": "f237",
    	"sym-bcy-s": "f238",
    	"sym-bcy": "f239",
    	"sym-bdg-s": "f23a",
    	"sym-bdg": "f23b",
    	"sym-beam-s": "f23c",
    	"sym-beam": "f23d",
    	"sym-beet-s": "f23e",
    	"sym-beet": "f23f",
    	"sym-bel-s": "f240",
    	"sym-bel": "f241",
    	"sym-bela-s": "f242",
    	"sym-bela": "f243",
    	"sym-berry-s": "f244",
    	"sym-berry": "f245",
    	"sym-betr-s": "f246",
    	"sym-betr": "f247",
    	"sym-bez-s": "f248",
    	"sym-bez": "f249",
    	"sym-bft-s": "f24a",
    	"sym-bft": "f24b",
    	"sym-bfx-s": "f24c",
    	"sym-bfx": "f24d",
    	"sym-bhd-s": "f24e",
    	"sym-bhd": "f24f",
    	"sym-bht-s": "f250",
    	"sym-bht": "f251",
    	"sym-bico-s": "f252",
    	"sym-bico": "f253",
    	"sym-bit-s": "f254",
    	"sym-bit": "f255",
    	"sym-bitb-s": "f256",
    	"sym-bitb": "f257",
    	"sym-bix-s": "f258",
    	"sym-bix": "f259",
    	"sym-bk-s": "f25a",
    	"sym-bk": "f25b",
    	"sym-bkx-s": "f25c",
    	"sym-bkx": "f25d",
    	"sym-blk-s": "f25e",
    	"sym-blk": "f25f",
    	"sym-block-s": "f260",
    	"sym-block": "f261",
    	"sym-blt-s": "f262",
    	"sym-blt": "f263",
    	"sym-blz-s": "f264",
    	"sym-blz": "f265",
    	"sym-bmc-s": "f266",
    	"sym-bmc": "f267",
    	"sym-bnb-s": "f268",
    	"sym-bnb": "f269",
    	"sym-bnc-s": "f26a",
    	"sym-bnc": "f26b",
    	"sym-bnk-s": "f26c",
    	"sym-bnk": "f26d",
    	"sym-bnt-s": "f26e",
    	"sym-bnt": "f26f",
    	"sym-bo-s": "f270",
    	"sym-bo": "f271",
    	"sym-bond-s": "f272",
    	"sym-bond": "f273",
    	"sym-boo-s": "f274",
    	"sym-boo": "f275",
    	"sym-bor-s": "f276",
    	"sym-bor": "f277",
    	"sym-bora-s": "f278",
    	"sym-bora": "f279",
    	"sym-bos-s": "f27a",
    	"sym-bos": "f27b",
    	"sym-box-s": "f27c",
    	"sym-box": "f27d",
    	"sym-brd-s": "f27e",
    	"sym-brd": "f27f",
    	"sym-brg-s": "f280",
    	"sym-brg": "f281",
    	"sym-brick-s": "f282",
    	"sym-brick": "f283",
    	"sym-bsd-s": "f284",
    	"sym-bsd": "f285",
    	"sym-bsv-s": "f286",
    	"sym-bsv": "f287",
    	"sym-bsx-s": "f288",
    	"sym-bsx": "f289",
    	"sym-bt1-s": "f28a",
    	"sym-bt1": "f28b",
    	"sym-bt2-s": "f28c",
    	"sym-bt2": "f28d",
    	"sym-btc-s": "f28e",
    	"sym-btc": "f28f",
    	"sym-btcd-s": "f290",
    	"sym-btcd": "f291",
    	"sym-btcfx-s": "f292",
    	"sym-btcfx": "f293",
    	"sym-btcp-s": "f294",
    	"sym-btcp": "f295",
    	"sym-btg-s": "f296",
    	"sym-btg": "f297",
    	"sym-btm-s": "f298",
    	"sym-btm": "f299",
    	"sym-btn-s": "f29a",
    	"sym-btn": "f29b",
    	"sym-bto-s": "f29c",
    	"sym-bto": "f29d",
    	"sym-btrst-s": "f29e",
    	"sym-btrst": "f29f",
    	"sym-bts-s": "f2a0",
    	"sym-bts": "f2a1",
    	"sym-btt-s": "f2a2",
    	"sym-btt": "f2a3",
    	"sym-btu-s": "f2a4",
    	"sym-btu": "f2a5",
    	"sym-btx-s": "f2a6",
    	"sym-btx": "f2a7",
    	"sym-burger-s": "f2a8",
    	"sym-burger": "f2a9",
    	"sym-burst-s": "f2aa",
    	"sym-burst": "f2ab",
    	"sym-bus-s": "f2ac",
    	"sym-bus": "f2ad",
    	"sym-busd-s": "f2ae",
    	"sym-busd": "f2af",
    	"sym-bwx-s": "f2b0",
    	"sym-bwx": "f2b1",
    	"sym-bz-s": "f2b2",
    	"sym-bz": "f2b3",
    	"sym-bzrx-s": "f2b4",
    	"sym-bzrx": "f2b5",
    	"sym-c-s": "f2b6",
    	"sym-c": "f2b7",
    	"sym-c20-s": "f2b8",
    	"sym-c20": "f2b9",
    	"sym-c98-s": "f2ba",
    	"sym-c98": "f2bb",
    	"sym-cad-s": "f2bc",
    	"sym-cad": "f2bd",
    	"sym-cake-s": "f2be",
    	"sym-cake": "f2bf",
    	"sym-cas-s": "f2c0",
    	"sym-cas": "f2c1",
    	"sym-cat-s": "f2c2",
    	"sym-cat": "f2c3",
    	"sym-cbc-s": "f2c4",
    	"sym-cbc": "f2c5",
    	"sym-cbt-s": "f2c6",
    	"sym-cbt": "f2c7",
    	"sym-cdt-s": "f2c8",
    	"sym-cdt": "f2c9",
    	"sym-cel-s": "f2ca",
    	"sym-cel": "f2cb",
    	"sym-celo-s": "f2cc",
    	"sym-celo": "f2cd",
    	"sym-celr-s": "f2ce",
    	"sym-celr": "f2cf",
    	"sym-cennz-s": "f2d0",
    	"sym-cennz": "f2d1",
    	"sym-cfg-s": "f2d2",
    	"sym-cfg": "f2d3",
    	"sym-cfi-s": "f2d4",
    	"sym-cfi": "f2d5",
    	"sym-cfx-s": "f2d6",
    	"sym-cfx": "f2d7",
    	"sym-cgt-s": "f2d8",
    	"sym-cgt": "f2d9",
    	"sym-chat-s": "f2da",
    	"sym-chat": "f2db",
    	"sym-chf-s": "f2dc",
    	"sym-chf": "f2dd",
    	"sym-chp-s": "f2de",
    	"sym-chp": "f2df",
    	"sym-chr-s": "f2e0",
    	"sym-chr": "f2e1",
    	"sym-chsb-s": "f2e2",
    	"sym-chsb": "f2e3",
    	"sym-chx-s": "f2e4",
    	"sym-chx": "f2e5",
    	"sym-chz-s": "f2e6",
    	"sym-chz": "f2e7",
    	"sym-ckb-s": "f2e8",
    	"sym-ckb": "f2e9",
    	"sym-cl-s": "f2ea",
    	"sym-cl": "f2eb",
    	"sym-clam-s": "f2ec",
    	"sym-clam": "f2ed",
    	"sym-cln-s": "f2ee",
    	"sym-cln": "f2ef",
    	"sym-clo-s": "f2f0",
    	"sym-clo": "f2f1",
    	"sym-cloak-s": "f2f2",
    	"sym-cloak": "f2f3",
    	"sym-clv-s": "f2f4",
    	"sym-clv": "f2f5",
    	"sym-cmct-s": "f2f6",
    	"sym-cmct": "f2f7",
    	"sym-cmt-s": "f2f8",
    	"sym-cmt": "f2f9",
    	"sym-cnd-s": "f2fa",
    	"sym-cnd": "f2fb",
    	"sym-cnn-s": "f2fc",
    	"sym-cnn": "f2fd",
    	"sym-cnx-s": "f2fe",
    	"sym-cnx": "f2ff",
    	"sym-cny-s": "f300",
    	"sym-cny": "f301",
    	"sym-cob-s": "f302",
    	"sym-cob": "f303",
    	"sym-cocos-s": "f304",
    	"sym-cocos": "f305",
    	"sym-comp-s": "f306",
    	"sym-comp": "f307",
    	"sym-cope-s": "f308",
    	"sym-cope": "f309",
    	"sym-cos-s": "f30a",
    	"sym-cos": "f30b",
    	"sym-cosm-s": "f30c",
    	"sym-cosm": "f30d",
    	"sym-coss-s": "f30e",
    	"sym-coss": "f30f",
    	"sym-coti-s": "f310",
    	"sym-coti": "f311",
    	"sym-cov-s": "f312",
    	"sym-cov": "f313",
    	"sym-cova-s": "f314",
    	"sym-cova": "f315",
    	"sym-cpt-s": "f316",
    	"sym-cpt": "f317",
    	"sym-cpx-s": "f318",
    	"sym-cpx": "f319",
    	"sym-cqt-s": "f31a",
    	"sym-cqt": "f31b",
    	"sym-cra-s": "f31c",
    	"sym-cra": "f31d",
    	"sym-crab-s": "f31e",
    	"sym-crab": "f31f",
    	"sym-crc-s": "f320",
    	"sym-crc": "f321",
    	"sym-cre-s": "f322",
    	"sym-cre": "f323",
    	"sym-cream-s": "f324",
    	"sym-cream": "f325",
    	"sym-cring-s": "f326",
    	"sym-cring": "f327",
    	"sym-cro-s": "f328",
    	"sym-cro": "f329",
    	"sym-crpt-s": "f32a",
    	"sym-crpt": "f32b",
    	"sym-cru-s": "f32c",
    	"sym-cru": "f32d",
    	"sym-crv-s": "f32e",
    	"sym-crv": "f32f",
    	"sym-crw-s": "f330",
    	"sym-crw": "f331",
    	"sym-csm-s": "f332",
    	"sym-csm": "f333",
    	"sym-csx-s": "f334",
    	"sym-csx": "f335",
    	"sym-ctc-s": "f336",
    	"sym-ctc": "f337",
    	"sym-ctk-s": "f338",
    	"sym-ctk": "f339",
    	"sym-ctsi-s": "f33a",
    	"sym-ctsi": "f33b",
    	"sym-ctxc-s": "f33c",
    	"sym-ctxc": "f33d",
    	"sym-cur-s": "f33e",
    	"sym-cur": "f33f",
    	"sym-cvc-s": "f340",
    	"sym-cvc": "f341",
    	"sym-cvcoin-s": "f342",
    	"sym-cvcoin": "f343",
    	"sym-cvnt-s": "f344",
    	"sym-cvnt": "f345",
    	"sym-cvp-s": "f346",
    	"sym-cvp": "f347",
    	"sym-cvt-s": "f348",
    	"sym-cvt": "f349",
    	"sym-cvx-s": "f34a",
    	"sym-cvx": "f34b",
    	"sym-cw-s": "f34c",
    	"sym-cw": "f34d",
    	"sym-cyc-s": "f34e",
    	"sym-cyc": "f34f",
    	"sym-dac-s": "f350",
    	"sym-dac": "f351",
    	"sym-dacs-s": "f352",
    	"sym-dacs": "f353",
    	"sym-dadi-s": "f354",
    	"sym-dadi": "f355",
    	"sym-dag-s": "f356",
    	"sym-dag": "f357",
    	"sym-dai-s": "f358",
    	"sym-dai": "f359",
    	"sym-dao-s": "f35a",
    	"sym-dao": "f35b",
    	"sym-dar-s": "f35c",
    	"sym-dar": "f35d",
    	"sym-dash-s": "f35e",
    	"sym-dash": "f35f",
    	"sym-dat-s": "f360",
    	"sym-dat": "f361",
    	"sym-data-s": "f362",
    	"sym-data": "f363",
    	"sym-datx-s": "f364",
    	"sym-datx": "f365",
    	"sym-dbc-s": "f366",
    	"sym-dbc": "f367",
    	"sym-dbet-s": "f368",
    	"sym-dbet": "f369",
    	"sym-dbix-s": "f36a",
    	"sym-dbix": "f36b",
    	"sym-dcn-s": "f36c",
    	"sym-dcn": "f36d",
    	"sym-dcr-s": "f36e",
    	"sym-dcr": "f36f",
    	"sym-dct-s": "f370",
    	"sym-dct": "f371",
    	"sym-ddd-s": "f372",
    	"sym-ddd": "f373",
    	"sym-dego-s": "f374",
    	"sym-dego": "f375",
    	"sym-dent-s": "f376",
    	"sym-dent": "f377",
    	"sym-dext-s": "f378",
    	"sym-dext": "f379",
    	"sym-dgb-s": "f37a",
    	"sym-dgb": "f37b",
    	"sym-dgd-s": "f37c",
    	"sym-dgd": "f37d",
    	"sym-dgtx-s": "f37e",
    	"sym-dgtx": "f37f",
    	"sym-dgx-s": "f380",
    	"sym-dgx": "f381",
    	"sym-dhx-s": "f382",
    	"sym-dhx": "f383",
    	"sym-dia-s": "f384",
    	"sym-dia": "f385",
    	"sym-dice-s": "f386",
    	"sym-dice": "f387",
    	"sym-dim-s": "f388",
    	"sym-dim": "f389",
    	"sym-dlt-s": "f38a",
    	"sym-dlt": "f38b",
    	"sym-dmd-s": "f38c",
    	"sym-dmd": "f38d",
    	"sym-dmt-s": "f38e",
    	"sym-dmt": "f38f",
    	"sym-dnt-s": "f390",
    	"sym-dnt": "f391",
    	"sym-dock-s": "f392",
    	"sym-dock": "f393",
    	"sym-dodo-s": "f394",
    	"sym-dodo": "f395",
    	"sym-doge-s": "f396",
    	"sym-doge": "f397",
    	"sym-dot-s": "f398",
    	"sym-dot": "f399",
    	"sym-dpy-s": "f39a",
    	"sym-dpy": "f39b",
    	"sym-dream-s": "f39c",
    	"sym-dream": "f39d",
    	"sym-drep-s": "f39e",
    	"sym-drep": "f39f",
    	"sym-drg-s": "f3a0",
    	"sym-drg": "f3a1",
    	"sym-drgn-s": "f3a2",
    	"sym-drgn": "f3a3",
    	"sym-drt-s": "f3a4",
    	"sym-drt": "f3a5",
    	"sym-dta-s": "f3a6",
    	"sym-dta": "f3a7",
    	"sym-dtb-s": "f3a8",
    	"sym-dtb": "f3a9",
    	"sym-dtr-s": "f3aa",
    	"sym-dtr": "f3ab",
    	"sym-dusk-s": "f3ac",
    	"sym-dusk": "f3ad",
    	"sym-dx-s": "f3ae",
    	"sym-dx": "f3af",
    	"sym-dydx-s": "f3b0",
    	"sym-dydx": "f3b1",
    	"sym-dyn-s": "f3b2",
    	"sym-dyn": "f3b3",
    	"sym-easy": "f3b4",
    	"sym-ecom-s": "f3b5",
    	"sym-ecom": "f3b6",
    	"sym-edc-s": "f3b7",
    	"sym-edc": "f3b8",
    	"sym-edg-s": "f3b9",
    	"sym-edg": "f3ba",
    	"sym-edo-s": "f3bb",
    	"sym-edo": "f3bc",
    	"sym-edp-s": "f3bd",
    	"sym-edp": "f3be",
    	"sym-edr-s": "f3bf",
    	"sym-edr": "f3c0",
    	"sym-efi-s": "f3c1",
    	"sym-efi": "f3c2",
    	"sym-egld-s": "f3c3",
    	"sym-egld": "f3c4",
    	"sym-egt-s": "f3c5",
    	"sym-egt": "f3c6",
    	"sym-ehr-s": "f3c7",
    	"sym-ehr": "f3c8",
    	"sym-eko-s": "f3c9",
    	"sym-eko": "f3ca",
    	"sym-ekt-s": "f3cb",
    	"sym-ekt": "f3cc",
    	"sym-ela-s": "f3cd",
    	"sym-ela": "f3ce",
    	"sym-elec-s": "f3cf",
    	"sym-elec": "f3d0",
    	"sym-elf-s": "f3d1",
    	"sym-elf": "f3d2",
    	"sym-em-s": "f3d3",
    	"sym-em": "f3d4",
    	"sym-emc-s": "f3d5",
    	"sym-emc": "f3d6",
    	"sym-emc2-s": "f3d7",
    	"sym-emc2": "f3d8",
    	"sym-eng-s": "f3d9",
    	"sym-eng": "f3da",
    	"sym-enj-s": "f3db",
    	"sym-enj": "f3dc",
    	"sym-ens-s": "f3dd",
    	"sym-ens": "f3de",
    	"sym-eos-s": "f3df",
    	"sym-eos": "f3e0",
    	"sym-eosdac-s": "f3e1",
    	"sym-eosdac": "f3e2",
    	"sym-eq-s": "f3e3",
    	"sym-eq": "f3e4",
    	"sym-erd-s": "f3e5",
    	"sym-erd": "f3e6",
    	"sym-ern-s": "f3e7",
    	"sym-ern": "f3e8",
    	"sym-es": "f3e9",
    	"sym-es-s": "f3ea",
    	"sym-esd-s": "f3eb",
    	"sym-esd": "f3ec",
    	"sym-etc-s": "f3ed",
    	"sym-etc": "f3ee",
    	"sym-eth-s": "f3ef",
    	"sym-eth": "f3f0",
    	"sym-ethup-s": "f3f1",
    	"sym-ethup": "f3f2",
    	"sym-etn-s": "f3f3",
    	"sym-etn": "f3f4",
    	"sym-etp-s": "f3f5",
    	"sym-etp": "f3f6",
    	"sym-eur-s": "f3f7",
    	"sym-eur": "f3f8",
    	"sym-eurs-s": "f3f9",
    	"sym-eurs": "f3fa",
    	"sym-eurt-s": "f3fb",
    	"sym-eurt": "f3fc",
    	"sym-evn-s": "f3fd",
    	"sym-evn": "f3fe",
    	"sym-evx-s": "f3ff",
    	"sym-evx": "f400",
    	"sym-ewt-s": "f401",
    	"sym-ewt": "f402",
    	"sym-exp-s": "f403",
    	"sym-exp": "f404",
    	"sym-exrd-s": "f405",
    	"sym-exrd": "f406",
    	"sym-exy-s": "f407",
    	"sym-exy": "f408",
    	"sym-ez-s": "f409",
    	"sym-ez": "f40a",
    	"sym-fair-s": "f40b",
    	"sym-fair": "f40c",
    	"sym-farm-s": "f40d",
    	"sym-farm": "f40e",
    	"sym-fct-s": "f40f",
    	"sym-fct": "f410",
    	"sym-fdz-s": "f411",
    	"sym-fdz": "f412",
    	"sym-fee-s": "f413",
    	"sym-fee": "f414",
    	"sym-fet-s": "f415",
    	"sym-fet": "f416",
    	"sym-fida-s": "f417",
    	"sym-fida": "f418",
    	"sym-fil-s": "f419",
    	"sym-fil": "f41a",
    	"sym-fio-s": "f41b",
    	"sym-fio": "f41c",
    	"sym-firo-s": "f41d",
    	"sym-firo": "f41e",
    	"sym-fis-s": "f41f",
    	"sym-fis": "f420",
    	"sym-fldc-s": "f421",
    	"sym-fldc": "f422",
    	"sym-flo-s": "f423",
    	"sym-flo": "f424",
    	"sym-floki-s": "f425",
    	"sym-floki": "f426",
    	"sym-flow-s": "f427",
    	"sym-flow": "f428",
    	"sym-flr-s": "f429",
    	"sym-flr": "f42a",
    	"sym-fluz-s": "f42b",
    	"sym-fluz": "f42c",
    	"sym-fnb-s": "f42d",
    	"sym-fnb": "f42e",
    	"sym-foam-s": "f42f",
    	"sym-foam": "f430",
    	"sym-for-s": "f431",
    	"sym-for": "f432",
    	"sym-forth-s": "f433",
    	"sym-forth": "f434",
    	"sym-fota-s": "f435",
    	"sym-fota": "f436",
    	"sym-frax-s": "f437",
    	"sym-frax": "f438",
    	"sym-front-s": "f439",
    	"sym-front": "f43a",
    	"sym-fsn-s": "f43b",
    	"sym-fsn": "f43c",
    	"sym-ftc-s": "f43d",
    	"sym-ftc": "f43e",
    	"sym-fti-s": "f43f",
    	"sym-fti": "f440",
    	"sym-ftm-s": "f441",
    	"sym-ftm": "f442",
    	"sym-ftt-s": "f443",
    	"sym-ftt": "f444",
    	"sym-ftx-s": "f445",
    	"sym-ftx": "f446",
    	"sym-fuel-s": "f447",
    	"sym-fuel": "f448",
    	"sym-fun-s": "f449",
    	"sym-fun": "f44a",
    	"sym-fx-s": "f44b",
    	"sym-fx": "f44c",
    	"sym-fxc-s": "f44d",
    	"sym-fxc": "f44e",
    	"sym-fxs-s": "f44f",
    	"sym-fxs": "f450",
    	"sym-fxt-s": "f451",
    	"sym-fxt": "f452",
    	"sym-gala-s": "f453",
    	"sym-gala": "f454",
    	"sym-game-s": "f455",
    	"sym-game": "f456",
    	"sym-gard-s": "f457",
    	"sym-gard": "f458",
    	"sym-gari-s": "f459",
    	"sym-gari": "f45a",
    	"sym-gas-s": "f45b",
    	"sym-gas": "f45c",
    	"sym-gbc-s": "f45d",
    	"sym-gbc": "f45e",
    	"sym-gbp-s": "f45f",
    	"sym-gbp": "f460",
    	"sym-gbx-s": "f461",
    	"sym-gbx": "f462",
    	"sym-gbyte-s": "f463",
    	"sym-gbyte": "f464",
    	"sym-gc-s": "f465",
    	"sym-gc": "f466",
    	"sym-gcc-s": "f467",
    	"sym-gcc": "f468",
    	"sym-ge-s": "f469",
    	"sym-ge": "f46a",
    	"sym-geist-s": "f46b",
    	"sym-geist": "f46c",
    	"sym-gen-s": "f46d",
    	"sym-gen": "f46e",
    	"sym-gens-s": "f46f",
    	"sym-gens": "f470",
    	"sym-get-s": "f471",
    	"sym-get": "f472",
    	"sym-ghst-s": "f473",
    	"sym-ghst": "f474",
    	"sym-glc-s": "f475",
    	"sym-glc": "f476",
    	"sym-gld-s": "f477",
    	"sym-gld": "f478",
    	"sym-glm-s": "f479",
    	"sym-glm": "f47a",
    	"sym-glmr-s": "f47b",
    	"sym-glmr": "f47c",
    	"sym-gmat-s": "f47d",
    	"sym-gmat": "f47e",
    	"sym-gmt-s": "f47f",
    	"sym-gmt": "f480",
    	"sym-gmt2-s": "f481",
    	"sym-gmt2": "f482",
    	"sym-gno-s": "f483",
    	"sym-gno": "f484",
    	"sym-gnt-s": "f485",
    	"sym-gnt": "f486",
    	"sym-gnx-s": "f487",
    	"sym-gnx": "f488",
    	"sym-go-s": "f489",
    	"sym-go": "f48a",
    	"sym-gods-s": "f48b",
    	"sym-gods": "f48c",
    	"sym-got-s": "f48d",
    	"sym-got": "f48e",
    	"sym-grc-s": "f48f",
    	"sym-grc": "f490",
    	"sym-grin-s": "f491",
    	"sym-grin": "f492",
    	"sym-grs-s": "f493",
    	"sym-grs": "f494",
    	"sym-grt-s": "f495",
    	"sym-grt": "f496",
    	"sym-gsc-s": "f497",
    	"sym-gsc": "f498",
    	"sym-gst-s": "f499",
    	"sym-gst": "f49a",
    	"sym-gt-s": "f49b",
    	"sym-gt": "f49c",
    	"sym-gtc-s": "f49d",
    	"sym-gtc": "f49e",
    	"sym-gtc2-s": "f49f",
    	"sym-gtc2": "f4a0",
    	"sym-gto-s": "f4a1",
    	"sym-gto": "f4a2",
    	"sym-gup-s": "f4a3",
    	"sym-gup": "f4a4",
    	"sym-gusd-s": "f4a5",
    	"sym-gusd": "f4a6",
    	"sym-gvt-s": "f4a7",
    	"sym-gvt": "f4a8",
    	"sym-gxc-s": "f4a9",
    	"sym-gxc": "f4aa",
    	"sym-gxs-s": "f4ab",
    	"sym-gxs": "f4ac",
    	"sym-hard-s": "f4ad",
    	"sym-hard": "f4ae",
    	"sym-hbar-s": "f4af",
    	"sym-hbar": "f4b0",
    	"sym-hc-s": "f4b1",
    	"sym-hc": "f4b2",
    	"sym-hdx-s": "f4b3",
    	"sym-hdx": "f4b4",
    	"sym-hedg-s": "f4b5",
    	"sym-hedg": "f4b6",
    	"sym-hegic-s": "f4b7",
    	"sym-hegic": "f4b8",
    	"sym-hex-s": "f4b9",
    	"sym-hex": "f4ba",
    	"sym-hft-s": "f4bb",
    	"sym-hft": "f4bc",
    	"sym-hg-s": "f4bd",
    	"sym-hg": "f4be",
    	"sym-hgs-s": "f4bf",
    	"sym-hgs": "f4c0",
    	"sym-hh-s": "f4c1",
    	"sym-hh": "f4c2",
    	"sym-high-s": "f4c3",
    	"sym-high": "f4c4",
    	"sym-hit-s": "f4c5",
    	"sym-hit": "f4c6",
    	"sym-hive-s": "f4c7",
    	"sym-hive": "f4c8",
    	"sym-hkd-s": "f4c9",
    	"sym-hkd": "f4ca",
    	"sym-hmq-s": "f4cb",
    	"sym-hmq": "f4cc",
    	"sym-hns-s": "f4cd",
    	"sym-hns": "f4ce",
    	"sym-ho-s": "f4cf",
    	"sym-ho": "f4d0",
    	"sym-hot-s": "f4d1",
    	"sym-hot": "f4d2",
    	"sym-hp-s": "f4d3",
    	"sym-hp": "f4d4",
    	"sym-hpb-s": "f4d5",
    	"sym-hpb": "f4d6",
    	"sym-hpc-s": "f4d7",
    	"sym-hpc": "f4d8",
    	"sym-hpt-s": "f4d9",
    	"sym-hpt": "f4da",
    	"sym-hrc-s": "f4db",
    	"sym-hrc": "f4dc",
    	"sym-hsc-s": "f4dd",
    	"sym-hsc": "f4de",
    	"sym-hsr-s": "f4df",
    	"sym-hsr": "f4e0",
    	"sym-hst-s": "f4e1",
    	"sym-hst": "f4e2",
    	"sym-ht-s": "f4e3",
    	"sym-ht": "f4e4",
    	"sym-html-s": "f4e5",
    	"sym-html": "f4e6",
    	"sym-htt-s": "f4e7",
    	"sym-htt": "f4e8",
    	"sym-huc-s": "f4e9",
    	"sym-huc": "f4ea",
    	"sym-hvn-s": "f4eb",
    	"sym-hvn": "f4ec",
    	"sym-hxro-s": "f4ed",
    	"sym-hxro": "f4ee",
    	"sym-hyc-s": "f4ef",
    	"sym-hyc": "f4f0",
    	"sym-hydra-s": "f4f1",
    	"sym-hydra": "f4f2",
    	"sym-hydro-s": "f4f3",
    	"sym-hydro": "f4f4",
    	"sym-icn-s": "f4f5",
    	"sym-icn": "f4f6",
    	"sym-icos-s": "f4f7",
    	"sym-icos": "f4f8",
    	"sym-icp-s": "f4f9",
    	"sym-icp": "f4fa",
    	"sym-icx-s": "f4fb",
    	"sym-icx": "f4fc",
    	"sym-idex-s": "f4fd",
    	"sym-idex": "f4fe",
    	"sym-idh-s": "f4ff",
    	"sym-idh": "f500",
    	"sym-idr-s": "f501",
    	"sym-idr": "f502",
    	"sym-ift-s": "f503",
    	"sym-ift": "f504",
    	"sym-ignis-s": "f505",
    	"sym-ignis": "f506",
    	"sym-ihf-s": "f507",
    	"sym-ihf": "f508",
    	"sym-iht-s": "f509",
    	"sym-iht": "f50a",
    	"sym-ilc-s": "f50b",
    	"sym-ilc": "f50c",
    	"sym-ilv-s": "f50d",
    	"sym-ilv": "f50e",
    	"sym-imx-s": "f50f",
    	"sym-imx": "f510",
    	"sym-incnt-s": "f511",
    	"sym-incnt": "f512",
    	"sym-ind-s": "f513",
    	"sym-ind": "f514",
    	"sym-indi-s": "f515",
    	"sym-indi": "f516",
    	"sym-inj-s": "f517",
    	"sym-inj": "f518",
    	"sym-ink-s": "f519",
    	"sym-ink": "f51a",
    	"sym-inr-s": "f51b",
    	"sym-inr": "f51c",
    	"sym-ins-s": "f51d",
    	"sym-ins": "f51e",
    	"sym-int-s": "f51f",
    	"sym-int": "f520",
    	"sym-intr-s": "f521",
    	"sym-intr": "f522",
    	"sym-ioc-s": "f523",
    	"sym-ioc": "f524",
    	"sym-ion-s": "f525",
    	"sym-ion": "f526",
    	"sym-iost-s": "f527",
    	"sym-iost": "f528",
    	"sym-iot-s": "f529",
    	"sym-iot": "f52a",
    	"sym-iotx-s": "f52b",
    	"sym-iotx": "f52c",
    	"sym-iq-s": "f52d",
    	"sym-iq": "f52e",
    	"sym-iris-s": "f52f",
    	"sym-iris": "f530",
    	"sym-itc-s": "f531",
    	"sym-itc": "f532",
    	"sym-ivy-s": "f533",
    	"sym-ivy": "f534",
    	"sym-ixt-s": "f535",
    	"sym-ixt": "f536",
    	"sym-jasmy-s": "f537",
    	"sym-jasmy": "f538",
    	"sym-jnt-s": "f539",
    	"sym-jnt": "f53a",
    	"sym-joe-s": "f53b",
    	"sym-joe": "f53c",
    	"sym-jpy-s": "f53d",
    	"sym-jpy": "f53e",
    	"sym-jst-s": "f53f",
    	"sym-jst": "f540",
    	"sym-juno-s": "f541",
    	"sym-juno": "f542",
    	"sym-just-s": "f543",
    	"sym-just": "f544",
    	"sym-juv-s": "f545",
    	"sym-juv": "f546",
    	"sym-kan-s": "f547",
    	"sym-kan": "f548",
    	"sym-kar-s": "f549",
    	"sym-kar": "f54a",
    	"sym-kava-s": "f54b",
    	"sym-kava": "f54c",
    	"sym-kbc-s": "f54d",
    	"sym-kbc": "f54e",
    	"sym-kcash-s": "f54f",
    	"sym-kcash": "f550",
    	"sym-kda-s": "f551",
    	"sym-kda": "f552",
    	"sym-keep-s": "f553",
    	"sym-keep": "f554",
    	"sym-key-s": "f555",
    	"sym-key": "f556",
    	"sym-kick-s": "f557",
    	"sym-kick": "f558",
    	"sym-kilt-s": "f559",
    	"sym-kilt": "f55a",
    	"sym-kin-s": "f55b",
    	"sym-kin": "f55c",
    	"sym-kint-s": "f55d",
    	"sym-kint": "f55e",
    	"sym-klay-s": "f55f",
    	"sym-klay": "f560",
    	"sym-kma-s": "f561",
    	"sym-kma": "f562",
    	"sym-kmd-s": "f563",
    	"sym-kmd": "f564",
    	"sym-knc-s": "f565",
    	"sym-knc": "f566",
    	"sym-kore-s": "f567",
    	"sym-kore": "f568",
    	"sym-kp3r-s": "f569",
    	"sym-kp3r": "f56a",
    	"sym-krm-s": "f56b",
    	"sym-krm": "f56c",
    	"sym-krw-s": "f56d",
    	"sym-krw": "f56e",
    	"sym-ksm-s": "f56f",
    	"sym-ksm": "f570",
    	"sym-ksx-s": "f571",
    	"sym-ksx": "f572",
    	"sym-kyl-s": "f573",
    	"sym-kyl": "f574",
    	"sym-la-s": "f575",
    	"sym-la": "f576",
    	"sym-lak-s": "f577",
    	"sym-lak": "f578",
    	"sym-lamb-s": "f579",
    	"sym-lamb": "f57a",
    	"sym-latx-s": "f57b",
    	"sym-latx": "f57c",
    	"sym-layr-s": "f57d",
    	"sym-layr": "f57e",
    	"sym-lba-s": "f57f",
    	"sym-lba": "f580",
    	"sym-lbc-s": "f581",
    	"sym-lbc": "f582",
    	"sym-lcc-s": "f583",
    	"sym-lcc": "f584",
    	"sym-lcx-s": "f585",
    	"sym-lcx": "f586",
    	"sym-ldo-s": "f587",
    	"sym-ldo": "f588",
    	"sym-lend-s": "f589",
    	"sym-lend": "f58a",
    	"sym-leo-s": "f58b",
    	"sym-leo": "f58c",
    	"sym-leoc-s": "f58d",
    	"sym-leoc": "f58e",
    	"sym-let-s": "f58f",
    	"sym-let": "f590",
    	"sym-life-s": "f591",
    	"sym-life": "f592",
    	"sym-lina-s": "f593",
    	"sym-lina": "f594",
    	"sym-link-s": "f595",
    	"sym-link": "f596",
    	"sym-lit-s": "f597",
    	"sym-lit": "f598",
    	"sym-lmc-s": "f599",
    	"sym-lmc": "f59a",
    	"sym-lml-s": "f59b",
    	"sym-lml": "f59c",
    	"sym-lnc-s": "f59d",
    	"sym-lnc": "f59e",
    	"sym-lnd-s": "f59f",
    	"sym-lnd": "f5a0",
    	"sym-loc-s": "f5a1",
    	"sym-loc": "f5a2",
    	"sym-looks-s": "f5a3",
    	"sym-looks": "f5a4",
    	"sym-loom-s": "f5a5",
    	"sym-loom": "f5a6",
    	"sym-lpt-s": "f5a7",
    	"sym-lpt": "f5a8",
    	"sym-lrc-s": "f5a9",
    	"sym-lrc": "f5aa",
    	"sym-lrn-s": "f5ab",
    	"sym-lrn": "f5ac",
    	"sym-lsk-s": "f5ad",
    	"sym-lsk": "f5ae",
    	"sym-ltc-s": "f5af",
    	"sym-ltc": "f5b0",
    	"sym-lto-s": "f5b1",
    	"sym-lto": "f5b2",
    	"sym-lun-s": "f5b3",
    	"sym-lun": "f5b4",
    	"sym-luna-s": "f5b5",
    	"sym-luna": "f5b6",
    	"sym-lxt-s": "f5b7",
    	"sym-lxt": "f5b8",
    	"sym-lym-s": "f5b9",
    	"sym-lym": "f5ba",
    	"sym-m2k-s": "f5bb",
    	"sym-m2k": "f5bc",
    	"sym-ma-s": "f5bd",
    	"sym-ma": "f5be",
    	"sym-maid-s": "f5bf",
    	"sym-maid": "f5c0",
    	"sym-man-s": "f5c1",
    	"sym-man": "f5c2",
    	"sym-mana-s": "f5c3",
    	"sym-mana": "f5c4",
    	"sym-mask-s": "f5c5",
    	"sym-mask": "f5c6",
    	"sym-mass-s": "f5c7",
    	"sym-mass": "f5c8",
    	"sym-math-s": "f5c9",
    	"sym-math": "f5ca",
    	"sym-matic-s": "f5cb",
    	"sym-matic": "f5cc",
    	"sym-mbl-s": "f5cd",
    	"sym-mbl": "f5ce",
    	"sym-mbt-s": "f5cf",
    	"sym-mbt": "f5d0",
    	"sym-mc-s": "f5d1",
    	"sym-mc": "f5d2",
    	"sym-mco-s": "f5d3",
    	"sym-mco": "f5d4",
    	"sym-mda-s": "f5d5",
    	"sym-mda": "f5d6",
    	"sym-mds-s": "f5d7",
    	"sym-mds": "f5d8",
    	"sym-mdt-s": "f5d9",
    	"sym-mdt": "f5da",
    	"sym-mdx-s": "f5db",
    	"sym-mdx": "f5dc",
    	"sym-med-s": "f5dd",
    	"sym-med": "f5de",
    	"sym-mer-s": "f5df",
    	"sym-mer": "f5e0",
    	"sym-mes-s": "f5e1",
    	"sym-mes": "f5e2",
    	"sym-met-s": "f5e3",
    	"sym-met": "f5e4",
    	"sym-meta-s": "f5e5",
    	"sym-meta": "f5e6",
    	"sym-mft-s": "f5e7",
    	"sym-mft": "f5e8",
    	"sym-mgc-s": "f5e9",
    	"sym-mgc": "f5ea",
    	"sym-mgo-s": "f5eb",
    	"sym-mgo": "f5ec",
    	"sym-mhc-s": "f5ed",
    	"sym-mhc": "f5ee",
    	"sym-mina-s": "f5ef",
    	"sym-mina": "f5f0",
    	"sym-mir-s": "f5f1",
    	"sym-mir": "f5f2",
    	"sym-mith-s": "f5f3",
    	"sym-mith": "f5f4",
    	"sym-mitx-s": "f5f5",
    	"sym-mitx": "f5f6",
    	"sym-mjp-s": "f5f7",
    	"sym-mjp": "f5f8",
    	"sym-mkr-s": "f5f9",
    	"sym-mkr": "f5fa",
    	"sym-mln-s": "f5fb",
    	"sym-mln": "f5fc",
    	"sym-mngo-s": "f5fd",
    	"sym-mngo": "f5fe",
    	"sym-mnx-s": "f5ff",
    	"sym-mnx": "f600",
    	"sym-moac-s": "f601",
    	"sym-moac": "f602",
    	"sym-mob-s": "f603",
    	"sym-mob": "f604",
    	"sym-mobi-s": "f605",
    	"sym-mobi": "f606",
    	"sym-moc-s": "f607",
    	"sym-moc": "f608",
    	"sym-mod-s": "f609",
    	"sym-mod": "f60a",
    	"sym-mona-s": "f60b",
    	"sym-mona": "f60c",
    	"sym-moon-s": "f60d",
    	"sym-moon": "f60e",
    	"sym-morph-s": "f60f",
    	"sym-morph": "f610",
    	"sym-movr-s": "f611",
    	"sym-movr": "f612",
    	"sym-mpl-s": "f613",
    	"sym-mpl": "f614",
    	"sym-mrk-s": "f615",
    	"sym-mrk": "f616",
    	"sym-msol-s": "f617",
    	"sym-msol": "f618",
    	"sym-msp-s": "f619",
    	"sym-msp": "f61a",
    	"sym-mta-s": "f61b",
    	"sym-mta": "f61c",
    	"sym-mtc-s": "f61d",
    	"sym-mtc": "f61e",
    	"sym-mth-s": "f61f",
    	"sym-mth": "f620",
    	"sym-mtl-s": "f621",
    	"sym-mtl": "f622",
    	"sym-mtn-s": "f623",
    	"sym-mtn": "f624",
    	"sym-mtx-s": "f625",
    	"sym-mtx": "f626",
    	"sym-mue-s": "f627",
    	"sym-mue": "f628",
    	"sym-multi-s": "f629",
    	"sym-multi": "f62a",
    	"sym-mv-s": "f62b",
    	"sym-mv": "f62c",
    	"sym-mx-s": "f62d",
    	"sym-mx": "f62e",
    	"sym-mxc-s": "f62f",
    	"sym-mxc": "f630",
    	"sym-mxm-s": "f631",
    	"sym-mxm": "f632",
    	"sym-mxn-s": "f633",
    	"sym-mxn": "f634",
    	"sym-myr-s": "f635",
    	"sym-myr": "f636",
    	"sym-n9l-s": "f637",
    	"sym-n9l": "f638",
    	"sym-nanj-s": "f639",
    	"sym-nanj": "f63a",
    	"sym-nano-s": "f63b",
    	"sym-nano": "f63c",
    	"sym-nas-s": "f63d",
    	"sym-nas": "f63e",
    	"sym-naut-s": "f63f",
    	"sym-naut": "f640",
    	"sym-nav-s": "f641",
    	"sym-nav": "f642",
    	"sym-ncash-s": "f643",
    	"sym-ncash": "f644",
    	"sym-nct-s": "f645",
    	"sym-nct": "f646",
    	"sym-near-s": "f647",
    	"sym-near": "f648",
    	"sym-nebl-s": "f649",
    	"sym-nebl": "f64a",
    	"sym-nec-s": "f64b",
    	"sym-nec": "f64c",
    	"sym-neo-s": "f64d",
    	"sym-neo": "f64e",
    	"sym-neos-s": "f64f",
    	"sym-neos": "f650",
    	"sym-nest-s": "f651",
    	"sym-nest": "f652",
    	"sym-neu-s": "f653",
    	"sym-neu": "f654",
    	"sym-new-s": "f655",
    	"sym-new": "f656",
    	"sym-nexo-s": "f657",
    	"sym-nexo": "f658",
    	"sym-nft-s": "f659",
    	"sym-nft": "f65a",
    	"sym-ng-s": "f65b",
    	"sym-ng": "f65c",
    	"sym-ngc-s": "f65d",
    	"sym-ngc": "f65e",
    	"sym-ngn-s": "f65f",
    	"sym-ngn": "f660",
    	"sym-nim-s": "f661",
    	"sym-nim": "f662",
    	"sym-niy-s": "f663",
    	"sym-niy": "f664",
    	"sym-nkd-s": "f665",
    	"sym-nkd": "f666",
    	"sym-nkn-s": "f667",
    	"sym-nkn": "f668",
    	"sym-nlc2-s": "f669",
    	"sym-nlc2": "f66a",
    	"sym-nlg-s": "f66b",
    	"sym-nlg": "f66c",
    	"sym-nmc-s": "f66d",
    	"sym-nmc": "f66e",
    	"sym-nmr-s": "f66f",
    	"sym-nmr": "f670",
    	"sym-nn-s": "f671",
    	"sym-nn": "f672",
    	"sym-noah-s": "f673",
    	"sym-noah": "f674",
    	"sym-nodl-s": "f675",
    	"sym-nodl": "f676",
    	"sym-note-s": "f677",
    	"sym-note": "f678",
    	"sym-npg-s": "f679",
    	"sym-npg": "f67a",
    	"sym-nplc-s": "f67b",
    	"sym-nplc": "f67c",
    	"sym-npxs-s": "f67d",
    	"sym-npxs": "f67e",
    	"sym-nq-s": "f67f",
    	"sym-nq": "f680",
    	"sym-nrg-s": "f681",
    	"sym-nrg": "f682",
    	"sym-ntk-s": "f683",
    	"sym-ntk": "f684",
    	"sym-nu-s": "f685",
    	"sym-nu": "f686",
    	"sym-nuls-s": "f687",
    	"sym-nuls": "f688",
    	"sym-nvc-s": "f689",
    	"sym-nvc": "f68a",
    	"sym-nxc-s": "f68b",
    	"sym-nxc": "f68c",
    	"sym-nxs-s": "f68d",
    	"sym-nxs": "f68e",
    	"sym-nxt-s": "f68f",
    	"sym-nxt": "f690",
    	"sym-nym-s": "f691",
    	"sym-nym": "f692",
    	"sym-o-s": "f693",
    	"sym-o": "f694",
    	"sym-oax-s": "f695",
    	"sym-oax": "f696",
    	"sym-ocean-s": "f697",
    	"sym-ocean": "f698",
    	"sym-ocn-s": "f699",
    	"sym-ocn": "f69a",
    	"sym-ode-s": "f69b",
    	"sym-ode": "f69c",
    	"sym-ogn-s": "f69d",
    	"sym-ogn": "f69e",
    	"sym-ogo-s": "f69f",
    	"sym-ogo": "f6a0",
    	"sym-ok-s": "f6a1",
    	"sym-ok": "f6a2",
    	"sym-okb-s": "f6a3",
    	"sym-okb": "f6a4",
    	"sym-om-s": "f6a5",
    	"sym-om": "f6a6",
    	"sym-omg-s": "f6a7",
    	"sym-omg": "f6a8",
    	"sym-omni-s": "f6a9",
    	"sym-omni": "f6aa",
    	"sym-one-s": "f6ab",
    	"sym-one": "f6ac",
    	"sym-ong-s": "f6ad",
    	"sym-ong": "f6ae",
    	"sym-onot-s": "f6af",
    	"sym-onot": "f6b0",
    	"sym-ont-s": "f6b1",
    	"sym-ont": "f6b2",
    	"sym-orbs-s": "f6b3",
    	"sym-orbs": "f6b4",
    	"sym-orca-s": "f6b5",
    	"sym-orca": "f6b6",
    	"sym-orme-s": "f6b7",
    	"sym-orme": "f6b8",
    	"sym-orn-s": "f6b9",
    	"sym-orn": "f6ba",
    	"sym-ors-s": "f6bb",
    	"sym-ors": "f6bc",
    	"sym-osmo-s": "f6bd",
    	"sym-osmo": "f6be",
    	"sym-ost-s": "f6bf",
    	"sym-ost": "f6c0",
    	"sym-otn-s": "f6c1",
    	"sym-otn": "f6c2",
    	"sym-oxt-s": "f6c3",
    	"sym-oxt": "f6c4",
    	"sym-oxy-s": "f6c5",
    	"sym-oxy": "f6c6",
    	"sym-pai-s": "f6c7",
    	"sym-pai": "f6c8",
    	"sym-pal-s": "f6c9",
    	"sym-pal": "f6ca",
    	"sym-paper-s": "f6cb",
    	"sym-paper": "f6cc",
    	"sym-para-s": "f6cd",
    	"sym-para": "f6ce",
    	"sym-part-s": "f6cf",
    	"sym-part": "f6d0",
    	"sym-pasc-s": "f6d1",
    	"sym-pasc": "f6d2",
    	"sym-pat-s": "f6d3",
    	"sym-pat": "f6d4",
    	"sym-pax-s": "f6d5",
    	"sym-pax": "f6d6",
    	"sym-paxg-s": "f6d7",
    	"sym-paxg": "f6d8",
    	"sym-pay-s": "f6d9",
    	"sym-pay": "f6da",
    	"sym-pbt-s": "f6db",
    	"sym-pbt": "f6dc",
    	"sym-pcl-s": "f6dd",
    	"sym-pcl": "f6de",
    	"sym-pcx-s": "f6df",
    	"sym-pcx": "f6e0",
    	"sym-pdex-s": "f6e1",
    	"sym-pdex": "f6e2",
    	"sym-people-s": "f6e3",
    	"sym-people": "f6e4",
    	"sym-perl-s": "f6e5",
    	"sym-perl": "f6e6",
    	"sym-perp-s": "f6e7",
    	"sym-perp": "f6e8",
    	"sym-pha-s": "f6e9",
    	"sym-pha": "f6ea",
    	"sym-phb-s": "f6eb",
    	"sym-phb": "f6ec",
    	"sym-php-s": "f6ed",
    	"sym-php": "f6ee",
    	"sym-phx-s": "f6ef",
    	"sym-phx": "f6f0",
    	"sym-pi-s": "f6f1",
    	"sym-pi": "f6f2",
    	"sym-pica-s": "f6f3",
    	"sym-pica": "f6f4",
    	"sym-pink-s": "f6f5",
    	"sym-pink": "f6f6",
    	"sym-pivx-s": "f6f7",
    	"sym-pivx": "f6f8",
    	"sym-pkt-s": "f6f9",
    	"sym-pkt": "f6fa",
    	"sym-pl-s": "f6fb",
    	"sym-pl": "f6fc",
    	"sym-pla-s": "f6fd",
    	"sym-pla": "f6fe",
    	"sym-plbt-s": "f6ff",
    	"sym-plbt": "f700",
    	"sym-plm-s": "f701",
    	"sym-plm": "f702",
    	"sym-pln-s": "f703",
    	"sym-pln": "f704",
    	"sym-plr-s": "f705",
    	"sym-plr": "f706",
    	"sym-ply-s": "f707",
    	"sym-ply": "f708",
    	"sym-pma-s": "f709",
    	"sym-pma": "f70a",
    	"sym-png-s": "f70b",
    	"sym-png": "f70c",
    	"sym-pnt-s": "f70d",
    	"sym-pnt": "f70e",
    	"sym-poa-s": "f70f",
    	"sym-poa": "f710",
    	"sym-poe-s": "f711",
    	"sym-poe": "f712",
    	"sym-polis-s": "f713",
    	"sym-polis": "f714",
    	"sym-pols-s": "f715",
    	"sym-pols": "f716",
    	"sym-poly-s": "f717",
    	"sym-poly": "f718",
    	"sym-pond-s": "f719",
    	"sym-pond": "f71a",
    	"sym-pot-s": "f71b",
    	"sym-pot": "f71c",
    	"sym-powr-s": "f71d",
    	"sym-powr": "f71e",
    	"sym-ppc-s": "f71f",
    	"sym-ppc": "f720",
    	"sym-ppt-s": "f721",
    	"sym-ppt": "f722",
    	"sym-pra-s": "f723",
    	"sym-pra": "f724",
    	"sym-pre-s": "f725",
    	"sym-pre": "f726",
    	"sym-prg-s": "f727",
    	"sym-prg": "f728",
    	"sym-pro-s": "f729",
    	"sym-pro": "f72a",
    	"sym-prq-s": "f72b",
    	"sym-prq": "f72c",
    	"sym-pst-s": "f72d",
    	"sym-pst": "f72e",
    	"sym-pstake-s": "f72f",
    	"sym-pstake": "f730",
    	"sym-pton-s": "f731",
    	"sym-pton": "f732",
    	"sym-pvt-s": "f733",
    	"sym-pvt": "f734",
    	"sym-pxg-s": "f735",
    	"sym-pxg": "f736",
    	"sym-pyr-s": "f737",
    	"sym-pyr": "f738",
    	"sym-qash-s": "f739",
    	"sym-qash": "f73a",
    	"sym-qau-s": "f73b",
    	"sym-qau": "f73c",
    	"sym-qc-s": "f73d",
    	"sym-qc": "f73e",
    	"sym-qi-s": "f73f",
    	"sym-qi": "f740",
    	"sym-qi2-s": "f741",
    	"sym-qi2": "f742",
    	"sym-qkc-s": "f743",
    	"sym-qkc": "f744",
    	"sym-qlc-s": "f745",
    	"sym-qlc": "f746",
    	"sym-qnt-s": "f747",
    	"sym-qnt": "f748",
    	"sym-qntu-s": "f749",
    	"sym-qntu": "f74a",
    	"sym-qo-s": "f74b",
    	"sym-qo": "f74c",
    	"sym-qrl-s": "f74d",
    	"sym-qrl": "f74e",
    	"sym-qsp-s": "f74f",
    	"sym-qsp": "f750",
    	"sym-qtum-s": "f751",
    	"sym-qtum": "f752",
    	"sym-quick-s": "f753",
    	"sym-quick": "f754",
    	"sym-qun-s": "f755",
    	"sym-qun": "f756",
    	"sym-r-s": "f757",
    	"sym-r": "f758",
    	"sym-rad-s": "f759",
    	"sym-rad": "f75a",
    	"sym-radar-s": "f75b",
    	"sym-radar": "f75c",
    	"sym-rads-s": "f75d",
    	"sym-rads": "f75e",
    	"sym-rare-s": "f75f",
    	"sym-rare": "f760",
    	"sym-rari-s": "f761",
    	"sym-rari": "f762",
    	"sym-rating-s": "f763",
    	"sym-rating": "f764",
    	"sym-ray-s": "f765",
    	"sym-ray": "f766",
    	"sym-rb-s": "f767",
    	"sym-rb": "f768",
    	"sym-rbc-s": "f769",
    	"sym-rbc": "f76a",
    	"sym-rblx-s": "f76b",
    	"sym-rblx": "f76c",
    	"sym-rbtc-s": "f76d",
    	"sym-rbtc": "f76e",
    	"sym-rby-s": "f76f",
    	"sym-rby": "f770",
    	"sym-rcn-s": "f771",
    	"sym-rcn": "f772",
    	"sym-rdd-s": "f773",
    	"sym-rdd": "f774",
    	"sym-rdn-s": "f775",
    	"sym-rdn": "f776",
    	"sym-real-s": "f777",
    	"sym-real": "f778",
    	"sym-reef-s": "f779",
    	"sym-reef": "f77a",
    	"sym-rem-s": "f77b",
    	"sym-rem": "f77c",
    	"sym-ren-s": "f77d",
    	"sym-ren": "f77e",
    	"sym-rep-s": "f77f",
    	"sym-rep": "f780",
    	"sym-repv2-s": "f781",
    	"sym-repv2": "f782",
    	"sym-req-s": "f783",
    	"sym-req": "f784",
    	"sym-rev-s": "f785",
    	"sym-rev": "f786",
    	"sym-rfox-s": "f787",
    	"sym-rfox": "f788",
    	"sym-rfr-s": "f789",
    	"sym-rfr": "f78a",
    	"sym-ric-s": "f78b",
    	"sym-ric": "f78c",
    	"sym-rif-s": "f78d",
    	"sym-rif": "f78e",
    	"sym-ring-s": "f78f",
    	"sym-ring": "f790",
    	"sym-rlc-s": "f791",
    	"sym-rlc": "f792",
    	"sym-rly-s": "f793",
    	"sym-rly": "f794",
    	"sym-rmrk-s": "f795",
    	"sym-rmrk": "f796",
    	"sym-rndr-s": "f797",
    	"sym-rndr": "f798",
    	"sym-rntb-s": "f799",
    	"sym-rntb": "f79a",
    	"sym-ron-s": "f79b",
    	"sym-ron": "f79c",
    	"sym-rook-s": "f79d",
    	"sym-rook": "f79e",
    	"sym-rose-s": "f79f",
    	"sym-rose": "f7a0",
    	"sym-rox-s": "f7a1",
    	"sym-rox": "f7a2",
    	"sym-rp-s": "f7a3",
    	"sym-rp": "f7a4",
    	"sym-rpx-s": "f7a5",
    	"sym-rpx": "f7a6",
    	"sym-rsr-s": "f7a7",
    	"sym-rsr": "f7a8",
    	"sym-rsv-s": "f7a9",
    	"sym-rsv": "f7aa",
    	"sym-rty-s": "f7ab",
    	"sym-rty": "f7ac",
    	"sym-rub-s": "f7ad",
    	"sym-rub": "f7ae",
    	"sym-ruff-s": "f7af",
    	"sym-ruff": "f7b0",
    	"sym-rune-s": "f7b1",
    	"sym-rune": "f7b2",
    	"sym-rvn-s": "f7b3",
    	"sym-rvn": "f7b4",
    	"sym-rvr-s": "f7b5",
    	"sym-rvr": "f7b6",
    	"sym-rvt-s": "f7b7",
    	"sym-rvt": "f7b8",
    	"sym-sai-s": "f7b9",
    	"sym-sai": "f7ba",
    	"sym-salt-s": "f7bb",
    	"sym-salt": "f7bc",
    	"sym-samo-s": "f7bd",
    	"sym-samo": "f7be",
    	"sym-san-s": "f7bf",
    	"sym-san": "f7c0",
    	"sym-sand-s": "f7c1",
    	"sym-sand": "f7c2",
    	"sym-sats-s": "f7c3",
    	"sym-sats": "f7c4",
    	"sym-sbd-s": "f7c5",
    	"sym-sbd": "f7c6",
    	"sym-sbr-s": "f7c7",
    	"sym-sbr": "f7c8",
    	"sym-sc-s": "f7c9",
    	"sym-sc": "f7ca",
    	"sym-scc-s": "f7cb",
    	"sym-scc": "f7cc",
    	"sym-scrt-s": "f7cd",
    	"sym-scrt": "f7ce",
    	"sym-sdc-s": "f7cf",
    	"sym-sdc": "f7d0",
    	"sym-sdn-s": "f7d1",
    	"sym-sdn": "f7d2",
    	"sym-seele-s": "f7d3",
    	"sym-seele": "f7d4",
    	"sym-sek-s": "f7d5",
    	"sym-sek": "f7d6",
    	"sym-sen-s": "f7d7",
    	"sym-sen": "f7d8",
    	"sym-sent-s": "f7d9",
    	"sym-sent": "f7da",
    	"sym-sero-s": "f7db",
    	"sym-sero": "f7dc",
    	"sym-sexc-s": "f7dd",
    	"sym-sexc": "f7de",
    	"sym-sfp-s": "f7df",
    	"sym-sfp": "f7e0",
    	"sym-sgb-s": "f7e1",
    	"sym-sgb": "f7e2",
    	"sym-sgc-s": "f7e3",
    	"sym-sgc": "f7e4",
    	"sym-sgd-s": "f7e5",
    	"sym-sgd": "f7e6",
    	"sym-sgn-s": "f7e7",
    	"sym-sgn": "f7e8",
    	"sym-sgu-s": "f7e9",
    	"sym-sgu": "f7ea",
    	"sym-shib-s": "f7eb",
    	"sym-shib": "f7ec",
    	"sym-shift-s": "f7ed",
    	"sym-shift": "f7ee",
    	"sym-ship-s": "f7ef",
    	"sym-ship": "f7f0",
    	"sym-si-s": "f7f1",
    	"sym-si": "f7f2",
    	"sym-sib-s": "f7f3",
    	"sym-sib": "f7f4",
    	"sym-sil-s": "f7f5",
    	"sym-sil": "f7f6",
    	"sym-six-s": "f7f7",
    	"sym-six": "f7f8",
    	"sym-sjcx-s": "f7f9",
    	"sym-sjcx": "f7fa",
    	"sym-skl-s": "f7fb",
    	"sym-skl": "f7fc",
    	"sym-skm-s": "f7fd",
    	"sym-skm": "f7fe",
    	"sym-sku-s": "f7ff",
    	"sym-sku": "f800",
    	"sym-sky-s": "f801",
    	"sym-sky": "f802",
    	"sym-slp-s": "f803",
    	"sym-slp": "f804",
    	"sym-slr-s": "f805",
    	"sym-slr": "f806",
    	"sym-sls-s": "f807",
    	"sym-sls": "f808",
    	"sym-slt-s": "f809",
    	"sym-slt": "f80a",
    	"sym-slv-s": "f80b",
    	"sym-slv": "f80c",
    	"sym-smart-s": "f80d",
    	"sym-smart": "f80e",
    	"sym-smn-s": "f80f",
    	"sym-smn": "f810",
    	"sym-smt-s": "f811",
    	"sym-smt": "f812",
    	"sym-snc-s": "f813",
    	"sym-snc": "f814",
    	"sym-snet-s": "f815",
    	"sym-snet": "f816",
    	"sym-sngls-s": "f817",
    	"sym-sngls": "f818",
    	"sym-snm-s": "f819",
    	"sym-snm": "f81a",
    	"sym-snt-s": "f81b",
    	"sym-snt": "f81c",
    	"sym-snx-s": "f81d",
    	"sym-snx": "f81e",
    	"sym-soc-s": "f81f",
    	"sym-soc": "f820",
    	"sym-socks-s": "f821",
    	"sym-socks": "f822",
    	"sym-sol-s": "f823",
    	"sym-sol": "f824",
    	"sym-solid-s": "f825",
    	"sym-solid": "f826",
    	"sym-solo-s": "f827",
    	"sym-solo": "f828",
    	"sym-solve-s": "f829",
    	"sym-solve": "f82a",
    	"sym-sos-s": "f82b",
    	"sym-sos": "f82c",
    	"sym-soul-s": "f82d",
    	"sym-soul": "f82e",
    	"sym-sp-s": "f82f",
    	"sym-sp": "f830",
    	"sym-sparta-s": "f831",
    	"sym-sparta": "f832",
    	"sym-spc-s": "f833",
    	"sym-spc": "f834",
    	"sym-spd-s": "f835",
    	"sym-spd": "f836",
    	"sym-spell-s": "f837",
    	"sym-spell": "f838",
    	"sym-sphr-s": "f839",
    	"sym-sphr": "f83a",
    	"sym-sphtx-s": "f83b",
    	"sym-sphtx": "f83c",
    	"sym-spnd-s": "f83d",
    	"sym-spnd": "f83e",
    	"sym-spnk-s": "f83f",
    	"sym-spnk": "f840",
    	"sym-srm-s": "f841",
    	"sym-srm": "f842",
    	"sym-srn-s": "f843",
    	"sym-srn": "f844",
    	"sym-ssp-s": "f845",
    	"sym-ssp": "f846",
    	"sym-stacs-s": "f847",
    	"sym-stacs": "f848",
    	"sym-step-s": "f849",
    	"sym-step": "f84a",
    	"sym-stg-s": "f84b",
    	"sym-stg": "f84c",
    	"sym-storm-s": "f84d",
    	"sym-storm": "f84e",
    	"sym-stpt-s": "f84f",
    	"sym-stpt": "f850",
    	"sym-stq-s": "f851",
    	"sym-stq": "f852",
    	"sym-str-s": "f853",
    	"sym-str": "f854",
    	"sym-strat-s": "f855",
    	"sym-strat": "f856",
    	"sym-strax-s": "f857",
    	"sym-strax": "f858",
    	"sym-strk-s": "f859",
    	"sym-strk": "f85a",
    	"sym-strong-s": "f85b",
    	"sym-strong": "f85c",
    	"sym-stx-s": "f85d",
    	"sym-stx": "f85e",
    	"sym-sub-s": "f85f",
    	"sym-sub": "f860",
    	"sym-sun-s": "f861",
    	"sym-sun": "f862",
    	"sym-super-s": "f863",
    	"sym-super": "f864",
    	"sym-susd-s": "f865",
    	"sym-susd": "f866",
    	"sym-sushi-s": "f867",
    	"sym-sushi": "f868",
    	"sym-swftc-s": "f869",
    	"sym-swftc": "f86a",
    	"sym-swm-s": "f86b",
    	"sym-swm": "f86c",
    	"sym-swrv-s": "f86d",
    	"sym-swrv": "f86e",
    	"sym-swt-s": "f86f",
    	"sym-swt": "f870",
    	"sym-swth-s": "f871",
    	"sym-swth": "f872",
    	"sym-sxp-s": "f873",
    	"sym-sxp": "f874",
    	"sym-syn-s": "f875",
    	"sym-syn": "f876",
    	"sym-sys-s": "f877",
    	"sym-sys": "f878",
    	"sym-t-s": "f879",
    	"sym-t": "f87a",
    	"sym-taas-s": "f87b",
    	"sym-taas": "f87c",
    	"sym-tau-s": "f87d",
    	"sym-tau": "f87e",
    	"sym-tbtc-s": "f87f",
    	"sym-tbtc": "f880",
    	"sym-tct-s": "f881",
    	"sym-tct": "f882",
    	"sym-teer-s": "f883",
    	"sym-teer": "f884",
    	"sym-tel-s": "f885",
    	"sym-temco-s": "f886",
    	"sym-temco": "f887",
    	"sym-tfuel-s": "f888",
    	"sym-tfuel": "f889",
    	"sym-thb-s": "f88a",
    	"sym-thb": "f88b",
    	"sym-thc-s": "f88c",
    	"sym-thc": "f88d",
    	"sym-theta-s": "f88e",
    	"sym-theta": "f88f",
    	"sym-thx-s": "f890",
    	"sym-thx": "f891",
    	"sym-time-s": "f892",
    	"sym-time": "f893",
    	"sym-tio-s": "f894",
    	"sym-tio": "f895",
    	"sym-tix-s": "f896",
    	"sym-tix": "f897",
    	"sym-tkn-s": "f898",
    	"sym-tkn": "f899",
    	"sym-tky-s": "f89a",
    	"sym-tky": "f89b",
    	"sym-tlm-s": "f89c",
    	"sym-tlm": "f89d",
    	"sym-tnb-s": "f89e",
    	"sym-tnb": "f89f",
    	"sym-tnc-s": "f8a0",
    	"sym-tnc": "f8a1",
    	"sym-tnt-s": "f8a2",
    	"sym-tnt": "f8a3",
    	"sym-toke-s": "f8a4",
    	"sym-toke": "f8a5",
    	"sym-tomb-s": "f8a6",
    	"sym-tomb": "f8a7",
    	"sym-tomo-s": "f8a8",
    	"sym-tomo": "f8a9",
    	"sym-top-s": "f8aa",
    	"sym-top": "f8ab",
    	"sym-torn-s": "f8ac",
    	"sym-torn": "f8ad",
    	"sym-tpay-s": "f8ae",
    	"sym-tpay": "f8af",
    	"sym-trac-s": "f8b0",
    	"sym-trac": "f8b1",
    	"sym-trb-s": "f8b2",
    	"sym-trb": "f8b3",
    	"sym-tribe-s": "f8b4",
    	"sym-tribe": "f8b5",
    	"sym-trig-s": "f8b6",
    	"sym-trig": "f8b7",
    	"sym-trio-s": "f8b8",
    	"sym-trio": "f8b9",
    	"sym-troy-s": "f8ba",
    	"sym-troy": "f8bb",
    	"sym-trst-s": "f8bc",
    	"sym-trst": "f8bd",
    	"sym-tru-s": "f8be",
    	"sym-tru": "f8bf",
    	"sym-true-s": "f8c0",
    	"sym-true": "f8c1",
    	"sym-trx-s": "f8c2",
    	"sym-trx": "f8c3",
    	"sym-try-s": "f8c4",
    	"sym-try": "f8c5",
    	"sym-tryb-s": "f8c6",
    	"sym-tryb": "f8c7",
    	"sym-tt-s": "f8c8",
    	"sym-tt": "f8c9",
    	"sym-ttc-s": "f8ca",
    	"sym-ttc": "f8cb",
    	"sym-ttt-s": "f8cc",
    	"sym-ttt": "f8cd",
    	"sym-ttu-s": "f8ce",
    	"sym-ttu": "f8cf",
    	"sym-tube-s": "f8d0",
    	"sym-tube": "f8d1",
    	"sym-tusd-s": "f8d2",
    	"sym-tusd": "f8d3",
    	"sym-tvk-s": "f8d4",
    	"sym-tvk": "f8d5",
    	"sym-twt-s": "f8d6",
    	"sym-twt": "f8d7",
    	"sym-uah-s": "f8d8",
    	"sym-uah": "f8d9",
    	"sym-ubq-s": "f8da",
    	"sym-ubq": "f8db",
    	"sym-ubt-s": "f8dc",
    	"sym-ubt": "f8dd",
    	"sym-uft-s": "f8de",
    	"sym-uft": "f8df",
    	"sym-ugas-s": "f8e0",
    	"sym-ugas": "f8e1",
    	"sym-uip-s": "f8e2",
    	"sym-uip": "f8e3",
    	"sym-ukg-s": "f8e4",
    	"sym-ukg": "f8e5",
    	"sym-uma-s": "f8e6",
    	"sym-uma": "f8e7",
    	"sym-unfi-s": "f8e8",
    	"sym-unfi": "f8e9",
    	"sym-uni-s": "f8ea",
    	"sym-uni": "f8eb",
    	"sym-unq-s": "f8ec",
    	"sym-unq": "f8ed",
    	"sym-up-s": "f8ee",
    	"sym-up": "f8ef",
    	"sym-upp-s": "f8f0",
    	"sym-upp": "f8f1",
    	"sym-usd-s": "f8f2",
    	"sym-usd": "f8f3",
    	"sym-usdc-s": "f8f4",
    	"sym-usdc": "f8f5",
    	"sym-usds-s": "f8f6",
    	"sym-usds": "f8f7",
    	"sym-usk-s": "f8f8",
    	"sym-usk": "f8f9",
    	"sym-ust-s": "f8fa",
    	"sym-ust": "f8fb",
    	"sym-utk-s": "f8fc",
    	"sym-utk": "f8fd",
    	"sym-utnp-s": "f8fe",
    	"sym-utnp": "f8ff",
    	"sym-utt-s": "f900",
    	"sym-utt": "f901",
    	"sym-uuu-s": "f902",
    	"sym-uuu": "f903",
    	"sym-ux-s": "f904",
    	"sym-ux": "f905",
    	"sym-vader-s": "f906",
    	"sym-vader": "f907",
    	"sym-vai-s": "f908",
    	"sym-vai": "f909",
    	"sym-vbk-s": "f90a",
    	"sym-vbk": "f90b",
    	"sym-vdx-s": "f90c",
    	"sym-vdx": "f90d",
    	"sym-vee-s": "f90e",
    	"sym-vee": "f90f",
    	"sym-ven-s": "f910",
    	"sym-ven": "f911",
    	"sym-veo-s": "f912",
    	"sym-veo": "f913",
    	"sym-veri-s": "f914",
    	"sym-veri": "f915",
    	"sym-vex-s": "f916",
    	"sym-vex": "f917",
    	"sym-vgx-s": "f918",
    	"sym-vgx": "f919",
    	"sym-via-s": "f91a",
    	"sym-via": "f91b",
    	"sym-vib-s": "f91c",
    	"sym-vib": "f91d",
    	"sym-vibe-s": "f91e",
    	"sym-vibe": "f91f",
    	"sym-vid-s": "f920",
    	"sym-vid": "f921",
    	"sym-vidt-s": "f922",
    	"sym-vidt": "f923",
    	"sym-vidy-s": "f924",
    	"sym-vidy": "f925",
    	"sym-vitae-s": "f926",
    	"sym-vitae": "f927",
    	"sym-vite-s": "f928",
    	"sym-vite": "f929",
    	"sym-vlx-s": "f92a",
    	"sym-vlx": "f92b",
    	"sym-vox-s": "f92c",
    	"sym-vox": "f92d",
    	"sym-vra-s": "f92e",
    	"sym-vra": "f92f",
    	"sym-vrc-s": "f930",
    	"sym-vrc": "f931",
    	"sym-vrm-s": "f932",
    	"sym-vrm": "f933",
    	"sym-vsys-s": "f934",
    	"sym-vsys": "f935",
    	"sym-vtc-s": "f936",
    	"sym-vtc": "f937",
    	"sym-vtho-s": "f938",
    	"sym-vtho": "f939",
    	"sym-wabi-s": "f93a",
    	"sym-wabi": "f93b",
    	"sym-wan-s": "f93c",
    	"sym-wan": "f93d",
    	"sym-waves-s": "f93e",
    	"sym-waves": "f93f",
    	"sym-wax-s": "f940",
    	"sym-wax": "f941",
    	"sym-wbtc-s": "f942",
    	"sym-wbtc": "f943",
    	"sym-wet-s": "f944",
    	"sym-wet": "f945",
    	"sym-weth-s": "f946",
    	"sym-weth": "f947",
    	"sym-wib-s": "f948",
    	"sym-wib": "f949",
    	"sym-wicc-s": "f94a",
    	"sym-wicc": "f94b",
    	"sym-win-s": "f94c",
    	"sym-win": "f94d",
    	"sym-wing-s": "f94e",
    	"sym-wing": "f94f",
    	"sym-wings-s": "f950",
    	"sym-wings": "f951",
    	"sym-wnxm-s": "f952",
    	"sym-wnxm": "f953",
    	"sym-woo-s": "f954",
    	"sym-woo": "f955",
    	"sym-wpr-s": "f956",
    	"sym-wpr": "f957",
    	"sym-wrx-s": "f958",
    	"sym-wrx": "f959",
    	"sym-wtc-s": "f95a",
    	"sym-wtc": "f95b",
    	"sym-wtt-s": "f95c",
    	"sym-wtt": "f95d",
    	"sym-wwb-s": "f95e",
    	"sym-wwb": "f95f",
    	"sym-wxt-s": "f960",
    	"sym-wxt": "f961",
    	"sym-xas-s": "f962",
    	"sym-xas": "f963",
    	"sym-xaur-s": "f964",
    	"sym-xaur": "f965",
    	"sym-xaut-s": "f966",
    	"sym-xaut": "f967",
    	"sym-xava-s": "f968",
    	"sym-xava": "f969",
    	"sym-xbc-s": "f96a",
    	"sym-xbc": "f96b",
    	"sym-xcon-s": "f96c",
    	"sym-xcon": "f96d",
    	"sym-xcp-s": "f96e",
    	"sym-xcp": "f96f",
    	"sym-xdn-s": "f970",
    	"sym-xdn": "f971",
    	"sym-xel-s": "f972",
    	"sym-xel": "f973",
    	"sym-xem-s": "f974",
    	"sym-xem": "f975",
    	"sym-xes-s": "f976",
    	"sym-xes": "f977",
    	"sym-xhv-s": "f978",
    	"sym-xhv": "f979",
    	"sym-xin-s": "f97a",
    	"sym-xin": "f97b",
    	"sym-xlm-s": "f97c",
    	"sym-xlm": "f97d",
    	"sym-xmc-s": "f97e",
    	"sym-xmc": "f97f",
    	"sym-xmr-s": "f980",
    	"sym-xmr": "f981",
    	"sym-xmx-s": "f982",
    	"sym-xmx": "f983",
    	"sym-xmy-s": "f984",
    	"sym-xmy": "f985",
    	"sym-xnk-s": "f986",
    	"sym-xnk": "f987",
    	"sym-xns-s": "f988",
    	"sym-xns": "f989",
    	"sym-xor-s": "f98a",
    	"sym-xor": "f98b",
    	"sym-xos-s": "f98c",
    	"sym-xos": "f98d",
    	"sym-xpm-s": "f98e",
    	"sym-xpm": "f98f",
    	"sym-xpr-s": "f990",
    	"sym-xpr": "f991",
    	"sym-xrc-s": "f992",
    	"sym-xrc": "f993",
    	"sym-xrp-s": "f994",
    	"sym-xrp": "f995",
    	"sym-xrpx-s": "f996",
    	"sym-xrpx": "f997",
    	"sym-xrt-s": "f998",
    	"sym-xrt": "f999",
    	"sym-xst-s": "f99a",
    	"sym-xst": "f99b",
    	"sym-xtp-s": "f99c",
    	"sym-xtp": "f99d",
    	"sym-xtz-s": "f99e",
    	"sym-xtz": "f99f",
    	"sym-xtzdown-s": "f9a0",
    	"sym-xtzdown": "f9a1",
    	"sym-xvc-s": "f9a2",
    	"sym-xvc": "f9a3",
    	"sym-xvg-s": "f9a4",
    	"sym-xvg": "f9a5",
    	"sym-xvs-s": "f9a6",
    	"sym-xvs": "f9a7",
    	"sym-xwc-s": "f9a8",
    	"sym-xwc": "f9a9",
    	"sym-xyo-s": "f9aa",
    	"sym-xyo": "f9ab",
    	"sym-xzc-s": "f9ac",
    	"sym-xzc": "f9ad",
    	"sym-yam-s": "f9ae",
    	"sym-yam": "f9af",
    	"sym-yee-s": "f9b0",
    	"sym-yee": "f9b1",
    	"sym-yeed-s": "f9b2",
    	"sym-yeed": "f9b3",
    	"sym-yfi-s": "f9b4",
    	"sym-yfi": "f9b5",
    	"sym-yfii-s": "f9b6",
    	"sym-yfii": "f9b7",
    	"sym-ygg-s": "f9b8",
    	"sym-ygg": "f9b9",
    	"sym-yoyow-s": "f9ba",
    	"sym-yoyow": "f9bb",
    	"sym-zar-s": "f9bc",
    	"sym-zar": "f9bd",
    	"sym-zcl-s": "f9be",
    	"sym-zcl": "f9bf",
    	"sym-zcn-s": "f9c0",
    	"sym-zcn": "f9c1",
    	"sym-zco-s": "f9c2",
    	"sym-zco": "f9c3",
    	"sym-zec-s": "f9c4",
    	"sym-zec": "f9c5",
    	"sym-zen-s": "f9c6",
    	"sym-zen": "f9c7",
    	"sym-zil-s": "f9c8",
    	"sym-zil": "f9c9",
    	"sym-zks-s": "f9ca",
    	"sym-zks": "f9cb",
    	"sym-zla-s": "f9cc",
    	"sym-zla": "f9cd",
    	"sym-zlk": "f9ce",
    	"sym-zondo-s": "f9cf",
    	"sym-zondo": "f9d0",
    	"sym-zpr-s": "f9d1",
    	"sym-zpr": "f9d2",
    	"sym-zpt-s": "f9d3",
    	"sym-zpt": "f9d4",
    	"sym-zrc-s": "f9d5",
    	"sym-zrc": "f9d6",
    	"sym-zrx-s": "f9d7",
    	"sym-zrx": "f9d8",
    	"sym-zsc-s": "f9d9",
    	"sym-zsc": "f9da",
    	"sym-ztg-s": "f9db",
    	"sym-ztg": "f9dc",
    	"cur-anct": "f1d0",
    	"cur-anct-s": "f1cf",
    	"cur-aud": "f1fe",
    	"cur-aud-s": "f1fd",
    	"cur-bnb": "f269",
    	"cur-bnb-s": "f268",
    	"sym-xbt": "f28f",
    	"cur-btc": "f28f",
    	"sym-xbt-s": "f28e",
    	"cur-btc-s": "f28e",
    	"cur-busd": "f2af",
    	"cur-busd-s": "f2ae",
    	"exc-bitz": "f2b3",
    	"cur-bz": "f2b3",
    	"exc-bitz-s": "f2b2",
    	"cur-bz-s": "f2b2",
    	"cur-cad": "f2bd",
    	"cur-cad-s": "f2bc",
    	"cur-chf": "f2dd",
    	"cur-chf-s": "f2dc",
    	"cur-cny": "f301",
    	"cur-cny-s": "f300",
    	"sym-cs": "f315",
    	"sym-cs-s": "f314",
    	"sym-crm": "f32d",
    	"sym-crm-s": "f32c",
    	"cur-dai": "f359",
    	"cur-dai-s": "f358",
    	"sym-xdg": "f397",
    	"sym-xdg-s": "f396",
    	"cur-eos": "f3e0",
    	"cur-eos-s": "f3df",
    	"sym-eth2": "f3f0",
    	"sym-eth2s": "f3f0",
    	"sym-eth2.s": "f3f0",
    	"cur-eth": "f3f0",
    	"sym-eth2-s": "f3ef",
    	"sym-eth2s-s": "f3ef",
    	"sym-eth2.s-s": "f3ef",
    	"cur-eth-s": "f3ef",
    	"cur-eur": "f3f8",
    	"cur-eur-s": "f3f7",
    	"cur-eurs": "f3fa",
    	"cur-eurs-s": "f3f9",
    	"sym-usdt": "f3fc",
    	"cur-usdt": "f3fc",
    	"sym-usdt-s": "f3fb",
    	"cur-usdt-s": "f3fb",
    	"exc-kraken": "f414",
    	"exc-kraken-futures": "f414",
    	"exc-kraken-s": "f413",
    	"exc-kraken-futures-s": "f413",
    	"cur-gbp": "f460",
    	"cur-gbp-s": "f45f",
    	"exc-gemini": "f4a6",
    	"cur-gusd": "f4a6",
    	"exc-gemini-s": "f4a5",
    	"cur-gusd-s": "f4a5",
    	"cur-hkd": "f4ca",
    	"cur-hkd-s": "f4c9",
    	"sym-husd": "f4e4",
    	"exc-huobi": "f4e4",
    	"cur-ht": "f4e4",
    	"sym-husd-s": "f4e3",
    	"exc-huobi-s": "f4e3",
    	"cur-ht-s": "f4e3",
    	"cur-idr": "f502",
    	"cur-idr-s": "f501",
    	"sym-iota": "f52a",
    	"sym-iota-s": "f529",
    	"cur-inr": "f51c",
    	"cur-inr-s": "f51b",
    	"cur-jpy": "f53e",
    	"cur-jpy-s": "f53d",
    	"cur-krw": "f56e",
    	"cur-krw-s": "f56d",
    	"sym-medx": "f5de",
    	"sym-medx-s": "f5dd",
    	"cur-mxn": "f634",
    	"cur-mxn-s": "f633",
    	"cur-myr": "f636",
    	"cur-myr-s": "f635",
    	"cur-ngn": "f660",
    	"cur-ngn-s": "f65f",
    	"cur-pax": "f6d6",
    	"cur-pax-s": "f6d5",
    	"cur-php": "f6ee",
    	"cur-php-s": "f6ed",
    	"cur-pln": "f704",
    	"cur-pln-s": "f703",
    	"cur-qash": "f73a",
    	"cur-qash-s": "f739",
    	"cur-rub": "f7ae",
    	"cur-rur": "f7ae",
    	"cur-rub-s": "f7ad",
    	"cur-rur-s": "f7ad",
    	"sym-steem": "f7c6",
    	"sym-steem-s": "f7c5",
    	"sym-xsc": "f7ca",
    	"sym-xsc-s": "f7c9",
    	"cur-sgd": "f7e6",
    	"cur-sgd-s": "f7e5",
    	"sym-storj": "f7fa",
    	"sym-storj-s": "f7f9",
    	"sym-tel": "f87c",
    	"cur-trx": "f8c3",
    	"cur-trx-s": "f8c2",
    	"cur-tusd": "f8d3",
    	"cur-tusd-s": "f8d2",
    	"cur-usd": "f8f3",
    	"cur-usd-s": "f8f2",
    	"cur-usdc": "f8f5",
    	"cur-usdc-s": "f8f4",
    	"sym-vet": "f911",
    	"sym-vet-s": "f910",
    	"sym-waxp": "f941",
    	"sym-waxp-s": "f940",
    	"cur-xlm": "f97d",
    	"cur-xlm-s": "f97c",
    	"cur-xmr": "f981",
    	"cur-xmr-s": "f980",
    	"cur-xrp": "f995",
    	"cur-xrp-s": "f994",
    	"cur-zar": "f9bd",
    	"cur-zar-s": "f9bc",
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
    	"cur-crc": "f321",
    	"cur-crc-s": "f320",
    	"cur-lak": "f578",
    	"cur-lak-s": "f577",
    	"cur-sek": "f7d6",
    	"cur-sek-s": "f7d5",
    	"cur-thb": "f88b",
    	"cur-thb-s": "f88a",
    	"cur-try": "f8c5",
    	"cur-try-s": "f8c4",
    	"cur-uah": "f8d9",
    	"cur-uah-s": "f8d8",
    	"exc-ftx": "f444",
    	"exc-ftx-s": "f443",
    	"exc-ftx-us": "f444",
    	"exc-ftx-us-s": "f443",
    	"sym-cgld": "f2cd",
    	"sym-cgld-s": "f2cc",
    	"exc-uniswap-v2": "f8eb",
    	"exc-uniswap-v2-s": "f8ea",
    	"sym-kshib": "f7ec",
    	"sym-kshib-s": "f7eb",
    	"sym-easy-s": "f3b4",
    	"sym-srare": "f760",
    	"sym-srare-s": "f75f",
    	"sym-ape.2": "f1d6",
    	"sym-ape.2-s": "f1d5"
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
    var bit = "BitDAO";
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
    var gmt2 = "Green Metaverse Token";
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
    var radar = "";
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
    var real = "Realy";
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
    var strk = "Strike";
    var strong = "Strong";
    var stx = "Stox";
    var sub = "substratum";
    var sun = "SUN";
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
    	bit: bit,
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
    	radar: radar,
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
    	real: real,
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
