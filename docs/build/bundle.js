
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
    	"sym-_default-s": "f161",
    	"sym-_default": "f162",
    	"sym-d": "f162",
    	"sym-d-s": "f161",
    	"sym-default": "f162",
    	"sym-default-s": "f161",
    	"exc-d": "f102",
    	"exc-d-s": "f101",
    	"exc-default": "f102",
    	"exc-default-s": "f101",
    	"cur-default": "f162",
    	"cur-default-s": "f161",
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
    	"exc-coinbasepro-s": "f127",
    	"exc-coinbasepro": "f128",
    	"exc-coinone-s": "f129",
    	"exc-coinone": "f12a",
    	"exc-comex-s": "f12b",
    	"exc-comex": "f12c",
    	"exc-cryptofacilities-s": "f12d",
    	"exc-cryptofacilities": "f12e",
    	"exc-deribit-s": "f12f",
    	"exc-deribit": "f130",
    	"exc-dex-aggregated-s": "f131",
    	"exc-dex-aggregated": "f132",
    	"exc-gateio-s": "f133",
    	"exc-gateio": "f134",
    	"exc-hitbtc-s": "f135",
    	"exc-hitbtc": "f136",
    	"exc-kucoin-s": "f137",
    	"exc-kucoin": "f138",
    	"exc-liquid-s": "f139",
    	"exc-liquid": "f13a",
    	"exc-luno-s": "f13b",
    	"exc-luno": "f13c",
    	"exc-mtgox-s": "f13d",
    	"exc-mtgox": "f13e",
    	"exc-mxc-s": "f13f",
    	"exc-mxc": "f140",
    	"exc-nbatopshop-s": "f141",
    	"exc-nbatopshop": "f142",
    	"exc-nymex-s": "f143",
    	"exc-nymex": "f144",
    	"exc-okcoin-s": "f145",
    	"exc-okcoin": "f146",
    	"exc-okx-s": "f147",
    	"exc-okx": "f148",
    	"exc-opensea-s": "f149",
    	"exc-opensea": "f14a",
    	"exc-poloniex-s": "f14b",
    	"exc-poloniex": "f14c",
    	"exc-qryptos-s": "f14d",
    	"exc-qryptos": "f14e",
    	"exc-quadrigacx-s": "f14f",
    	"exc-quadrigacx": "f150",
    	"exc-quoine-s": "f151",
    	"exc-quoine": "f152",
    	"exc-rarible-s": "f153",
    	"exc-rarible": "f154",
    	"exc-totle-s": "f155",
    	"exc-totle": "f156",
    	"exc-upbit-s": "f157",
    	"exc-upbit": "f158",
    	"exc-vaultofsatoshi-s": "f159",
    	"exc-vaultofsatoshi": "f15a",
    	"exc-wex-s": "f15b",
    	"exc-wex": "f15c",
    	"exc-zaif-s": "f15d",
    	"exc-zaif": "f15e",
    	"exc-zonda-s": "f15f",
    	"exc-zonda": "f160",
    	"sym-1inch-s": "f163",
    	"sym-1inch": "f164",
    	"sym-1st-s": "f165",
    	"sym-1st": "f166",
    	"sym-6a-s": "f167",
    	"sym-6a": "f168",
    	"sym-6b-s": "f169",
    	"sym-6b": "f16a",
    	"sym-6c-s": "f16b",
    	"sym-6c": "f16c",
    	"sym-6e-s": "f16d",
    	"sym-6e": "f16e",
    	"sym-6j-s": "f16f",
    	"sym-6j": "f170",
    	"sym-6l-s": "f171",
    	"sym-6l": "f172",
    	"sym-6m-s": "f173",
    	"sym-6m": "f174",
    	"sym-6n-s": "f175",
    	"sym-6n": "f176",
    	"sym-6s-s": "f177",
    	"sym-6s": "f178",
    	"sym-a38-s": "f179",
    	"sym-a38": "f17a",
    	"sym-aac-s": "f17b",
    	"sym-aac": "f17c",
    	"sym-aave-s": "f17d",
    	"sym-aave": "f17e",
    	"sym-abbc-s": "f17f",
    	"sym-abbc": "f180",
    	"sym-abt-s": "f181",
    	"sym-abt": "f182",
    	"sym-abyss-s": "f183",
    	"sym-abyss": "f184",
    	"sym-aca-s": "f185",
    	"sym-aca": "f186",
    	"sym-acat-s": "f187",
    	"sym-acat": "f188",
    	"sym-ach-s": "f189",
    	"sym-ach": "f18a",
    	"sym-act-s": "f18b",
    	"sym-act": "f18c",
    	"sym-ad0-s": "f18d",
    	"sym-ad0": "f18e",
    	"sym-ada-s": "f18f",
    	"sym-ada": "f190",
    	"sym-adel-s": "f191",
    	"sym-adel": "f192",
    	"sym-adh-s": "f193",
    	"sym-adh": "f194",
    	"sym-adm-s": "f195",
    	"sym-adm": "f196",
    	"sym-ado-s": "f197",
    	"sym-ado": "f198",
    	"sym-adt-s": "f199",
    	"sym-adt": "f19a",
    	"sym-adx-s": "f19b",
    	"sym-adx": "f19c",
    	"sym-ae-s": "f19d",
    	"sym-ae": "f19e",
    	"sym-aed-s": "f19f",
    	"sym-aed": "f1a0",
    	"sym-aeon-s": "f1a1",
    	"sym-aeon": "f1a2",
    	"sym-aep-s": "f1a3",
    	"sym-aep": "f1a4",
    	"sym-aergo-s": "f1a5",
    	"sym-aergo": "f1a6",
    	"sym-agi-s": "f1a7",
    	"sym-agi": "f1a8",
    	"sym-agld-s": "f1a9",
    	"sym-agld": "f1aa",
    	"sym-aid-s": "f1ab",
    	"sym-aid": "f1ac",
    	"sym-aion-s": "f1ad",
    	"sym-aion": "f1ae",
    	"sym-air-s": "f1af",
    	"sym-air": "f1b0",
    	"sym-akro-s": "f1b1",
    	"sym-akro": "f1b2",
    	"sym-akt-s": "f1b3",
    	"sym-akt": "f1b4",
    	"sym-alcx-s": "f1b5",
    	"sym-alcx": "f1b6",
    	"sym-algo-s": "f1b7",
    	"sym-algo": "f1b8",
    	"sym-ali-s": "f1b9",
    	"sym-ali": "f1ba",
    	"sym-alice-s": "f1bb",
    	"sym-alice": "f1bc",
    	"sym-alpha-s": "f1bd",
    	"sym-alpha": "f1be",
    	"sym-amb-s": "f1bf",
    	"sym-amb": "f1c0",
    	"sym-amlt-s": "f1c1",
    	"sym-amlt": "f1c2",
    	"sym-amp-s": "f1c3",
    	"sym-amp": "f1c4",
    	"sym-ampl-s": "f1c5",
    	"sym-ampl": "f1c6",
    	"sym-anct-s": "f1c7",
    	"sym-anct": "f1c8",
    	"sym-ankr-s": "f1c9",
    	"sym-ankr": "f1ca",
    	"sym-ant-s": "f1cb",
    	"sym-ant": "f1cc",
    	"sym-ape-s": "f1cd",
    	"sym-ape": "f1ce",
    	"sym-api3-s": "f1cf",
    	"sym-api3": "f1d0",
    	"sym-apis-s": "f1d1",
    	"sym-apis": "f1d2",
    	"sym-appc-s": "f1d3",
    	"sym-appc": "f1d4",
    	"sym-ar-s": "f1d5",
    	"sym-ar": "f1d6",
    	"sym-ardr-s": "f1d7",
    	"sym-ardr": "f1d8",
    	"sym-ark-s": "f1d9",
    	"sym-ark": "f1da",
    	"sym-arn-s": "f1db",
    	"sym-arn": "f1dc",
    	"sym-arpa-s": "f1dd",
    	"sym-arpa": "f1de",
    	"sym-art-s": "f1df",
    	"sym-art": "f1e0",
    	"sym-aspt-s": "f1e1",
    	"sym-aspt": "f1e2",
    	"sym-ast-s": "f1e3",
    	"sym-ast": "f1e4",
    	"sym-astr-s": "f1e5",
    	"sym-astr": "f1e6",
    	"sym-at-s": "f1e7",
    	"sym-at": "f1e8",
    	"sym-atlas-s": "f1e9",
    	"sym-atlas": "f1ea",
    	"sym-atm-s": "f1eb",
    	"sym-atm": "f1ec",
    	"sym-atom-s": "f1ed",
    	"sym-atom": "f1ee",
    	"sym-atp-s": "f1ef",
    	"sym-atp": "f1f0",
    	"sym-auction-s": "f1f1",
    	"sym-auction": "f1f2",
    	"sym-aud-s": "f1f3",
    	"sym-aud": "f1f4",
    	"sym-audio-s": "f1f5",
    	"sym-audio": "f1f6",
    	"sym-aup-s": "f1f7",
    	"sym-aup": "f1f8",
    	"sym-auto-s": "f1f9",
    	"sym-auto": "f1fa",
    	"sym-ava-s": "f1fb",
    	"sym-ava": "f1fc",
    	"sym-avax-s": "f1fd",
    	"sym-avax": "f1fe",
    	"sym-avt-s": "f1ff",
    	"sym-avt": "f200",
    	"sym-axp-s": "f201",
    	"sym-axp": "f202",
    	"sym-axs-s": "f203",
    	"sym-axs": "f204",
    	"sym-b": "f205",
    	"sym-b0-s": "f206",
    	"sym-b0": "f207",
    	"sym-b2g-s": "f208",
    	"sym-b2g": "f209",
    	"sym-bab-s": "f20a",
    	"sym-bab": "f20b",
    	"sym-badger-s": "f20c",
    	"sym-badger": "f20d",
    	"sym-bake-s": "f20e",
    	"sym-bake": "f20f",
    	"sym-bal-s": "f210",
    	"sym-bal": "f211",
    	"sym-banca-s": "f212",
    	"sym-banca": "f213",
    	"sym-band-s": "f214",
    	"sym-band": "f215",
    	"sym-bat-s": "f216",
    	"sym-bat": "f217",
    	"sym-bay-s": "f218",
    	"sym-bay": "f219",
    	"sym-bbc-s": "f21a",
    	"sym-bbc": "f21b",
    	"sym-bcc-s": "f21c",
    	"sym-bcc": "f21d",
    	"sym-bcd-s": "f21e",
    	"sym-bcd": "f21f",
    	"sym-bch-s": "f220",
    	"sym-bch": "f221",
    	"sym-bci-s": "f222",
    	"sym-bci": "f223",
    	"sym-bcn-s": "f224",
    	"sym-bcn": "f225",
    	"sym-bcpt-s": "f226",
    	"sym-bcpt": "f227",
    	"sym-bcu-s": "f228",
    	"sym-bcu": "f229",
    	"sym-bcv-s": "f22a",
    	"sym-bcv": "f22b",
    	"sym-bcy-s": "f22c",
    	"sym-bcy": "f22d",
    	"sym-bdg-s": "f22e",
    	"sym-bdg": "f22f",
    	"sym-beam-s": "f230",
    	"sym-beam": "f231",
    	"sym-beet-s": "f232",
    	"sym-beet": "f233",
    	"sym-bel-s": "f234",
    	"sym-bel": "f235",
    	"sym-bela-s": "f236",
    	"sym-bela": "f237",
    	"sym-berry-s": "f238",
    	"sym-berry": "f239",
    	"sym-betr-s": "f23a",
    	"sym-betr": "f23b",
    	"sym-bez-s": "f23c",
    	"sym-bez": "f23d",
    	"sym-bft-s": "f23e",
    	"sym-bft": "f23f",
    	"sym-bfx-s": "f240",
    	"sym-bfx": "f241",
    	"sym-bhd-s": "f242",
    	"sym-bhd": "f243",
    	"sym-bht-s": "f244",
    	"sym-bht": "f245",
    	"sym-bico-s": "f246",
    	"sym-bico": "f247",
    	"sym-bitb-s": "f248",
    	"sym-bitb": "f249",
    	"sym-bix-s": "f24a",
    	"sym-bix": "f24b",
    	"sym-bk-s": "f24c",
    	"sym-bk": "f24d",
    	"sym-bkx-s": "f24e",
    	"sym-bkx": "f24f",
    	"sym-blk-s": "f250",
    	"sym-blk": "f251",
    	"sym-block-s": "f252",
    	"sym-block": "f253",
    	"sym-blt-s": "f254",
    	"sym-blt": "f255",
    	"sym-blz-s": "f256",
    	"sym-blz": "f257",
    	"sym-bmc-s": "f258",
    	"sym-bmc": "f259",
    	"sym-bnb-s": "f25a",
    	"sym-bnb": "f25b",
    	"sym-bnc-s": "f25c",
    	"sym-bnc": "f25d",
    	"sym-bnk-s": "f25e",
    	"sym-bnk": "f25f",
    	"sym-bnt-s": "f260",
    	"sym-bnt": "f261",
    	"sym-bo-s": "f262",
    	"sym-bo": "f263",
    	"sym-bond-s": "f264",
    	"sym-bond": "f265",
    	"sym-boo-s": "f266",
    	"sym-boo": "f267",
    	"sym-bor-s": "f268",
    	"sym-bor": "f269",
    	"sym-bora-s": "f26a",
    	"sym-bora": "f26b",
    	"sym-bos-s": "f26c",
    	"sym-bos": "f26d",
    	"sym-box-s": "f26e",
    	"sym-box": "f26f",
    	"sym-brd-s": "f270",
    	"sym-brd": "f271",
    	"sym-brg-s": "f272",
    	"sym-brg": "f273",
    	"sym-brick-s": "f274",
    	"sym-brick": "f275",
    	"sym-bsd-s": "f276",
    	"sym-bsd": "f277",
    	"sym-bsv-s": "f278",
    	"sym-bsv": "f279",
    	"sym-bsx-s": "f27a",
    	"sym-bsx": "f27b",
    	"sym-bt1-s": "f27c",
    	"sym-bt1": "f27d",
    	"sym-bt2-s": "f27e",
    	"sym-bt2": "f27f",
    	"sym-btc-s": "f280",
    	"sym-btc": "f281",
    	"sym-btcd-s": "f282",
    	"sym-btcd": "f283",
    	"sym-btcfx-s": "f284",
    	"sym-btcfx": "f285",
    	"sym-btcp-s": "f286",
    	"sym-btcp": "f287",
    	"sym-btg-s": "f288",
    	"sym-btg": "f289",
    	"sym-btm-s": "f28a",
    	"sym-btm": "f28b",
    	"sym-btn-s": "f28c",
    	"sym-btn": "f28d",
    	"sym-bto-s": "f28e",
    	"sym-bto": "f28f",
    	"sym-bts-s": "f290",
    	"sym-bts": "f291",
    	"sym-btt-s": "f292",
    	"sym-btt": "f293",
    	"sym-btu-s": "f294",
    	"sym-btu": "f295",
    	"sym-btx-s": "f296",
    	"sym-btx": "f297",
    	"sym-burger-s": "f298",
    	"sym-burger": "f299",
    	"sym-burst-s": "f29a",
    	"sym-burst": "f29b",
    	"sym-bus-s": "f29c",
    	"sym-bus": "f29d",
    	"sym-busd-s": "f29e",
    	"sym-busd": "f29f",
    	"sym-bwx-s": "f2a0",
    	"sym-bwx": "f2a1",
    	"sym-bz-s": "f2a2",
    	"sym-bz": "f2a3",
    	"sym-bzrx-s": "f2a4",
    	"sym-bzrx": "f2a5",
    	"sym-c-s": "f2a6",
    	"sym-c": "f2a7",
    	"sym-c20-s": "f2a8",
    	"sym-c20": "f2a9",
    	"sym-c98-s": "f2aa",
    	"sym-c98": "f2ab",
    	"sym-cad-s": "f2ac",
    	"sym-cad": "f2ad",
    	"sym-cake-s": "f2ae",
    	"sym-cake": "f2af",
    	"sym-cas-s": "f2b0",
    	"sym-cas": "f2b1",
    	"sym-cat-s": "f2b2",
    	"sym-cat": "f2b3",
    	"sym-cbc-s": "f2b4",
    	"sym-cbc": "f2b5",
    	"sym-cbt-s": "f2b6",
    	"sym-cbt": "f2b7",
    	"sym-cdt-s": "f2b8",
    	"sym-cdt": "f2b9",
    	"sym-cel-s": "f2ba",
    	"sym-cel": "f2bb",
    	"sym-celo-s": "f2bc",
    	"sym-celo": "f2bd",
    	"sym-celr-s": "f2be",
    	"sym-celr": "f2bf",
    	"sym-cennz-s": "f2c0",
    	"sym-cennz": "f2c1",
    	"sym-cfg-s": "f2c2",
    	"sym-cfg": "f2c3",
    	"sym-cfi-s": "f2c4",
    	"sym-cfi": "f2c5",
    	"sym-cfx-s": "f2c6",
    	"sym-cfx": "f2c7",
    	"sym-cgt-s": "f2c8",
    	"sym-cgt": "f2c9",
    	"sym-chat-s": "f2ca",
    	"sym-chat": "f2cb",
    	"sym-chf-s": "f2cc",
    	"sym-chf": "f2cd",
    	"sym-chp-s": "f2ce",
    	"sym-chp": "f2cf",
    	"sym-chr-s": "f2d0",
    	"sym-chr": "f2d1",
    	"sym-chsb-s": "f2d2",
    	"sym-chsb": "f2d3",
    	"sym-chx-s": "f2d4",
    	"sym-chx": "f2d5",
    	"sym-chz-s": "f2d6",
    	"sym-chz": "f2d7",
    	"sym-ckb-s": "f2d8",
    	"sym-ckb": "f2d9",
    	"sym-cl-s": "f2da",
    	"sym-cl": "f2db",
    	"sym-clam-s": "f2dc",
    	"sym-clam": "f2dd",
    	"sym-cln-s": "f2de",
    	"sym-cln": "f2df",
    	"sym-clo-s": "f2e0",
    	"sym-clo": "f2e1",
    	"sym-cloak-s": "f2e2",
    	"sym-cloak": "f2e3",
    	"sym-clv-s": "f2e4",
    	"sym-clv": "f2e5",
    	"sym-cmct-s": "f2e6",
    	"sym-cmct": "f2e7",
    	"sym-cmt-s": "f2e8",
    	"sym-cmt": "f2e9",
    	"sym-cnd-s": "f2ea",
    	"sym-cnd": "f2eb",
    	"sym-cnn-s": "f2ec",
    	"sym-cnn": "f2ed",
    	"sym-cnx-s": "f2ee",
    	"sym-cnx": "f2ef",
    	"sym-cny-s": "f2f0",
    	"sym-cny": "f2f1",
    	"sym-cob-s": "f2f2",
    	"sym-cob": "f2f3",
    	"sym-cocos-s": "f2f4",
    	"sym-cocos": "f2f5",
    	"sym-comp-s": "f2f6",
    	"sym-comp": "f2f7",
    	"sym-cope-s": "f2f8",
    	"sym-cope": "f2f9",
    	"sym-cos-s": "f2fa",
    	"sym-cos": "f2fb",
    	"sym-cosm-s": "f2fc",
    	"sym-cosm": "f2fd",
    	"sym-coss-s": "f2fe",
    	"sym-coss": "f2ff",
    	"sym-coti-s": "f300",
    	"sym-coti": "f301",
    	"sym-cov-s": "f302",
    	"sym-cov": "f303",
    	"sym-cova-s": "f304",
    	"sym-cova": "f305",
    	"sym-cpt-s": "f306",
    	"sym-cpt": "f307",
    	"sym-cpx-s": "f308",
    	"sym-cpx": "f309",
    	"sym-cqt-s": "f30a",
    	"sym-cqt": "f30b",
    	"sym-crc-s": "f30c",
    	"sym-crc": "f30d",
    	"sym-cre-s": "f30e",
    	"sym-cre": "f30f",
    	"sym-cream-s": "f310",
    	"sym-cream": "f311",
    	"sym-cring-s": "f312",
    	"sym-cring": "f313",
    	"sym-cro-s": "f314",
    	"sym-cro": "f315",
    	"sym-crpt-s": "f316",
    	"sym-crpt": "f317",
    	"sym-cru-s": "f318",
    	"sym-cru": "f319",
    	"sym-crv-s": "f31a",
    	"sym-crv": "f31b",
    	"sym-crw-s": "f31c",
    	"sym-crw": "f31d",
    	"sym-csm-s": "f31e",
    	"sym-csm": "f31f",
    	"sym-csx-s": "f320",
    	"sym-csx": "f321",
    	"sym-ctc-s": "f322",
    	"sym-ctc": "f323",
    	"sym-ctk-s": "f324",
    	"sym-ctk": "f325",
    	"sym-ctsi-s": "f326",
    	"sym-ctsi": "f327",
    	"sym-ctxc-s": "f328",
    	"sym-ctxc": "f329",
    	"sym-cur-s": "f32a",
    	"sym-cur": "f32b",
    	"sym-cvc-s": "f32c",
    	"sym-cvc": "f32d",
    	"sym-cvcoin-s": "f32e",
    	"sym-cvcoin": "f32f",
    	"sym-cvnt-s": "f330",
    	"sym-cvnt": "f331",
    	"sym-cvp-s": "f332",
    	"sym-cvp": "f333",
    	"sym-cvt-s": "f334",
    	"sym-cvt": "f335",
    	"sym-cvx-s": "f336",
    	"sym-cvx": "f337",
    	"sym-cw-s": "f338",
    	"sym-cw": "f339",
    	"sym-cyc-s": "f33a",
    	"sym-cyc": "f33b",
    	"sym-dac-s": "f33c",
    	"sym-dac": "f33d",
    	"sym-dacs-s": "f33e",
    	"sym-dacs": "f33f",
    	"sym-dadi-s": "f340",
    	"sym-dadi": "f341",
    	"sym-dag-s": "f342",
    	"sym-dag": "f343",
    	"sym-dai-s": "f344",
    	"sym-dai": "f345",
    	"sym-dao-s": "f346",
    	"sym-dao": "f347",
    	"sym-dash-s": "f348",
    	"sym-dash": "f349",
    	"sym-dat-s": "f34a",
    	"sym-dat": "f34b",
    	"sym-data-s": "f34c",
    	"sym-data": "f34d",
    	"sym-datx-s": "f34e",
    	"sym-datx": "f34f",
    	"sym-dbc-s": "f350",
    	"sym-dbc": "f351",
    	"sym-dbet-s": "f352",
    	"sym-dbet": "f353",
    	"sym-dbix-s": "f354",
    	"sym-dbix": "f355",
    	"sym-dcn-s": "f356",
    	"sym-dcn": "f357",
    	"sym-dcr-s": "f358",
    	"sym-dcr": "f359",
    	"sym-dct-s": "f35a",
    	"sym-dct": "f35b",
    	"sym-ddd-s": "f35c",
    	"sym-ddd": "f35d",
    	"sym-dego-s": "f35e",
    	"sym-dego": "f35f",
    	"sym-dent-s": "f360",
    	"sym-dent": "f361",
    	"sym-dgb-s": "f362",
    	"sym-dgb": "f363",
    	"sym-dgd-s": "f364",
    	"sym-dgd": "f365",
    	"sym-dgtx-s": "f366",
    	"sym-dgtx": "f367",
    	"sym-dgx-s": "f368",
    	"sym-dgx": "f369",
    	"sym-dhx-s": "f36a",
    	"sym-dhx": "f36b",
    	"sym-dia-s": "f36c",
    	"sym-dia": "f36d",
    	"sym-dice-s": "f36e",
    	"sym-dice": "f36f",
    	"sym-dim-s": "f370",
    	"sym-dim": "f371",
    	"sym-dlt-s": "f372",
    	"sym-dlt": "f373",
    	"sym-dmd-s": "f374",
    	"sym-dmd": "f375",
    	"sym-dmt-s": "f376",
    	"sym-dmt": "f377",
    	"sym-dnt-s": "f378",
    	"sym-dnt": "f379",
    	"sym-dock-s": "f37a",
    	"sym-dock": "f37b",
    	"sym-dodo-s": "f37c",
    	"sym-dodo": "f37d",
    	"sym-doge-s": "f37e",
    	"sym-doge": "f37f",
    	"sym-dot-s": "f380",
    	"sym-dot": "f381",
    	"sym-dpy-s": "f382",
    	"sym-dpy": "f383",
    	"sym-dream-s": "f384",
    	"sym-dream": "f385",
    	"sym-drep-s": "f386",
    	"sym-drep": "f387",
    	"sym-drg-s": "f388",
    	"sym-drg": "f389",
    	"sym-drgn-s": "f38a",
    	"sym-drgn": "f38b",
    	"sym-drt-s": "f38c",
    	"sym-drt": "f38d",
    	"sym-dta-s": "f38e",
    	"sym-dta": "f38f",
    	"sym-dtb-s": "f390",
    	"sym-dtb": "f391",
    	"sym-dtr-s": "f392",
    	"sym-dtr": "f393",
    	"sym-dusk-s": "f394",
    	"sym-dusk": "f395",
    	"sym-dx-s": "f396",
    	"sym-dx": "f397",
    	"sym-dydx-s": "f398",
    	"sym-dydx": "f399",
    	"sym-dyn-s": "f39a",
    	"sym-dyn": "f39b",
    	"sym-easy": "f39c",
    	"sym-ecom-s": "f39d",
    	"sym-ecom": "f39e",
    	"sym-edc-s": "f39f",
    	"sym-edc": "f3a0",
    	"sym-edg-s": "f3a1",
    	"sym-edg": "f3a2",
    	"sym-edo-s": "f3a3",
    	"sym-edo": "f3a4",
    	"sym-edp-s": "f3a5",
    	"sym-edp": "f3a6",
    	"sym-edr-s": "f3a7",
    	"sym-edr": "f3a8",
    	"sym-efi-s": "f3a9",
    	"sym-efi": "f3aa",
    	"sym-egld-s": "f3ab",
    	"sym-egld": "f3ac",
    	"sym-egt-s": "f3ad",
    	"sym-egt": "f3ae",
    	"sym-ehr-s": "f3af",
    	"sym-ehr": "f3b0",
    	"sym-eko-s": "f3b1",
    	"sym-eko": "f3b2",
    	"sym-ekt-s": "f3b3",
    	"sym-ekt": "f3b4",
    	"sym-ela-s": "f3b5",
    	"sym-ela": "f3b6",
    	"sym-elec-s": "f3b7",
    	"sym-elec": "f3b8",
    	"sym-elf-s": "f3b9",
    	"sym-elf": "f3ba",
    	"sym-em-s": "f3bb",
    	"sym-em": "f3bc",
    	"sym-emc-s": "f3bd",
    	"sym-emc": "f3be",
    	"sym-emc2-s": "f3bf",
    	"sym-emc2": "f3c0",
    	"sym-eng-s": "f3c1",
    	"sym-eng": "f3c2",
    	"sym-enj-s": "f3c3",
    	"sym-enj": "f3c4",
    	"sym-ens-s": "f3c5",
    	"sym-ens": "f3c6",
    	"sym-eos-s": "f3c7",
    	"sym-eos": "f3c8",
    	"sym-eosdac-s": "f3c9",
    	"sym-eosdac": "f3ca",
    	"sym-eq-s": "f3cb",
    	"sym-eq": "f3cc",
    	"sym-erd-s": "f3cd",
    	"sym-erd": "f3ce",
    	"sym-ern-s": "f3cf",
    	"sym-ern": "f3d0",
    	"sym-es": "f3d1",
    	"sym-es-s": "f3d2",
    	"sym-esd-s": "f3d3",
    	"sym-esd": "f3d4",
    	"sym-etc-s": "f3d5",
    	"sym-etc": "f3d6",
    	"sym-eth-s": "f3d7",
    	"sym-eth": "f3d8",
    	"sym-ethup-s": "f3d9",
    	"sym-ethup": "f3da",
    	"sym-etn-s": "f3db",
    	"sym-etn": "f3dc",
    	"sym-etp-s": "f3dd",
    	"sym-etp": "f3de",
    	"sym-eur-s": "f3df",
    	"sym-eur": "f3e0",
    	"sym-eurs-s": "f3e1",
    	"sym-eurs": "f3e2",
    	"sym-eurt-s": "f3e3",
    	"sym-eurt": "f3e4",
    	"sym-evn-s": "f3e5",
    	"sym-evn": "f3e6",
    	"sym-evx-s": "f3e7",
    	"sym-evx": "f3e8",
    	"sym-ewt-s": "f3e9",
    	"sym-ewt": "f3ea",
    	"sym-exp-s": "f3eb",
    	"sym-exp": "f3ec",
    	"sym-exrd-s": "f3ed",
    	"sym-exrd": "f3ee",
    	"sym-exy-s": "f3ef",
    	"sym-exy": "f3f0",
    	"sym-ez-s": "f3f1",
    	"sym-ez": "f3f2",
    	"sym-fair-s": "f3f3",
    	"sym-fair": "f3f4",
    	"sym-fct-s": "f3f5",
    	"sym-fct": "f3f6",
    	"sym-fdz-s": "f3f7",
    	"sym-fdz": "f3f8",
    	"sym-fee-s": "f3f9",
    	"sym-fee": "f3fa",
    	"sym-fet-s": "f3fb",
    	"sym-fet": "f3fc",
    	"sym-fida-s": "f3fd",
    	"sym-fida": "f3fe",
    	"sym-fil-s": "f3ff",
    	"sym-fil": "f400",
    	"sym-fio-s": "f401",
    	"sym-fio": "f402",
    	"sym-firo-s": "f403",
    	"sym-firo": "f404",
    	"sym-fis-s": "f405",
    	"sym-fis": "f406",
    	"sym-fldc-s": "f407",
    	"sym-fldc": "f408",
    	"sym-flo-s": "f409",
    	"sym-flo": "f40a",
    	"sym-floki-s": "f40b",
    	"sym-floki": "f40c",
    	"sym-flow-s": "f40d",
    	"sym-flow": "f40e",
    	"sym-flr-s": "f40f",
    	"sym-flr": "f410",
    	"sym-fluz-s": "f411",
    	"sym-fluz": "f412",
    	"sym-fnb-s": "f413",
    	"sym-fnb": "f414",
    	"sym-foam-s": "f415",
    	"sym-foam": "f416",
    	"sym-for-s": "f417",
    	"sym-for": "f418",
    	"sym-fota-s": "f419",
    	"sym-fota": "f41a",
    	"sym-frax-s": "f41b",
    	"sym-frax": "f41c",
    	"sym-front-s": "f41d",
    	"sym-front": "f41e",
    	"sym-fsn-s": "f41f",
    	"sym-fsn": "f420",
    	"sym-ftc-s": "f421",
    	"sym-ftc": "f422",
    	"sym-fti-s": "f423",
    	"sym-fti": "f424",
    	"sym-ftm-s": "f425",
    	"sym-ftm": "f426",
    	"sym-ftt-s": "f427",
    	"sym-ftt": "f428",
    	"sym-ftx-s": "f429",
    	"sym-ftx": "f42a",
    	"sym-fuel-s": "f42b",
    	"sym-fuel": "f42c",
    	"sym-fun-s": "f42d",
    	"sym-fun": "f42e",
    	"sym-fx-s": "f42f",
    	"sym-fx": "f430",
    	"sym-fxc-s": "f431",
    	"sym-fxc": "f432",
    	"sym-fxs-s": "f433",
    	"sym-fxs": "f434",
    	"sym-fxt-s": "f435",
    	"sym-fxt": "f436",
    	"sym-gala-s": "f437",
    	"sym-gala": "f438",
    	"sym-game-s": "f439",
    	"sym-game": "f43a",
    	"sym-gard-s": "f43b",
    	"sym-gard": "f43c",
    	"sym-gari-s": "f43d",
    	"sym-gari": "f43e",
    	"sym-gas-s": "f43f",
    	"sym-gas": "f440",
    	"sym-gbc-s": "f441",
    	"sym-gbc": "f442",
    	"sym-gbp-s": "f443",
    	"sym-gbp": "f444",
    	"sym-gbx-s": "f445",
    	"sym-gbx": "f446",
    	"sym-gbyte-s": "f447",
    	"sym-gbyte": "f448",
    	"sym-gc-s": "f449",
    	"sym-gc": "f44a",
    	"sym-gcc-s": "f44b",
    	"sym-gcc": "f44c",
    	"sym-ge-s": "f44d",
    	"sym-ge": "f44e",
    	"sym-geist-s": "f44f",
    	"sym-geist": "f450",
    	"sym-gen-s": "f451",
    	"sym-gen": "f452",
    	"sym-gens-s": "f453",
    	"sym-gens": "f454",
    	"sym-get-s": "f455",
    	"sym-get": "f456",
    	"sym-ghst-s": "f457",
    	"sym-ghst": "f458",
    	"sym-glc-s": "f459",
    	"sym-glc": "f45a",
    	"sym-gld-s": "f45b",
    	"sym-gld": "f45c",
    	"sym-glm-s": "f45d",
    	"sym-glm": "f45e",
    	"sym-glmr-s": "f45f",
    	"sym-glmr": "f460",
    	"sym-gmat-s": "f461",
    	"sym-gmat": "f462",
    	"sym-gno-s": "f463",
    	"sym-gno": "f464",
    	"sym-gnt-s": "f465",
    	"sym-gnt": "f466",
    	"sym-gnx-s": "f467",
    	"sym-gnx": "f468",
    	"sym-go-s": "f469",
    	"sym-go": "f46a",
    	"sym-got-s": "f46b",
    	"sym-got": "f46c",
    	"sym-grc-s": "f46d",
    	"sym-grc": "f46e",
    	"sym-grin-s": "f46f",
    	"sym-grin": "f470",
    	"sym-grs-s": "f471",
    	"sym-grs": "f472",
    	"sym-grt-s": "f473",
    	"sym-grt": "f474",
    	"sym-gsc-s": "f475",
    	"sym-gsc": "f476",
    	"sym-gt-s": "f477",
    	"sym-gt": "f478",
    	"sym-gtc-s": "f479",
    	"sym-gtc": "f47a",
    	"sym-gto-s": "f47b",
    	"sym-gto": "f47c",
    	"sym-gup-s": "f47d",
    	"sym-gup": "f47e",
    	"sym-gusd-s": "f47f",
    	"sym-gusd": "f480",
    	"sym-gvt-s": "f481",
    	"sym-gvt": "f482",
    	"sym-gxc-s": "f483",
    	"sym-gxc": "f484",
    	"sym-gxs-s": "f485",
    	"sym-gxs": "f486",
    	"sym-hard-s": "f487",
    	"sym-hard": "f488",
    	"sym-hbar-s": "f489",
    	"sym-hbar": "f48a",
    	"sym-hc-s": "f48b",
    	"sym-hc": "f48c",
    	"sym-hdx-s": "f48d",
    	"sym-hdx": "f48e",
    	"sym-hedg-s": "f48f",
    	"sym-hedg": "f490",
    	"sym-hex-s": "f491",
    	"sym-hex": "f492",
    	"sym-hft-s": "f493",
    	"sym-hft": "f494",
    	"sym-hg-s": "f495",
    	"sym-hg": "f496",
    	"sym-hgs-s": "f497",
    	"sym-hgs": "f498",
    	"sym-hh-s": "f499",
    	"sym-hh": "f49a",
    	"sym-hit-s": "f49b",
    	"sym-hit": "f49c",
    	"sym-hive-s": "f49d",
    	"sym-hive": "f49e",
    	"sym-hkd-s": "f49f",
    	"sym-hkd": "f4a0",
    	"sym-hmq-s": "f4a1",
    	"sym-hmq": "f4a2",
    	"sym-hns-s": "f4a3",
    	"sym-hns": "f4a4",
    	"sym-ho-s": "f4a5",
    	"sym-ho": "f4a6",
    	"sym-hot-s": "f4a7",
    	"sym-hot": "f4a8",
    	"sym-hp-s": "f4a9",
    	"sym-hp": "f4aa",
    	"sym-hpb-s": "f4ab",
    	"sym-hpb": "f4ac",
    	"sym-hpc-s": "f4ad",
    	"sym-hpc": "f4ae",
    	"sym-hpt-s": "f4af",
    	"sym-hpt": "f4b0",
    	"sym-hrc-s": "f4b1",
    	"sym-hrc": "f4b2",
    	"sym-hsc-s": "f4b3",
    	"sym-hsc": "f4b4",
    	"sym-hsr-s": "f4b5",
    	"sym-hsr": "f4b6",
    	"sym-hst-s": "f4b7",
    	"sym-hst": "f4b8",
    	"sym-ht-s": "f4b9",
    	"sym-ht": "f4ba",
    	"sym-html-s": "f4bb",
    	"sym-html": "f4bc",
    	"sym-htt-s": "f4bd",
    	"sym-htt": "f4be",
    	"sym-huc-s": "f4bf",
    	"sym-huc": "f4c0",
    	"sym-hvn-s": "f4c1",
    	"sym-hvn": "f4c2",
    	"sym-hxro-s": "f4c3",
    	"sym-hxro": "f4c4",
    	"sym-hyc-s": "f4c5",
    	"sym-hyc": "f4c6",
    	"sym-hydra-s": "f4c7",
    	"sym-hydra": "f4c8",
    	"sym-hydro-s": "f4c9",
    	"sym-hydro": "f4ca",
    	"sym-icn-s": "f4cb",
    	"sym-icn": "f4cc",
    	"sym-icos-s": "f4cd",
    	"sym-icos": "f4ce",
    	"sym-icp-s": "f4cf",
    	"sym-icp": "f4d0",
    	"sym-icx-s": "f4d1",
    	"sym-icx": "f4d2",
    	"sym-idex-s": "f4d3",
    	"sym-idex": "f4d4",
    	"sym-idh-s": "f4d5",
    	"sym-idh": "f4d6",
    	"sym-idr-s": "f4d7",
    	"sym-idr": "f4d8",
    	"sym-ift-s": "f4d9",
    	"sym-ift": "f4da",
    	"sym-ignis-s": "f4db",
    	"sym-ignis": "f4dc",
    	"sym-ihf-s": "f4dd",
    	"sym-ihf": "f4de",
    	"sym-iht-s": "f4df",
    	"sym-iht": "f4e0",
    	"sym-ilc-s": "f4e1",
    	"sym-ilc": "f4e2",
    	"sym-ilv-s": "f4e3",
    	"sym-ilv": "f4e4",
    	"sym-imx-s": "f4e5",
    	"sym-imx": "f4e6",
    	"sym-incnt-s": "f4e7",
    	"sym-incnt": "f4e8",
    	"sym-ind-s": "f4e9",
    	"sym-ind": "f4ea",
    	"sym-inj-s": "f4eb",
    	"sym-inj": "f4ec",
    	"sym-ink-s": "f4ed",
    	"sym-ink": "f4ee",
    	"sym-inr-s": "f4ef",
    	"sym-inr": "f4f0",
    	"sym-ins-s": "f4f1",
    	"sym-ins": "f4f2",
    	"sym-int-s": "f4f3",
    	"sym-int": "f4f4",
    	"sym-intr-s": "f4f5",
    	"sym-intr": "f4f6",
    	"sym-ioc-s": "f4f7",
    	"sym-ioc": "f4f8",
    	"sym-ion-s": "f4f9",
    	"sym-ion": "f4fa",
    	"sym-iost-s": "f4fb",
    	"sym-iost": "f4fc",
    	"sym-iot-s": "f4fd",
    	"sym-iot": "f4fe",
    	"sym-iotx-s": "f4ff",
    	"sym-iotx": "f500",
    	"sym-iq-s": "f501",
    	"sym-iq": "f502",
    	"sym-iris-s": "f503",
    	"sym-iris": "f504",
    	"sym-itc-s": "f505",
    	"sym-itc": "f506",
    	"sym-ivy-s": "f507",
    	"sym-ivy": "f508",
    	"sym-ixt-s": "f509",
    	"sym-ixt": "f50a",
    	"sym-jasmy-s": "f50b",
    	"sym-jasmy": "f50c",
    	"sym-jnt-s": "f50d",
    	"sym-jnt": "f50e",
    	"sym-joe-s": "f50f",
    	"sym-joe": "f510",
    	"sym-jpy-s": "f511",
    	"sym-jpy": "f512",
    	"sym-jst-s": "f513",
    	"sym-jst": "f514",
    	"sym-juv-s": "f515",
    	"sym-juv": "f516",
    	"sym-kan-s": "f517",
    	"sym-kan": "f518",
    	"sym-kar-s": "f519",
    	"sym-kar": "f51a",
    	"sym-kava-s": "f51b",
    	"sym-kava": "f51c",
    	"sym-kbc-s": "f51d",
    	"sym-kbc": "f51e",
    	"sym-kcash-s": "f51f",
    	"sym-kcash": "f520",
    	"sym-keep-s": "f521",
    	"sym-keep": "f522",
    	"sym-key-s": "f523",
    	"sym-key": "f524",
    	"sym-kick-s": "f525",
    	"sym-kick": "f526",
    	"sym-kilt-s": "f527",
    	"sym-kilt": "f528",
    	"sym-kin-s": "f529",
    	"sym-kin": "f52a",
    	"sym-kint-s": "f52b",
    	"sym-kint": "f52c",
    	"sym-kma-s": "f52d",
    	"sym-kma": "f52e",
    	"sym-kmd-s": "f52f",
    	"sym-kmd": "f530",
    	"sym-knc-s": "f531",
    	"sym-knc": "f532",
    	"sym-kore-s": "f533",
    	"sym-kore": "f534",
    	"sym-kp3r-s": "f535",
    	"sym-kp3r": "f536",
    	"sym-krm-s": "f537",
    	"sym-krm": "f538",
    	"sym-krw-s": "f539",
    	"sym-krw": "f53a",
    	"sym-ksm-s": "f53b",
    	"sym-ksm": "f53c",
    	"sym-ksx-s": "f53d",
    	"sym-ksx": "f53e",
    	"sym-kyl-s": "f53f",
    	"sym-kyl": "f540",
    	"sym-la-s": "f541",
    	"sym-la": "f542",
    	"sym-lak-s": "f543",
    	"sym-lak": "f544",
    	"sym-lamb-s": "f545",
    	"sym-lamb": "f546",
    	"sym-latx-s": "f547",
    	"sym-latx": "f548",
    	"sym-layr-s": "f549",
    	"sym-layr": "f54a",
    	"sym-lba-s": "f54b",
    	"sym-lba": "f54c",
    	"sym-lbc-s": "f54d",
    	"sym-lbc": "f54e",
    	"sym-lcc-s": "f54f",
    	"sym-lcc": "f550",
    	"sym-ldo-s": "f551",
    	"sym-ldo": "f552",
    	"sym-lend-s": "f553",
    	"sym-lend": "f554",
    	"sym-leo-s": "f555",
    	"sym-leo": "f556",
    	"sym-leoc-s": "f557",
    	"sym-leoc": "f558",
    	"sym-let-s": "f559",
    	"sym-let": "f55a",
    	"sym-life-s": "f55b",
    	"sym-life": "f55c",
    	"sym-link-s": "f55d",
    	"sym-link": "f55e",
    	"sym-lit-s": "f55f",
    	"sym-lit": "f560",
    	"sym-lmc-s": "f561",
    	"sym-lmc": "f562",
    	"sym-lml-s": "f563",
    	"sym-lml": "f564",
    	"sym-lnc-s": "f565",
    	"sym-lnc": "f566",
    	"sym-lnd-s": "f567",
    	"sym-lnd": "f568",
    	"sym-loc-s": "f569",
    	"sym-loc": "f56a",
    	"sym-looks-s": "f56b",
    	"sym-looks": "f56c",
    	"sym-loom-s": "f56d",
    	"sym-loom": "f56e",
    	"sym-lpt-s": "f56f",
    	"sym-lpt": "f570",
    	"sym-lrc-s": "f571",
    	"sym-lrc": "f572",
    	"sym-lrn-s": "f573",
    	"sym-lrn": "f574",
    	"sym-lsk-s": "f575",
    	"sym-lsk": "f576",
    	"sym-ltc-s": "f577",
    	"sym-ltc": "f578",
    	"sym-lto-s": "f579",
    	"sym-lto": "f57a",
    	"sym-lun-s": "f57b",
    	"sym-lun": "f57c",
    	"sym-luna-s": "f57d",
    	"sym-luna": "f57e",
    	"sym-lxt-s": "f57f",
    	"sym-lxt": "f580",
    	"sym-lym-s": "f581",
    	"sym-lym": "f582",
    	"sym-m2k-s": "f583",
    	"sym-m2k": "f584",
    	"sym-ma-s": "f585",
    	"sym-ma": "f586",
    	"sym-maid-s": "f587",
    	"sym-maid": "f588",
    	"sym-man-s": "f589",
    	"sym-man": "f58a",
    	"sym-mana-s": "f58b",
    	"sym-mana": "f58c",
    	"sym-mask-s": "f58d",
    	"sym-mask": "f58e",
    	"sym-mass-s": "f58f",
    	"sym-mass": "f590",
    	"sym-matic-s": "f591",
    	"sym-matic": "f592",
    	"sym-mbl-s": "f593",
    	"sym-mbl": "f594",
    	"sym-mbt-s": "f595",
    	"sym-mbt": "f596",
    	"sym-mc-s": "f597",
    	"sym-mc": "f598",
    	"sym-mco-s": "f599",
    	"sym-mco": "f59a",
    	"sym-mda-s": "f59b",
    	"sym-mda": "f59c",
    	"sym-mds-s": "f59d",
    	"sym-mds": "f59e",
    	"sym-mdt-s": "f59f",
    	"sym-mdt": "f5a0",
    	"sym-mdx-s": "f5a1",
    	"sym-mdx": "f5a2",
    	"sym-med-s": "f5a3",
    	"sym-med": "f5a4",
    	"sym-mer-s": "f5a5",
    	"sym-mer": "f5a6",
    	"sym-mes-s": "f5a7",
    	"sym-mes": "f5a8",
    	"sym-met-s": "f5a9",
    	"sym-met": "f5aa",
    	"sym-meta-s": "f5ab",
    	"sym-meta": "f5ac",
    	"sym-mft-s": "f5ad",
    	"sym-mft": "f5ae",
    	"sym-mgc-s": "f5af",
    	"sym-mgc": "f5b0",
    	"sym-mgo-s": "f5b1",
    	"sym-mgo": "f5b2",
    	"sym-mhc-s": "f5b3",
    	"sym-mhc": "f5b4",
    	"sym-mina-s": "f5b5",
    	"sym-mina": "f5b6",
    	"sym-mir-s": "f5b7",
    	"sym-mir": "f5b8",
    	"sym-mith-s": "f5b9",
    	"sym-mith": "f5ba",
    	"sym-mitx-s": "f5bb",
    	"sym-mitx": "f5bc",
    	"sym-mjp-s": "f5bd",
    	"sym-mjp": "f5be",
    	"sym-mkr-s": "f5bf",
    	"sym-mkr": "f5c0",
    	"sym-mln-s": "f5c1",
    	"sym-mln": "f5c2",
    	"sym-mngo-s": "f5c3",
    	"sym-mngo": "f5c4",
    	"sym-mnx-s": "f5c5",
    	"sym-mnx": "f5c6",
    	"sym-moac-s": "f5c7",
    	"sym-moac": "f5c8",
    	"sym-mob-s": "f5c9",
    	"sym-mob": "f5ca",
    	"sym-mobi-s": "f5cb",
    	"sym-mobi": "f5cc",
    	"sym-moc-s": "f5cd",
    	"sym-moc": "f5ce",
    	"sym-mod-s": "f5cf",
    	"sym-mod": "f5d0",
    	"sym-mona-s": "f5d1",
    	"sym-mona": "f5d2",
    	"sym-moon-s": "f5d3",
    	"sym-moon": "f5d4",
    	"sym-morph-s": "f5d5",
    	"sym-morph": "f5d6",
    	"sym-movr-s": "f5d7",
    	"sym-movr": "f5d8",
    	"sym-mrk-s": "f5d9",
    	"sym-mrk": "f5da",
    	"sym-msp-s": "f5db",
    	"sym-msp": "f5dc",
    	"sym-mta-s": "f5dd",
    	"sym-mta": "f5de",
    	"sym-mtc-s": "f5df",
    	"sym-mtc": "f5e0",
    	"sym-mth-s": "f5e1",
    	"sym-mth": "f5e2",
    	"sym-mtl-s": "f5e3",
    	"sym-mtl": "f5e4",
    	"sym-mtn-s": "f5e5",
    	"sym-mtn": "f5e6",
    	"sym-mtx-s": "f5e7",
    	"sym-mtx": "f5e8",
    	"sym-mue-s": "f5e9",
    	"sym-mue": "f5ea",
    	"sym-multi-s": "f5eb",
    	"sym-multi": "f5ec",
    	"sym-mx-s": "f5ed",
    	"sym-mx": "f5ee",
    	"sym-mxc-s": "f5ef",
    	"sym-mxc": "f5f0",
    	"sym-mxm-s": "f5f1",
    	"sym-mxm": "f5f2",
    	"sym-mxn-s": "f5f3",
    	"sym-mxn": "f5f4",
    	"sym-myr-s": "f5f5",
    	"sym-myr": "f5f6",
    	"sym-n9l-s": "f5f7",
    	"sym-n9l": "f5f8",
    	"sym-nanj-s": "f5f9",
    	"sym-nanj": "f5fa",
    	"sym-nano-s": "f5fb",
    	"sym-nano": "f5fc",
    	"sym-nas-s": "f5fd",
    	"sym-nas": "f5fe",
    	"sym-naut-s": "f5ff",
    	"sym-naut": "f600",
    	"sym-nav-s": "f601",
    	"sym-nav": "f602",
    	"sym-ncash-s": "f603",
    	"sym-ncash": "f604",
    	"sym-nct-s": "f605",
    	"sym-nct": "f606",
    	"sym-near-s": "f607",
    	"sym-near": "f608",
    	"sym-nebl-s": "f609",
    	"sym-nebl": "f60a",
    	"sym-nec-s": "f60b",
    	"sym-nec": "f60c",
    	"sym-neo-s": "f60d",
    	"sym-neo": "f60e",
    	"sym-neos-s": "f60f",
    	"sym-neos": "f610",
    	"sym-nest-s": "f611",
    	"sym-nest": "f612",
    	"sym-neu-s": "f613",
    	"sym-neu": "f614",
    	"sym-new-s": "f615",
    	"sym-new": "f616",
    	"sym-nexo-s": "f617",
    	"sym-nexo": "f618",
    	"sym-nft-s": "f619",
    	"sym-nft": "f61a",
    	"sym-ng-s": "f61b",
    	"sym-ng": "f61c",
    	"sym-ngc-s": "f61d",
    	"sym-ngc": "f61e",
    	"sym-ngn-s": "f61f",
    	"sym-ngn": "f620",
    	"sym-nim-s": "f621",
    	"sym-nim": "f622",
    	"sym-niy-s": "f623",
    	"sym-niy": "f624",
    	"sym-nkd-s": "f625",
    	"sym-nkd": "f626",
    	"sym-nkn-s": "f627",
    	"sym-nkn": "f628",
    	"sym-nlc2-s": "f629",
    	"sym-nlc2": "f62a",
    	"sym-nlg-s": "f62b",
    	"sym-nlg": "f62c",
    	"sym-nmc-s": "f62d",
    	"sym-nmc": "f62e",
    	"sym-nmr-s": "f62f",
    	"sym-nmr": "f630",
    	"sym-nn-s": "f631",
    	"sym-nn": "f632",
    	"sym-noah-s": "f633",
    	"sym-noah": "f634",
    	"sym-nodl-s": "f635",
    	"sym-nodl": "f636",
    	"sym-note-s": "f637",
    	"sym-note": "f638",
    	"sym-npg-s": "f639",
    	"sym-npg": "f63a",
    	"sym-nplc-s": "f63b",
    	"sym-nplc": "f63c",
    	"sym-npxs-s": "f63d",
    	"sym-npxs": "f63e",
    	"sym-nq-s": "f63f",
    	"sym-nq": "f640",
    	"sym-nrg-s": "f641",
    	"sym-nrg": "f642",
    	"sym-ntk-s": "f643",
    	"sym-ntk": "f644",
    	"sym-nu-s": "f645",
    	"sym-nu": "f646",
    	"sym-nuls-s": "f647",
    	"sym-nuls": "f648",
    	"sym-nvc-s": "f649",
    	"sym-nvc": "f64a",
    	"sym-nxc-s": "f64b",
    	"sym-nxc": "f64c",
    	"sym-nxs-s": "f64d",
    	"sym-nxs": "f64e",
    	"sym-nxt-s": "f64f",
    	"sym-nxt": "f650",
    	"sym-nym-s": "f651",
    	"sym-nym": "f652",
    	"sym-o-s": "f653",
    	"sym-o": "f654",
    	"sym-oax-s": "f655",
    	"sym-oax": "f656",
    	"sym-ocean-s": "f657",
    	"sym-ocean": "f658",
    	"sym-ocn-s": "f659",
    	"sym-ocn": "f65a",
    	"sym-ode-s": "f65b",
    	"sym-ode": "f65c",
    	"sym-ogn-s": "f65d",
    	"sym-ogn": "f65e",
    	"sym-ogo-s": "f65f",
    	"sym-ogo": "f660",
    	"sym-ok-s": "f661",
    	"sym-ok": "f662",
    	"sym-okb-s": "f663",
    	"sym-okb": "f664",
    	"sym-om-s": "f665",
    	"sym-om": "f666",
    	"sym-omg-s": "f667",
    	"sym-omg": "f668",
    	"sym-omni-s": "f669",
    	"sym-omni": "f66a",
    	"sym-one-s": "f66b",
    	"sym-one": "f66c",
    	"sym-ong-s": "f66d",
    	"sym-ong": "f66e",
    	"sym-onot-s": "f66f",
    	"sym-onot": "f670",
    	"sym-ont-s": "f671",
    	"sym-ont": "f672",
    	"sym-orbs-s": "f673",
    	"sym-orbs": "f674",
    	"sym-orca-s": "f675",
    	"sym-orca": "f676",
    	"sym-orme-s": "f677",
    	"sym-orme": "f678",
    	"sym-ors-s": "f679",
    	"sym-ors": "f67a",
    	"sym-ost-s": "f67b",
    	"sym-ost": "f67c",
    	"sym-otn-s": "f67d",
    	"sym-otn": "f67e",
    	"sym-oxt-s": "f67f",
    	"sym-oxt": "f680",
    	"sym-oxy-s": "f681",
    	"sym-oxy": "f682",
    	"sym-pai-s": "f683",
    	"sym-pai": "f684",
    	"sym-pal-s": "f685",
    	"sym-pal": "f686",
    	"sym-para-s": "f687",
    	"sym-para": "f688",
    	"sym-part-s": "f689",
    	"sym-part": "f68a",
    	"sym-pasc-s": "f68b",
    	"sym-pasc": "f68c",
    	"sym-pat-s": "f68d",
    	"sym-pat": "f68e",
    	"sym-pax-s": "f68f",
    	"sym-pax": "f690",
    	"sym-paxg-s": "f691",
    	"sym-paxg": "f692",
    	"sym-pay-s": "f693",
    	"sym-pay": "f694",
    	"sym-pbt-s": "f695",
    	"sym-pbt": "f696",
    	"sym-pcl-s": "f697",
    	"sym-pcl": "f698",
    	"sym-pcx-s": "f699",
    	"sym-pcx": "f69a",
    	"sym-pdex-s": "f69b",
    	"sym-pdex": "f69c",
    	"sym-people-s": "f69d",
    	"sym-people": "f69e",
    	"sym-perl-s": "f69f",
    	"sym-perl": "f6a0",
    	"sym-perp-s": "f6a1",
    	"sym-perp": "f6a2",
    	"sym-pha-s": "f6a3",
    	"sym-pha": "f6a4",
    	"sym-phb-s": "f6a5",
    	"sym-phb": "f6a6",
    	"sym-php-s": "f6a7",
    	"sym-php": "f6a8",
    	"sym-phx-s": "f6a9",
    	"sym-phx": "f6aa",
    	"sym-pi-s": "f6ab",
    	"sym-pi": "f6ac",
    	"sym-pica-s": "f6ad",
    	"sym-pica": "f6ae",
    	"sym-pink-s": "f6af",
    	"sym-pink": "f6b0",
    	"sym-pivx-s": "f6b1",
    	"sym-pivx": "f6b2",
    	"sym-pkt-s": "f6b3",
    	"sym-pkt": "f6b4",
    	"sym-pl-s": "f6b5",
    	"sym-pl": "f6b6",
    	"sym-pla-s": "f6b7",
    	"sym-pla": "f6b8",
    	"sym-plbt-s": "f6b9",
    	"sym-plbt": "f6ba",
    	"sym-plm-s": "f6bb",
    	"sym-plm": "f6bc",
    	"sym-pln-s": "f6bd",
    	"sym-pln": "f6be",
    	"sym-plr-s": "f6bf",
    	"sym-plr": "f6c0",
    	"sym-ply-s": "f6c1",
    	"sym-ply": "f6c2",
    	"sym-pma-s": "f6c3",
    	"sym-pma": "f6c4",
    	"sym-png-s": "f6c5",
    	"sym-png": "f6c6",
    	"sym-pnt-s": "f6c7",
    	"sym-pnt": "f6c8",
    	"sym-poa-s": "f6c9",
    	"sym-poa": "f6ca",
    	"sym-poe-s": "f6cb",
    	"sym-poe": "f6cc",
    	"sym-polis-s": "f6cd",
    	"sym-polis": "f6ce",
    	"sym-pols-s": "f6cf",
    	"sym-pols": "f6d0",
    	"sym-poly-s": "f6d1",
    	"sym-poly": "f6d2",
    	"sym-pond-s": "f6d3",
    	"sym-pond": "f6d4",
    	"sym-pot-s": "f6d5",
    	"sym-pot": "f6d6",
    	"sym-powr-s": "f6d7",
    	"sym-powr": "f6d8",
    	"sym-ppc-s": "f6d9",
    	"sym-ppc": "f6da",
    	"sym-ppt-s": "f6db",
    	"sym-ppt": "f6dc",
    	"sym-pra-s": "f6dd",
    	"sym-pra": "f6de",
    	"sym-pre-s": "f6df",
    	"sym-pre": "f6e0",
    	"sym-prg-s": "f6e1",
    	"sym-prg": "f6e2",
    	"sym-pro-s": "f6e3",
    	"sym-pro": "f6e4",
    	"sym-pst-s": "f6e5",
    	"sym-pst": "f6e6",
    	"sym-pstake-s": "f6e7",
    	"sym-pstake": "f6e8",
    	"sym-pton-s": "f6e9",
    	"sym-pton": "f6ea",
    	"sym-pvt-s": "f6eb",
    	"sym-pvt": "f6ec",
    	"sym-pxg-s": "f6ed",
    	"sym-pxg": "f6ee",
    	"sym-qash-s": "f6ef",
    	"sym-qash": "f6f0",
    	"sym-qau-s": "f6f1",
    	"sym-qau": "f6f2",
    	"sym-qc-s": "f6f3",
    	"sym-qc": "f6f4",
    	"sym-qi-s": "f6f5",
    	"sym-qi": "f6f6",
    	"sym-qkc-s": "f6f7",
    	"sym-qkc": "f6f8",
    	"sym-qlc-s": "f6f9",
    	"sym-qlc": "f6fa",
    	"sym-qnt-s": "f6fb",
    	"sym-qnt": "f6fc",
    	"sym-qntu-s": "f6fd",
    	"sym-qntu": "f6fe",
    	"sym-qo-s": "f6ff",
    	"sym-qo": "f700",
    	"sym-qrl-s": "f701",
    	"sym-qrl": "f702",
    	"sym-qsp-s": "f703",
    	"sym-qsp": "f704",
    	"sym-qtum-s": "f705",
    	"sym-qtum": "f706",
    	"sym-qun-s": "f707",
    	"sym-qun": "f708",
    	"sym-r-s": "f709",
    	"sym-r": "f70a",
    	"sym-rad-s": "f70b",
    	"sym-rad": "f70c",
    	"sym-rads-s": "f70d",
    	"sym-rads": "f70e",
    	"sym-rare-s": "f70f",
    	"sym-rare": "f710",
    	"sym-rari-s": "f711",
    	"sym-rari": "f712",
    	"sym-rating-s": "f713",
    	"sym-rating": "f714",
    	"sym-ray-s": "f715",
    	"sym-ray": "f716",
    	"sym-rb-s": "f717",
    	"sym-rb": "f718",
    	"sym-rbc-s": "f719",
    	"sym-rbc": "f71a",
    	"sym-rblx-s": "f71b",
    	"sym-rblx": "f71c",
    	"sym-rbtc-s": "f71d",
    	"sym-rbtc": "f71e",
    	"sym-rby-s": "f71f",
    	"sym-rby": "f720",
    	"sym-rcn-s": "f721",
    	"sym-rcn": "f722",
    	"sym-rdd-s": "f723",
    	"sym-rdd": "f724",
    	"sym-rdn-s": "f725",
    	"sym-rdn": "f726",
    	"sym-reef-s": "f727",
    	"sym-reef": "f728",
    	"sym-rem-s": "f729",
    	"sym-rem": "f72a",
    	"sym-ren-s": "f72b",
    	"sym-ren": "f72c",
    	"sym-rep-s": "f72d",
    	"sym-rep": "f72e",
    	"sym-repv2-s": "f72f",
    	"sym-repv2": "f730",
    	"sym-req-s": "f731",
    	"sym-req": "f732",
    	"sym-rev-s": "f733",
    	"sym-rev": "f734",
    	"sym-rfox-s": "f735",
    	"sym-rfox": "f736",
    	"sym-rfr-s": "f737",
    	"sym-rfr": "f738",
    	"sym-ric-s": "f739",
    	"sym-ric": "f73a",
    	"sym-rif-s": "f73b",
    	"sym-rif": "f73c",
    	"sym-ring-s": "f73d",
    	"sym-ring": "f73e",
    	"sym-rlc-s": "f73f",
    	"sym-rlc": "f740",
    	"sym-rmrk-s": "f741",
    	"sym-rmrk": "f742",
    	"sym-rndr-s": "f743",
    	"sym-rndr": "f744",
    	"sym-rntb-s": "f745",
    	"sym-rntb": "f746",
    	"sym-ron-s": "f747",
    	"sym-ron": "f748",
    	"sym-rook-s": "f749",
    	"sym-rook": "f74a",
    	"sym-rose-s": "f74b",
    	"sym-rose": "f74c",
    	"sym-rox-s": "f74d",
    	"sym-rox": "f74e",
    	"sym-rp-s": "f74f",
    	"sym-rp": "f750",
    	"sym-rpx-s": "f751",
    	"sym-rpx": "f752",
    	"sym-rsr-s": "f753",
    	"sym-rsr": "f754",
    	"sym-rsv-s": "f755",
    	"sym-rsv": "f756",
    	"sym-rty-s": "f757",
    	"sym-rty": "f758",
    	"sym-rub-s": "f759",
    	"sym-rub": "f75a",
    	"sym-ruff-s": "f75b",
    	"sym-ruff": "f75c",
    	"sym-rune-s": "f75d",
    	"sym-rune": "f75e",
    	"sym-rvn-s": "f75f",
    	"sym-rvn": "f760",
    	"sym-rvr-s": "f761",
    	"sym-rvr": "f762",
    	"sym-rvt-s": "f763",
    	"sym-rvt": "f764",
    	"sym-sai-s": "f765",
    	"sym-sai": "f766",
    	"sym-salt-s": "f767",
    	"sym-salt": "f768",
    	"sym-samo-s": "f769",
    	"sym-samo": "f76a",
    	"sym-san-s": "f76b",
    	"sym-san": "f76c",
    	"sym-sand-s": "f76d",
    	"sym-sand": "f76e",
    	"sym-sats-s": "f76f",
    	"sym-sats": "f770",
    	"sym-sbd-s": "f771",
    	"sym-sbd": "f772",
    	"sym-sbr-s": "f773",
    	"sym-sbr": "f774",
    	"sym-sc-s": "f775",
    	"sym-sc": "f776",
    	"sym-scc-s": "f777",
    	"sym-scc": "f778",
    	"sym-scrt-s": "f779",
    	"sym-scrt": "f77a",
    	"sym-sdc-s": "f77b",
    	"sym-sdc": "f77c",
    	"sym-sdn-s": "f77d",
    	"sym-sdn": "f77e",
    	"sym-seele-s": "f77f",
    	"sym-seele": "f780",
    	"sym-sek-s": "f781",
    	"sym-sek": "f782",
    	"sym-sen-s": "f783",
    	"sym-sen": "f784",
    	"sym-sent-s": "f785",
    	"sym-sent": "f786",
    	"sym-sero-s": "f787",
    	"sym-sero": "f788",
    	"sym-sexc-s": "f789",
    	"sym-sexc": "f78a",
    	"sym-sfp-s": "f78b",
    	"sym-sfp": "f78c",
    	"sym-sgb-s": "f78d",
    	"sym-sgb": "f78e",
    	"sym-sgc-s": "f78f",
    	"sym-sgc": "f790",
    	"sym-sgd-s": "f791",
    	"sym-sgd": "f792",
    	"sym-sgn-s": "f793",
    	"sym-sgn": "f794",
    	"sym-sgu-s": "f795",
    	"sym-sgu": "f796",
    	"sym-shib-s": "f797",
    	"sym-shib": "f798",
    	"sym-shift-s": "f799",
    	"sym-shift": "f79a",
    	"sym-ship-s": "f79b",
    	"sym-ship": "f79c",
    	"sym-si-s": "f79d",
    	"sym-si": "f79e",
    	"sym-sib-s": "f79f",
    	"sym-sib": "f7a0",
    	"sym-sil-s": "f7a1",
    	"sym-sil": "f7a2",
    	"sym-six-s": "f7a3",
    	"sym-six": "f7a4",
    	"sym-sjcx-s": "f7a5",
    	"sym-sjcx": "f7a6",
    	"sym-skl-s": "f7a7",
    	"sym-skl": "f7a8",
    	"sym-skm-s": "f7a9",
    	"sym-skm": "f7aa",
    	"sym-sku-s": "f7ab",
    	"sym-sku": "f7ac",
    	"sym-sky-s": "f7ad",
    	"sym-sky": "f7ae",
    	"sym-slp-s": "f7af",
    	"sym-slp": "f7b0",
    	"sym-slr-s": "f7b1",
    	"sym-slr": "f7b2",
    	"sym-sls-s": "f7b3",
    	"sym-sls": "f7b4",
    	"sym-slt-s": "f7b5",
    	"sym-slt": "f7b6",
    	"sym-slv-s": "f7b7",
    	"sym-slv": "f7b8",
    	"sym-smart-s": "f7b9",
    	"sym-smart": "f7ba",
    	"sym-smn-s": "f7bb",
    	"sym-smn": "f7bc",
    	"sym-smt-s": "f7bd",
    	"sym-smt": "f7be",
    	"sym-snc-s": "f7bf",
    	"sym-snc": "f7c0",
    	"sym-snet-s": "f7c1",
    	"sym-snet": "f7c2",
    	"sym-sngls-s": "f7c3",
    	"sym-sngls": "f7c4",
    	"sym-snm-s": "f7c5",
    	"sym-snm": "f7c6",
    	"sym-snt-s": "f7c7",
    	"sym-snt": "f7c8",
    	"sym-snx-s": "f7c9",
    	"sym-snx": "f7ca",
    	"sym-soc-s": "f7cb",
    	"sym-soc": "f7cc",
    	"sym-socks-s": "f7cd",
    	"sym-socks": "f7ce",
    	"sym-sol-s": "f7cf",
    	"sym-sol": "f7d0",
    	"sym-solid-s": "f7d1",
    	"sym-solid": "f7d2",
    	"sym-solo-s": "f7d3",
    	"sym-solo": "f7d4",
    	"sym-solve-s": "f7d5",
    	"sym-solve": "f7d6",
    	"sym-sos-s": "f7d7",
    	"sym-sos": "f7d8",
    	"sym-soul-s": "f7d9",
    	"sym-soul": "f7da",
    	"sym-sp-s": "f7db",
    	"sym-sp": "f7dc",
    	"sym-sparta-s": "f7dd",
    	"sym-sparta": "f7de",
    	"sym-spc-s": "f7df",
    	"sym-spc": "f7e0",
    	"sym-spd-s": "f7e1",
    	"sym-spd": "f7e2",
    	"sym-spell-s": "f7e3",
    	"sym-spell": "f7e4",
    	"sym-sphr-s": "f7e5",
    	"sym-sphr": "f7e6",
    	"sym-sphtx-s": "f7e7",
    	"sym-sphtx": "f7e8",
    	"sym-spnd-s": "f7e9",
    	"sym-spnd": "f7ea",
    	"sym-spnk-s": "f7eb",
    	"sym-spnk": "f7ec",
    	"sym-srm-s": "f7ed",
    	"sym-srm": "f7ee",
    	"sym-srn-s": "f7ef",
    	"sym-srn": "f7f0",
    	"sym-ssp-s": "f7f1",
    	"sym-ssp": "f7f2",
    	"sym-stacs-s": "f7f3",
    	"sym-stacs": "f7f4",
    	"sym-step-s": "f7f5",
    	"sym-step": "f7f6",
    	"sym-storm-s": "f7f7",
    	"sym-storm": "f7f8",
    	"sym-stpt-s": "f7f9",
    	"sym-stpt": "f7fa",
    	"sym-stq-s": "f7fb",
    	"sym-stq": "f7fc",
    	"sym-str-s": "f7fd",
    	"sym-str": "f7fe",
    	"sym-strat-s": "f7ff",
    	"sym-strat": "f800",
    	"sym-strax-s": "f801",
    	"sym-strax": "f802",
    	"sym-stx-s": "f803",
    	"sym-stx": "f804",
    	"sym-sub-s": "f805",
    	"sym-sub": "f806",
    	"sym-super-s": "f807",
    	"sym-super": "f808",
    	"sym-susd-s": "f809",
    	"sym-susd": "f80a",
    	"sym-sushi-s": "f80b",
    	"sym-sushi": "f80c",
    	"sym-swftc-s": "f80d",
    	"sym-swftc": "f80e",
    	"sym-swm-s": "f80f",
    	"sym-swm": "f810",
    	"sym-swrv-s": "f811",
    	"sym-swrv": "f812",
    	"sym-swt-s": "f813",
    	"sym-swt": "f814",
    	"sym-swth-s": "f815",
    	"sym-swth": "f816",
    	"sym-sxp-s": "f817",
    	"sym-sxp": "f818",
    	"sym-sys-s": "f819",
    	"sym-sys": "f81a",
    	"sym-taas-s": "f81b",
    	"sym-taas": "f81c",
    	"sym-tau-s": "f81d",
    	"sym-tau": "f81e",
    	"sym-tbtc-s": "f81f",
    	"sym-tbtc": "f820",
    	"sym-tct-s": "f821",
    	"sym-tct": "f822",
    	"sym-teer-s": "f823",
    	"sym-teer": "f824",
    	"sym-tel-s": "f825",
    	"sym-temco-s": "f826",
    	"sym-temco": "f827",
    	"sym-tfuel-s": "f828",
    	"sym-tfuel": "f829",
    	"sym-thb-s": "f82a",
    	"sym-thb": "f82b",
    	"sym-thc-s": "f82c",
    	"sym-thc": "f82d",
    	"sym-theta-s": "f82e",
    	"sym-theta": "f82f",
    	"sym-thx-s": "f830",
    	"sym-thx": "f831",
    	"sym-time-s": "f832",
    	"sym-time": "f833",
    	"sym-tio-s": "f834",
    	"sym-tio": "f835",
    	"sym-tix-s": "f836",
    	"sym-tix": "f837",
    	"sym-tkn-s": "f838",
    	"sym-tkn": "f839",
    	"sym-tky-s": "f83a",
    	"sym-tky": "f83b",
    	"sym-tnb-s": "f83c",
    	"sym-tnb": "f83d",
    	"sym-tnc-s": "f83e",
    	"sym-tnc": "f83f",
    	"sym-tnt-s": "f840",
    	"sym-tnt": "f841",
    	"sym-toke-s": "f842",
    	"sym-toke": "f843",
    	"sym-tomo-s": "f844",
    	"sym-tomo": "f845",
    	"sym-top-s": "f846",
    	"sym-top": "f847",
    	"sym-torn-s": "f848",
    	"sym-torn": "f849",
    	"sym-tpay-s": "f84a",
    	"sym-tpay": "f84b",
    	"sym-trac-s": "f84c",
    	"sym-trac": "f84d",
    	"sym-trb-s": "f84e",
    	"sym-trb": "f84f",
    	"sym-tribe-s": "f850",
    	"sym-tribe": "f851",
    	"sym-trig-s": "f852",
    	"sym-trig": "f853",
    	"sym-trio-s": "f854",
    	"sym-trio": "f855",
    	"sym-troy-s": "f856",
    	"sym-troy": "f857",
    	"sym-trst-s": "f858",
    	"sym-trst": "f859",
    	"sym-tru-s": "f85a",
    	"sym-tru": "f85b",
    	"sym-true-s": "f85c",
    	"sym-true": "f85d",
    	"sym-trx-s": "f85e",
    	"sym-trx": "f85f",
    	"sym-try-s": "f860",
    	"sym-try": "f861",
    	"sym-tryb-s": "f862",
    	"sym-tryb": "f863",
    	"sym-tt-s": "f864",
    	"sym-tt": "f865",
    	"sym-ttc-s": "f866",
    	"sym-ttc": "f867",
    	"sym-ttt-s": "f868",
    	"sym-ttt": "f869",
    	"sym-ttu-s": "f86a",
    	"sym-ttu": "f86b",
    	"sym-tube-s": "f86c",
    	"sym-tube": "f86d",
    	"sym-tusd-s": "f86e",
    	"sym-tusd": "f86f",
    	"sym-twt-s": "f870",
    	"sym-twt": "f871",
    	"sym-uah-s": "f872",
    	"sym-uah": "f873",
    	"sym-ubq-s": "f874",
    	"sym-ubq": "f875",
    	"sym-ubt-s": "f876",
    	"sym-ubt": "f877",
    	"sym-uft-s": "f878",
    	"sym-uft": "f879",
    	"sym-ugas-s": "f87a",
    	"sym-ugas": "f87b",
    	"sym-uip-s": "f87c",
    	"sym-uip": "f87d",
    	"sym-ukg-s": "f87e",
    	"sym-ukg": "f87f",
    	"sym-uma-s": "f880",
    	"sym-uma": "f881",
    	"sym-unfi-s": "f882",
    	"sym-unfi": "f883",
    	"sym-uni-s": "f884",
    	"sym-uni": "f885",
    	"sym-unq-s": "f886",
    	"sym-unq": "f887",
    	"sym-up-s": "f888",
    	"sym-up": "f889",
    	"sym-upp-s": "f88a",
    	"sym-upp": "f88b",
    	"sym-usd-s": "f88c",
    	"sym-usd": "f88d",
    	"sym-usdc-s": "f88e",
    	"sym-usdc": "f88f",
    	"sym-usds-s": "f890",
    	"sym-usds": "f891",
    	"sym-usk-s": "f892",
    	"sym-usk": "f893",
    	"sym-ust-s": "f894",
    	"sym-ust": "f895",
    	"sym-utk-s": "f896",
    	"sym-utk": "f897",
    	"sym-utnp-s": "f898",
    	"sym-utnp": "f899",
    	"sym-utt-s": "f89a",
    	"sym-utt": "f89b",
    	"sym-uuu-s": "f89c",
    	"sym-uuu": "f89d",
    	"sym-ux-s": "f89e",
    	"sym-ux": "f89f",
    	"sym-vai-s": "f8a0",
    	"sym-vai": "f8a1",
    	"sym-vbk-s": "f8a2",
    	"sym-vbk": "f8a3",
    	"sym-vdx-s": "f8a4",
    	"sym-vdx": "f8a5",
    	"sym-vee-s": "f8a6",
    	"sym-vee": "f8a7",
    	"sym-ven-s": "f8a8",
    	"sym-ven": "f8a9",
    	"sym-veo-s": "f8aa",
    	"sym-veo": "f8ab",
    	"sym-veri-s": "f8ac",
    	"sym-veri": "f8ad",
    	"sym-vex-s": "f8ae",
    	"sym-vex": "f8af",
    	"sym-vgx-s": "f8b0",
    	"sym-vgx": "f8b1",
    	"sym-via-s": "f8b2",
    	"sym-via": "f8b3",
    	"sym-vib-s": "f8b4",
    	"sym-vib": "f8b5",
    	"sym-vibe-s": "f8b6",
    	"sym-vibe": "f8b7",
    	"sym-vid-s": "f8b8",
    	"sym-vid": "f8b9",
    	"sym-vidt-s": "f8ba",
    	"sym-vidt": "f8bb",
    	"sym-vidy-s": "f8bc",
    	"sym-vidy": "f8bd",
    	"sym-vitae-s": "f8be",
    	"sym-vitae": "f8bf",
    	"sym-vite-s": "f8c0",
    	"sym-vite": "f8c1",
    	"sym-vlx-s": "f8c2",
    	"sym-vlx": "f8c3",
    	"sym-vox-s": "f8c4",
    	"sym-vox": "f8c5",
    	"sym-vra-s": "f8c6",
    	"sym-vra": "f8c7",
    	"sym-vrc-s": "f8c8",
    	"sym-vrc": "f8c9",
    	"sym-vrm-s": "f8ca",
    	"sym-vrm": "f8cb",
    	"sym-vsys-s": "f8cc",
    	"sym-vsys": "f8cd",
    	"sym-vtc-s": "f8ce",
    	"sym-vtc": "f8cf",
    	"sym-vtho-s": "f8d0",
    	"sym-vtho": "f8d1",
    	"sym-wabi-s": "f8d2",
    	"sym-wabi": "f8d3",
    	"sym-wan-s": "f8d4",
    	"sym-wan": "f8d5",
    	"sym-waves-s": "f8d6",
    	"sym-waves": "f8d7",
    	"sym-wax-s": "f8d8",
    	"sym-wax": "f8d9",
    	"sym-wbtc-s": "f8da",
    	"sym-wbtc": "f8db",
    	"sym-wet-s": "f8dc",
    	"sym-wet": "f8dd",
    	"sym-wib-s": "f8de",
    	"sym-wib": "f8df",
    	"sym-wicc-s": "f8e0",
    	"sym-wicc": "f8e1",
    	"sym-win-s": "f8e2",
    	"sym-win": "f8e3",
    	"sym-wing-s": "f8e4",
    	"sym-wing": "f8e5",
    	"sym-wings-s": "f8e6",
    	"sym-wings": "f8e7",
    	"sym-wnxm-s": "f8e8",
    	"sym-wnxm": "f8e9",
    	"sym-woo-s": "f8ea",
    	"sym-woo": "f8eb",
    	"sym-wpr-s": "f8ec",
    	"sym-wpr": "f8ed",
    	"sym-wrx-s": "f8ee",
    	"sym-wrx": "f8ef",
    	"sym-wtc-s": "f8f0",
    	"sym-wtc": "f8f1",
    	"sym-wtt-s": "f8f2",
    	"sym-wtt": "f8f3",
    	"sym-wwb-s": "f8f4",
    	"sym-wwb": "f8f5",
    	"sym-wxt-s": "f8f6",
    	"sym-wxt": "f8f7",
    	"sym-xas-s": "f8f8",
    	"sym-xas": "f8f9",
    	"sym-xaur-s": "f8fa",
    	"sym-xaur": "f8fb",
    	"sym-xaut-s": "f8fc",
    	"sym-xaut": "f8fd",
    	"sym-xava-s": "f8fe",
    	"sym-xava": "f8ff",
    	"sym-xbc-s": "f900",
    	"sym-xbc": "f901",
    	"sym-xcon-s": "f902",
    	"sym-xcon": "f903",
    	"sym-xcp-s": "f904",
    	"sym-xcp": "f905",
    	"sym-xdn-s": "f906",
    	"sym-xdn": "f907",
    	"sym-xel-s": "f908",
    	"sym-xel": "f909",
    	"sym-xem-s": "f90a",
    	"sym-xem": "f90b",
    	"sym-xes-s": "f90c",
    	"sym-xes": "f90d",
    	"sym-xhv-s": "f90e",
    	"sym-xhv": "f90f",
    	"sym-xin-s": "f910",
    	"sym-xin": "f911",
    	"sym-xlm-s": "f912",
    	"sym-xlm": "f913",
    	"sym-xmc-s": "f914",
    	"sym-xmc": "f915",
    	"sym-xmr-s": "f916",
    	"sym-xmr": "f917",
    	"sym-xmx-s": "f918",
    	"sym-xmx": "f919",
    	"sym-xmy-s": "f91a",
    	"sym-xmy": "f91b",
    	"sym-xnk-s": "f91c",
    	"sym-xnk": "f91d",
    	"sym-xns-s": "f91e",
    	"sym-xns": "f91f",
    	"sym-xor-s": "f920",
    	"sym-xor": "f921",
    	"sym-xos-s": "f922",
    	"sym-xos": "f923",
    	"sym-xpm-s": "f924",
    	"sym-xpm": "f925",
    	"sym-xpr-s": "f926",
    	"sym-xpr": "f927",
    	"sym-xrc-s": "f928",
    	"sym-xrc": "f929",
    	"sym-xrp-s": "f92a",
    	"sym-xrp": "f92b",
    	"sym-xrpx-s": "f92c",
    	"sym-xrpx": "f92d",
    	"sym-xrt-s": "f92e",
    	"sym-xrt": "f92f",
    	"sym-xst-s": "f930",
    	"sym-xst": "f931",
    	"sym-xtp-s": "f932",
    	"sym-xtp": "f933",
    	"sym-xtz-s": "f934",
    	"sym-xtz": "f935",
    	"sym-xtzdown-s": "f936",
    	"sym-xtzdown": "f937",
    	"sym-xvc-s": "f938",
    	"sym-xvc": "f939",
    	"sym-xvg-s": "f93a",
    	"sym-xvg": "f93b",
    	"sym-xvs-s": "f93c",
    	"sym-xvs": "f93d",
    	"sym-xwc-s": "f93e",
    	"sym-xwc": "f93f",
    	"sym-xyo-s": "f940",
    	"sym-xyo": "f941",
    	"sym-xzc-s": "f942",
    	"sym-xzc": "f943",
    	"sym-yam-s": "f944",
    	"sym-yam": "f945",
    	"sym-yee-s": "f946",
    	"sym-yee": "f947",
    	"sym-yeed-s": "f948",
    	"sym-yeed": "f949",
    	"sym-yfi-s": "f94a",
    	"sym-yfi": "f94b",
    	"sym-yfii-s": "f94c",
    	"sym-yfii": "f94d",
    	"sym-ygg-s": "f94e",
    	"sym-ygg": "f94f",
    	"sym-yoyow-s": "f950",
    	"sym-yoyow": "f951",
    	"sym-zar-s": "f952",
    	"sym-zar": "f953",
    	"sym-zcl-s": "f954",
    	"sym-zcl": "f955",
    	"sym-zcn-s": "f956",
    	"sym-zcn": "f957",
    	"sym-zco-s": "f958",
    	"sym-zco": "f959",
    	"sym-zec-s": "f95a",
    	"sym-zec": "f95b",
    	"sym-zen-s": "f95c",
    	"sym-zen": "f95d",
    	"sym-zil-s": "f95e",
    	"sym-zil": "f95f",
    	"sym-zks-s": "f960",
    	"sym-zks": "f961",
    	"sym-zla-s": "f962",
    	"sym-zla": "f963",
    	"sym-zlk": "f964",
    	"sym-zondo-s": "f965",
    	"sym-zondo": "f966",
    	"sym-zpr-s": "f967",
    	"sym-zpr": "f968",
    	"sym-zpt-s": "f969",
    	"sym-zpt": "f96a",
    	"sym-zrc-s": "f96b",
    	"sym-zrc": "f96c",
    	"sym-zrx-s": "f96d",
    	"sym-zrx": "f96e",
    	"sym-zsc-s": "f96f",
    	"sym-zsc": "f970",
    	"sym-ztg-s": "f971",
    	"sym-ztg": "f972",
    	"cur-anct": "f1c8",
    	"cur-anct-s": "f1c7",
    	"cur-aud": "f1f4",
    	"cur-aud-s": "f1f3",
    	"cur-bnb": "f25b",
    	"cur-bnb-s": "f25a",
    	"sym-xbt": "f281",
    	"cur-btc": "f281",
    	"sym-xbt-s": "f280",
    	"cur-btc-s": "f280",
    	"cur-busd": "f29f",
    	"cur-busd-s": "f29e",
    	"exc-bitz": "f2a3",
    	"cur-bz": "f2a3",
    	"exc-bitz-s": "f2a2",
    	"cur-bz-s": "f2a2",
    	"cur-cad": "f2ad",
    	"cur-cad-s": "f2ac",
    	"cur-chf": "f2cd",
    	"cur-chf-s": "f2cc",
    	"cur-cny": "f2f1",
    	"cur-cny-s": "f2f0",
    	"sym-cs": "f305",
    	"sym-cs-s": "f304",
    	"sym-crm": "f319",
    	"sym-crm-s": "f318",
    	"cur-dai": "f345",
    	"cur-dai-s": "f344",
    	"sym-xdg": "f37f",
    	"sym-xdg-s": "f37e",
    	"cur-eos": "f3c8",
    	"cur-eos-s": "f3c7",
    	"sym-eth2": "f3d8",
    	"sym-eth2s": "f3d8",
    	"sym-eth2.s": "f3d8",
    	"sym-weth": "f3d8",
    	"cur-eth": "f3d8",
    	"sym-eth2-s": "f3d7",
    	"sym-eth2s-s": "f3d7",
    	"sym-eth2.s-s": "f3d7",
    	"sym-weth-s": "f3d7",
    	"cur-eth-s": "f3d7",
    	"cur-eur": "f3e0",
    	"cur-eur-s": "f3df",
    	"cur-eurs": "f3e2",
    	"cur-eurs-s": "f3e1",
    	"sym-usdt": "f3e4",
    	"cur-usdt": "f3e4",
    	"sym-usdt-s": "f3e3",
    	"cur-usdt-s": "f3e3",
    	"exc-kraken": "f3fa",
    	"exc-kraken-futures": "f3fa",
    	"exc-kraken-s": "f3f9",
    	"exc-kraken-futures-s": "f3f9",
    	"cur-gbp": "f444",
    	"cur-gbp-s": "f443",
    	"exc-gemini": "f480",
    	"cur-gusd": "f480",
    	"exc-gemini-s": "f47f",
    	"cur-gusd-s": "f47f",
    	"cur-hkd": "f4a0",
    	"cur-hkd-s": "f49f",
    	"sym-husd": "f4ba",
    	"exc-huobi": "f4ba",
    	"cur-ht": "f4ba",
    	"sym-husd-s": "f4b9",
    	"exc-huobi-s": "f4b9",
    	"cur-ht-s": "f4b9",
    	"cur-idr": "f4d8",
    	"cur-idr-s": "f4d7",
    	"sym-iota": "f4fe",
    	"sym-iota-s": "f4fd",
    	"cur-inr": "f4f0",
    	"cur-inr-s": "f4ef",
    	"cur-jpy": "f512",
    	"cur-jpy-s": "f511",
    	"cur-krw": "f53a",
    	"cur-krw-s": "f539",
    	"sym-medx": "f5a4",
    	"sym-medx-s": "f5a3",
    	"cur-mxn": "f5f4",
    	"cur-mxn-s": "f5f3",
    	"cur-myr": "f5f6",
    	"cur-myr-s": "f5f5",
    	"cur-ngn": "f620",
    	"cur-ngn-s": "f61f",
    	"cur-pax": "f690",
    	"cur-pax-s": "f68f",
    	"cur-php": "f6a8",
    	"cur-php-s": "f6a7",
    	"cur-pln": "f6be",
    	"cur-pln-s": "f6bd",
    	"cur-qash": "f6f0",
    	"cur-qash-s": "f6ef",
    	"cur-rub": "f75a",
    	"cur-rur": "f75a",
    	"cur-rub-s": "f759",
    	"cur-rur-s": "f759",
    	"sym-steem": "f772",
    	"sym-steem-s": "f771",
    	"sym-xsc": "f776",
    	"sym-xsc-s": "f775",
    	"cur-sgd": "f792",
    	"cur-sgd-s": "f791",
    	"sym-storj": "f7a6",
    	"sym-storj-s": "f7a5",
    	"sym-tel": "f81c",
    	"cur-trx": "f85f",
    	"cur-trx-s": "f85e",
    	"cur-tusd": "f86f",
    	"cur-tusd-s": "f86e",
    	"cur-usd": "f88d",
    	"cur-usd-s": "f88c",
    	"cur-usdc": "f88f",
    	"cur-usdc-s": "f88e",
    	"sym-vet": "f8a9",
    	"sym-vet-s": "f8a8",
    	"sym-waxp": "f8d9",
    	"sym-waxp-s": "f8d8",
    	"cur-xlm": "f913",
    	"cur-xlm-s": "f912",
    	"cur-xmr": "f917",
    	"cur-xmr-s": "f916",
    	"cur-xrp": "f92b",
    	"cur-xrp-s": "f92a",
    	"cur-zar": "f953",
    	"cur-zar-s": "f952",
    	"exc-binance-us": "f108",
    	"exc-binance-us-s": "f107",
    	"exc-mexbt": "f11e",
    	"exc-mexbt-s": "f11d",
    	"exc-coinbase-pro": "f128",
    	"exc-gdax": "f128",
    	"exc-coinbase-pro-s": "f127",
    	"exc-gdax-s": "f127",
    	"exc-quadriga": "f150",
    	"exc-quadriga-s": "f14f",
    	"cur-crc": "f30d",
    	"cur-crc-s": "f30c",
    	"cur-lak": "f544",
    	"cur-lak-s": "f543",
    	"cur-sek": "f782",
    	"cur-sek-s": "f781",
    	"cur-thb": "f82b",
    	"cur-thb-s": "f82a",
    	"cur-try": "f861",
    	"cur-try-s": "f860",
    	"cur-uah": "f873",
    	"cur-uah-s": "f872",
    	"exc-ftx": "f428",
    	"exc-ftx-s": "f427",
    	"exc-ftx-us": "f428",
    	"exc-ftx-us-s": "f427",
    	"sym-cgld": "f2bd",
    	"sym-cgld-s": "f2bc",
    	"exc-uniswap-v2": "f885",
    	"exc-uniswap-v2-s": "f884",
    	"sym-kshib": "f798",
    	"sym-kshib-s": "f797",
    	"sym-easy-s": "f39c",
    	"sym-srare": "f710",
    	"sym-srare-s": "f70f",
    	"sym-ape.2": "f1ce",
    	"sym-ape.2-s": "f1cd"
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
    var amp = "Synereo";
    var ampl = "Ampleforth";
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
    var auction = "Bounce Token";
    var aud = "Australian Dollar";
    var audio = "Audius";
    var aup = "Aluminum MW U.S. Transaction Premium Platts (25MT) Futures";
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
    var crc = "";
    var cre = "Carry";
    var cream = "Cream Finance";
    var cring = "";
    var cro = "Crypto.com Chain";
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
    var fct = "Factom";
    var fdz = "Friendz";
    var fee = "";
    var fet = "Fetch";
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
    var gno = "Gnosis";
    var gnt = "Golem";
    var gnx = "Genaro Network";
    var go = "GoChain";
    var got = "ParkinGo";
    var grc = "GridCoin";
    var grin = "GRIN";
    var grs = "Groestlcoin";
    var grt = "The Graph";
    var gsc = "Global Social Chain";
    var gt = "Gatechain Token";
    var gtc = "Game.com";
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
    var hex = "HEX";
    var hft = "Hashflow";
    var hg = "Copper Futures";
    var hgs = "Copper Financial Futures";
    var hh = "Natural Gas (Henry Hub) Last-day Financial Futures";
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
    var jpy = "Japanese Yen";
    var jst = "JUST";
    var juv = "Juventus Fan Token";
    var kan = "BitKan";
    var kar = "Karura";
    var kava = "Kava";
    var kbc = "Karatgold Coin";
    var kcash = "Kcash";
    var keep = "Keep Network";
    var key = "Selfkey";
    var kick = "Kick Token";
    var kilt = "KILT Protocol";
    var kin = "Kin";
    var kint = "Kintsugi";
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
    var ldo = "Lido DAO Token";
    var lend = "Aave";
    var leo = "LEO Token";
    var leoc = "LEOcoin";
    var life = "LIFE";
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
    var mrk = "MARK.SPACE";
    var msp = "Mothership";
    var mta = "Meta";
    var mtc = "Docademic";
    var mth = "Monetha";
    var mtl = "Metal";
    var mtn = "Medicalchain";
    var mtx = "Matryx";
    var mue = "MonetaryUnit";
    var multi = "Multichain";
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
    var ors = "Origin Sport";
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
    var qash = "QASH";
    var qau = "Quantum";
    var qc = "E-mini Copper Futures";
    var qi = "E-mini Silver Futures";
    var qkc = "QuarkChain";
    var qlc = "QLINK";
    var qnt = "Quant";
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
    var req = "Request Network";
    var rev = "Revain";
    var rfox = "RedFOX Labs";
    var rfr = "Refereum";
    var ric = "Riecoin";
    var rif = "RIF Token";
    var ring = "Darwinia Network";
    var rlc = "iExec RLC";
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
    var storm = "Storm";
    var stpt = "STPT";
    var stq = "Storiqa";
    var str = "Stellar";
    var strat = "Stratis";
    var strax = "Stratis";
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
    var sys = "Syscoin";
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
    var twt = "Trust Wallet Token";
    var uah = "Ukrainian hryvnia";
    var ubq = "Ubiq";
    var ubt = "Unibright";
    var uft = "UniLend";
    var ugas = "UGAS";
    var uip = "UnlimitedIP";
    var ukg = "Unikoin Gold";
    var uma = "UMA";
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
    var weth = "Wrapped Ether";
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
    	auction: auction,
    	aud: aud,
    	audio: audio,
    	aup: aup,
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
    	gno: gno,
    	gnt: gnt,
    	gnx: gnx,
    	go: go,
    	got: got,
    	grc: grc,
    	grin: grin,
    	grs: grs,
    	grt: grt,
    	gsc: gsc,
    	gt: gt,
    	gtc: gtc,
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
    	hex: hex,
    	hft: hft,
    	hg: hg,
    	hgs: hgs,
    	hh: hh,
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
    	juv: juv,
    	kan: kan,
    	kar: kar,
    	kava: kava,
    	kbc: kbc,
    	kcash: kcash,
    	keep: keep,
    	key: key,
    	kick: kick,
    	kilt: kilt,
    	kin: kin,
    	kint: kint,
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
    	ldo: ldo,
    	lend: lend,
    	leo: leo,
    	leoc: leoc,
    	"let": "LinkEye",
    	life: life,
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
    	mrk: mrk,
    	msp: msp,
    	mta: mta,
    	mtc: mtc,
    	mth: mth,
    	mtl: mtl,
    	mtn: mtn,
    	mtx: mtx,
    	mue: mue,
    	multi: multi,
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
    	ors: ors,
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
    	qash: qash,
    	qau: qau,
    	qc: qc,
    	qi: qi,
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
    	storm: storm,
    	stpt: stpt,
    	stq: stq,
    	str: str,
    	strat: strat,
    	strax: strax,
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
    	sys: sys,
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
    	weth: weth,
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
    	"sym-weth": "sym-eth",
    	"cur-eth": "sym-eth",
    	"sym-eth2-s": "sym-eth-s",
    	"sym-eth2s-s": "sym-eth-s",
    	"sym-eth2.s-s": "sym-eth-s",
    	"sym-weth-s": "sym-eth-s",
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
    	"exc-comex": "exc-cme",
    	"exc-comex-s": "exc-cme-s",
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
