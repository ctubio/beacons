
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

    var ustc = "fa4a";
    var beacons = {
    	"exc-_default-s": "f101",
    	"exc-_default": "f102",
    	"sym-_default-s": "f168",
    	"sym-_default": "f169",
    	"sym-d": "f169",
    	"sym-d-s": "f168",
    	"sym-default": "f169",
    	"sym-default-s": "f168",
    	"exc-d": "f102",
    	"exc-d-s": "f101",
    	"exc-default": "f102",
    	"exc-default-s": "f101",
    	"cur-default": "f169",
    	"cur-default-s": "f168",
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
    	"exc-crypto-com-s": "f131",
    	"exc-cryptofacilities-s": "f132",
    	"exc-cryptofacilities": "f133",
    	"exc-deribit-s": "f134",
    	"exc-deribit": "f135",
    	"exc-dex-aggregated-s": "f136",
    	"exc-dex-aggregated": "f137",
    	"exc-gateio-s": "f138",
    	"exc-gateio": "f139",
    	"exc-hitbtc-s": "f13a",
    	"exc-hitbtc": "f13b",
    	"exc-kucoin-s": "f13c",
    	"exc-kucoin": "f13d",
    	"exc-liquid-s": "f13e",
    	"exc-liquid": "f13f",
    	"exc-luno-s": "f140",
    	"exc-luno": "f141",
    	"exc-mtgox-s": "f142",
    	"exc-mtgox": "f143",
    	"exc-mxc-s": "f144",
    	"exc-mxc": "f145",
    	"exc-nbatopshop-s": "f146",
    	"exc-nbatopshop": "f147",
    	"exc-nymex-s": "f148",
    	"exc-nymex": "f149",
    	"exc-okcoin-s": "f14a",
    	"exc-okcoin": "f14b",
    	"exc-okx-s": "f14c",
    	"exc-okx": "f14d",
    	"exc-opensea-s": "f14e",
    	"exc-opensea": "f14f",
    	"exc-poloniex-s": "f150",
    	"exc-poloniex": "f151",
    	"exc-qryptos-s": "f152",
    	"exc-qryptos": "f153",
    	"exc-quadrigacx-s": "f154",
    	"exc-quadrigacx": "f155",
    	"exc-quick-s": "f156",
    	"exc-quick": "f157",
    	"exc-quoine-s": "f158",
    	"exc-quoine": "f159",
    	"exc-rarible-s": "f15a",
    	"exc-rarible": "f15b",
    	"exc-totle-s": "f15c",
    	"exc-totle": "f15d",
    	"exc-upbit-s": "f15e",
    	"exc-upbit": "f15f",
    	"exc-vaultofsatoshi-s": "f160",
    	"exc-vaultofsatoshi": "f161",
    	"exc-wex-s": "f162",
    	"exc-wex": "f163",
    	"exc-zaif-s": "f164",
    	"exc-zaif": "f165",
    	"exc-zonda-s": "f166",
    	"exc-zonda": "f167",
    	"sym-1inch-s": "f16a",
    	"sym-1inch": "f16b",
    	"sym-1st-s": "f16c",
    	"sym-1st": "f16d",
    	"sym-6a-s": "f16e",
    	"sym-6a": "f16f",
    	"sym-6b-s": "f170",
    	"sym-6b": "f171",
    	"sym-6c-s": "f172",
    	"sym-6c": "f173",
    	"sym-6e-s": "f174",
    	"sym-6e": "f175",
    	"sym-6j-s": "f176",
    	"sym-6j": "f177",
    	"sym-6l-s": "f178",
    	"sym-6l": "f179",
    	"sym-6m-s": "f17a",
    	"sym-6m": "f17b",
    	"sym-6n-s": "f17c",
    	"sym-6n": "f17d",
    	"sym-6s-s": "f17e",
    	"sym-6s": "f17f",
    	"sym-a38-s": "f180",
    	"sym-a38": "f181",
    	"sym-aac-s": "f182",
    	"sym-aac": "f183",
    	"sym-aave-s": "f184",
    	"sym-aave": "f185",
    	"sym-abbc-s": "f186",
    	"sym-abbc": "f187",
    	"sym-abt-s": "f188",
    	"sym-abt": "f189",
    	"sym-abyss-s": "f18a",
    	"sym-abyss": "f18b",
    	"sym-aca-s": "f18c",
    	"sym-aca": "f18d",
    	"sym-acat-s": "f18e",
    	"sym-acat": "f18f",
    	"sym-ach-s": "f190",
    	"sym-ach": "f191",
    	"sym-act-s": "f192",
    	"sym-act": "f193",
    	"sym-ad0-s": "f194",
    	"sym-ad0": "f195",
    	"sym-ada-s": "f196",
    	"sym-ada": "f197",
    	"sym-adel-s": "f198",
    	"sym-adel": "f199",
    	"sym-adh-s": "f19a",
    	"sym-adh": "f19b",
    	"sym-adm-s": "f19c",
    	"sym-adm": "f19d",
    	"sym-ado-s": "f19e",
    	"sym-ado": "f19f",
    	"sym-adt-s": "f1a0",
    	"sym-adt": "f1a1",
    	"sym-adx-s": "f1a2",
    	"sym-adx": "f1a3",
    	"sym-ae-s": "f1a4",
    	"sym-ae": "f1a5",
    	"sym-aed-s": "f1a6",
    	"sym-aed": "f1a7",
    	"sym-aeon-s": "f1a8",
    	"sym-aeon": "f1a9",
    	"sym-aep-s": "f1aa",
    	"sym-aep": "f1ab",
    	"sym-aergo-s": "f1ac",
    	"sym-aergo": "f1ad",
    	"sym-agi-s": "f1ae",
    	"sym-agi": "f1af",
    	"sym-agld-s": "f1b0",
    	"sym-agld": "f1b1",
    	"sym-aid-s": "f1b2",
    	"sym-aid": "f1b3",
    	"sym-aion-s": "f1b4",
    	"sym-aion": "f1b5",
    	"sym-air-s": "f1b6",
    	"sym-air": "f1b7",
    	"sym-akro-s": "f1b8",
    	"sym-akro": "f1b9",
    	"sym-akt-s": "f1ba",
    	"sym-akt": "f1bb",
    	"sym-alcx-s": "f1bc",
    	"sym-alcx": "f1bd",
    	"sym-aleph-s": "f1be",
    	"sym-aleph": "f1bf",
    	"sym-algo-s": "f1c0",
    	"sym-algo": "f1c1",
    	"sym-ali-s": "f1c2",
    	"sym-ali": "f1c3",
    	"sym-alice-s": "f1c4",
    	"sym-alice": "f1c5",
    	"sym-alpha-s": "f1c6",
    	"sym-alpha": "f1c7",
    	"sym-amb-s": "f1c8",
    	"sym-amb": "f1c9",
    	"sym-amlt-s": "f1ca",
    	"sym-amlt": "f1cb",
    	"sym-amp-s": "f1cc",
    	"sym-amp": "f1cd",
    	"sym-ampl-s": "f1ce",
    	"sym-ampl": "f1cf",
    	"sym-anc-s": "f1d0",
    	"sym-anc": "f1d1",
    	"sym-anct-s": "f1d2",
    	"sym-anct": "f1d3",
    	"sym-ankr-s": "f1d4",
    	"sym-ankr": "f1d5",
    	"sym-ant-s": "f1d6",
    	"sym-ant": "f1d7",
    	"sym-ape-s": "f1d8",
    	"sym-ape": "f1d9",
    	"sym-api3-s": "f1da",
    	"sym-api3": "f1db",
    	"sym-apis-s": "f1dc",
    	"sym-apis": "f1dd",
    	"sym-appc-s": "f1de",
    	"sym-appc": "f1df",
    	"sym-aptos-s": "f1e0",
    	"sym-aptos": "f1e1",
    	"sym-ar-s": "f1e2",
    	"sym-ar": "f1e3",
    	"sym-arbi-s": "f1e4",
    	"sym-arbi": "f1e5",
    	"sym-ardr-s": "f1e6",
    	"sym-ardr": "f1e7",
    	"sym-ark-s": "f1e8",
    	"sym-ark": "f1e9",
    	"sym-arn-s": "f1ea",
    	"sym-arn": "f1eb",
    	"sym-arpa-s": "f1ec",
    	"sym-arpa": "f1ed",
    	"sym-art-s": "f1ee",
    	"sym-art": "f1ef",
    	"sym-aspt-s": "f1f0",
    	"sym-aspt": "f1f1",
    	"sym-ast-s": "f1f2",
    	"sym-ast": "f1f3",
    	"sym-astr-s": "f1f4",
    	"sym-astr": "f1f5",
    	"sym-at-s": "f1f6",
    	"sym-at": "f1f7",
    	"sym-atlas-s": "f1f8",
    	"sym-atlas": "f1f9",
    	"sym-atm-s": "f1fa",
    	"sym-atm": "f1fb",
    	"sym-atom-s": "f1fc",
    	"sym-atom": "f1fd",
    	"sym-atp-s": "f1fe",
    	"sym-atp": "f1ff",
    	"sym-atri-s": "f200",
    	"sym-atri": "f201",
    	"sym-auction-s": "f202",
    	"sym-auction": "f203",
    	"sym-aud-s": "f204",
    	"sym-aud": "f205",
    	"sym-audio-s": "f206",
    	"sym-audio": "f207",
    	"sym-aup-s": "f208",
    	"sym-aup": "f209",
    	"sym-aury-s": "f20a",
    	"sym-aury": "f20b",
    	"sym-ausd-s": "f20c",
    	"sym-ausd": "f20d",
    	"sym-auto-s": "f20e",
    	"sym-auto": "f20f",
    	"sym-ava-s": "f210",
    	"sym-ava": "f211",
    	"sym-avax-s": "f212",
    	"sym-avax": "f213",
    	"sym-avt-s": "f214",
    	"sym-avt": "f215",
    	"sym-axl-s": "f216",
    	"sym-axl": "f217",
    	"sym-axpr-s": "f218",
    	"sym-axpr": "f219",
    	"sym-axs-s": "f21a",
    	"sym-axs": "f21b",
    	"sym-b": "f21c",
    	"sym-b0-s": "f21d",
    	"sym-b0": "f21e",
    	"sym-b2g-s": "f21f",
    	"sym-b2g": "f220",
    	"sym-bab-s": "f221",
    	"sym-bab": "f222",
    	"sym-badger-s": "f223",
    	"sym-badger": "f224",
    	"sym-bake-s": "f225",
    	"sym-bake": "f226",
    	"sym-bal-s": "f227",
    	"sym-bal": "f228",
    	"sym-banca-s": "f229",
    	"sym-banca": "f22a",
    	"sym-band-s": "f22b",
    	"sym-band": "f22c",
    	"sym-bat-s": "f22d",
    	"sym-bat": "f22e",
    	"sym-bay-s": "f22f",
    	"sym-bay": "f230",
    	"sym-bbc-s": "f231",
    	"sym-bbc": "f232",
    	"sym-bcc-s": "f233",
    	"sym-bcc": "f234",
    	"sym-bcd-s": "f235",
    	"sym-bcd": "f236",
    	"sym-bch-s": "f237",
    	"sym-bch": "f238",
    	"sym-bci-s": "f239",
    	"sym-bci": "f23a",
    	"sym-bcn-s": "f23b",
    	"sym-bcn": "f23c",
    	"sym-bcpt-s": "f23d",
    	"sym-bcpt": "f23e",
    	"sym-bcu-s": "f23f",
    	"sym-bcu": "f240",
    	"sym-bcv-s": "f241",
    	"sym-bcv": "f242",
    	"sym-bcy-s": "f243",
    	"sym-bcy": "f244",
    	"sym-bdg-s": "f245",
    	"sym-bdg": "f246",
    	"sym-beam-s": "f247",
    	"sym-beam": "f248",
    	"sym-beet-s": "f249",
    	"sym-beet": "f24a",
    	"sym-bel-s": "f24b",
    	"sym-bel": "f24c",
    	"sym-bela-s": "f24d",
    	"sym-bela": "f24e",
    	"sym-berry-s": "f24f",
    	"sym-berry": "f250",
    	"sym-beta-s": "f251",
    	"sym-beta": "f252",
    	"sym-betr-s": "f253",
    	"sym-betr": "f254",
    	"sym-bez-s": "f255",
    	"sym-bez": "f256",
    	"sym-bft-s": "f257",
    	"sym-bft": "f258",
    	"sym-bfx-s": "f259",
    	"sym-bfx": "f25a",
    	"sym-bhd-s": "f25b",
    	"sym-bhd": "f25c",
    	"sym-bht-s": "f25d",
    	"sym-bht": "f25e",
    	"sym-bico-s": "f25f",
    	"sym-bico": "f260",
    	"sym-bit-s": "f261",
    	"sym-bit": "f262",
    	"sym-bitb-s": "f263",
    	"sym-bitb": "f264",
    	"sym-bix-s": "f265",
    	"sym-bix": "f266",
    	"sym-bk-s": "f267",
    	"sym-bk": "f268",
    	"sym-bkx-s": "f269",
    	"sym-bkx": "f26a",
    	"sym-blk-s": "f26b",
    	"sym-blk": "f26c",
    	"sym-block-s": "f26d",
    	"sym-block": "f26e",
    	"sym-blok-s": "f26f",
    	"sym-blok": "f270",
    	"sym-blt-s": "f271",
    	"sym-blt": "f272",
    	"sym-blz-s": "f273",
    	"sym-blz": "f274",
    	"sym-bmc-s": "f275",
    	"sym-bmc": "f276",
    	"sym-bnb-s": "f277",
    	"sym-bnb": "f278",
    	"sym-bnc-s": "f279",
    	"sym-bnc": "f27a",
    	"sym-bnk-s": "f27b",
    	"sym-bnk": "f27c",
    	"sym-bnt-s": "f27d",
    	"sym-bnt": "f27e",
    	"sym-bo-s": "f27f",
    	"sym-bo": "f280",
    	"sym-boba-s": "f281",
    	"sym-boba": "f282",
    	"sym-bond-s": "f283",
    	"sym-bond": "f284",
    	"sym-boo-s": "f285",
    	"sym-boo": "f286",
    	"sym-bor-s": "f287",
    	"sym-bor": "f288",
    	"sym-bora-s": "f289",
    	"sym-bora": "f28a",
    	"sym-bos-s": "f28b",
    	"sym-bos": "f28c",
    	"sym-box-s": "f28d",
    	"sym-box": "f28e",
    	"sym-brd-s": "f28f",
    	"sym-brd": "f290",
    	"sym-breed-s": "f291",
    	"sym-breed": "f292",
    	"sym-brg-s": "f293",
    	"sym-brg": "f294",
    	"sym-brick-s": "f295",
    	"sym-brick": "f296",
    	"sym-bsd-s": "f297",
    	"sym-bsd": "f298",
    	"sym-bsv-s": "f299",
    	"sym-bsv": "f29a",
    	"sym-bsx-s": "f29b",
    	"sym-bsx": "f29c",
    	"sym-bt1-s": "f29d",
    	"sym-bt1": "f29e",
    	"sym-bt2-s": "f29f",
    	"sym-bt2": "f2a0",
    	"sym-btc-s": "f2a1",
    	"sym-btc": "f2a2",
    	"sym-btcd-s": "f2a3",
    	"sym-btcd": "f2a4",
    	"sym-btcfx-s": "f2a5",
    	"sym-btcfx": "f2a6",
    	"sym-btcp-s": "f2a7",
    	"sym-btcp": "f2a8",
    	"sym-btg-s": "f2a9",
    	"sym-btg": "f2aa",
    	"sym-btm-s": "f2ab",
    	"sym-btm": "f2ac",
    	"sym-btn-s": "f2ad",
    	"sym-btn": "f2ae",
    	"sym-bto-s": "f2af",
    	"sym-bto": "f2b0",
    	"sym-btrst-s": "f2b1",
    	"sym-btrst": "f2b2",
    	"sym-bts-s": "f2b3",
    	"sym-bts": "f2b4",
    	"sym-btt-s": "f2b5",
    	"sym-btt": "f2b6",
    	"sym-btu-s": "f2b7",
    	"sym-btu": "f2b8",
    	"sym-btx-s": "f2b9",
    	"sym-btx": "f2ba",
    	"sym-burger-s": "f2bb",
    	"sym-burger": "f2bc",
    	"sym-burst-s": "f2bd",
    	"sym-burst": "f2be",
    	"sym-bus-s": "f2bf",
    	"sym-bus": "f2c0",
    	"sym-busd-s": "f2c1",
    	"sym-busd": "f2c2",
    	"sym-bwx-s": "f2c3",
    	"sym-bwx": "f2c4",
    	"sym-bz-s": "f2c5",
    	"sym-bz": "f2c6",
    	"sym-bzrx-s": "f2c7",
    	"sym-bzrx": "f2c8",
    	"sym-c-s": "f2c9",
    	"sym-c": "f2ca",
    	"sym-c20-s": "f2cb",
    	"sym-c20": "f2cc",
    	"sym-c98-s": "f2cd",
    	"sym-c98": "f2ce",
    	"sym-cad-s": "f2cf",
    	"sym-cad": "f2d0",
    	"sym-cake-s": "f2d1",
    	"sym-cake": "f2d2",
    	"sym-cas-s": "f2d3",
    	"sym-cas": "f2d4",
    	"sym-cat-s": "f2d5",
    	"sym-cat": "f2d6",
    	"sym-cbc-s": "f2d7",
    	"sym-cbc": "f2d8",
    	"sym-cbt-s": "f2d9",
    	"sym-cbt": "f2da",
    	"sym-cdt-s": "f2db",
    	"sym-cdt": "f2dc",
    	"sym-cel-s": "f2dd",
    	"sym-cel": "f2de",
    	"sym-celo-s": "f2df",
    	"sym-celo": "f2e0",
    	"sym-celr-s": "f2e1",
    	"sym-celr": "f2e2",
    	"sym-cennz-s": "f2e3",
    	"sym-cennz": "f2e4",
    	"sym-cfg-s": "f2e5",
    	"sym-cfg": "f2e6",
    	"sym-cfi-s": "f2e7",
    	"sym-cfi": "f2e8",
    	"sym-cfx-s": "f2e9",
    	"sym-cfx": "f2ea",
    	"sym-cgt-s": "f2eb",
    	"sym-cgt": "f2ec",
    	"sym-chat-s": "f2ed",
    	"sym-chat": "f2ee",
    	"sym-chf-s": "f2ef",
    	"sym-chf": "f2f0",
    	"sym-chp-s": "f2f1",
    	"sym-chp": "f2f2",
    	"sym-chr-s": "f2f3",
    	"sym-chr": "f2f4",
    	"sym-chsb-s": "f2f5",
    	"sym-chsb": "f2f6",
    	"sym-chx-s": "f2f7",
    	"sym-chx": "f2f8",
    	"sym-chz-s": "f2f9",
    	"sym-chz": "f2fa",
    	"sym-ckb-s": "f2fb",
    	"sym-ckb": "f2fc",
    	"sym-cl-s": "f2fd",
    	"sym-cl": "f2fe",
    	"sym-clam-s": "f2ff",
    	"sym-clam": "f300",
    	"sym-cln-s": "f301",
    	"sym-cln": "f302",
    	"sym-clo-s": "f303",
    	"sym-clo": "f304",
    	"sym-cloak-s": "f305",
    	"sym-cloak": "f306",
    	"sym-clv-s": "f307",
    	"sym-clv": "f308",
    	"sym-cmct-s": "f309",
    	"sym-cmct": "f30a",
    	"sym-cmt-s": "f30b",
    	"sym-cmt": "f30c",
    	"sym-cnd-s": "f30d",
    	"sym-cnd": "f30e",
    	"sym-cnn-s": "f30f",
    	"sym-cnn": "f310",
    	"sym-cnx-s": "f311",
    	"sym-cnx": "f312",
    	"sym-cny-s": "f313",
    	"sym-cny": "f314",
    	"sym-cob-s": "f315",
    	"sym-cob": "f316",
    	"sym-cocos-s": "f317",
    	"sym-cocos": "f318",
    	"sym-comp-s": "f319",
    	"sym-comp": "f31a",
    	"sym-cope-s": "f31b",
    	"sym-cope": "f31c",
    	"sym-cos-s": "f31d",
    	"sym-cos": "f31e",
    	"sym-cosm-s": "f31f",
    	"sym-cosm": "f320",
    	"sym-coss-s": "f321",
    	"sym-coss": "f322",
    	"sym-coti-s": "f323",
    	"sym-coti": "f324",
    	"sym-cov-s": "f325",
    	"sym-cov": "f326",
    	"sym-cova-s": "f327",
    	"sym-cova": "f328",
    	"sym-cpt-s": "f329",
    	"sym-cpt": "f32a",
    	"sym-cpx-s": "f32b",
    	"sym-cpx": "f32c",
    	"sym-cqt-s": "f32d",
    	"sym-cqt": "f32e",
    	"sym-cra-s": "f32f",
    	"sym-cra": "f330",
    	"sym-crab-s": "f331",
    	"sym-crab": "f332",
    	"sym-crc-s": "f333",
    	"sym-crc": "f334",
    	"sym-cre-s": "f335",
    	"sym-cre": "f336",
    	"sym-cream-s": "f337",
    	"sym-cream": "f338",
    	"sym-cring-s": "f339",
    	"sym-cring": "f33a",
    	"sym-cro-s": "f33b",
    	"sym-cro": "f33c",
    	"sym-crpt-s": "f33d",
    	"sym-crpt": "f33e",
    	"sym-cru-s": "f33f",
    	"sym-cru": "f340",
    	"sym-crust-s": "f341",
    	"sym-crust": "f342",
    	"sym-crv-s": "f343",
    	"sym-crv": "f344",
    	"sym-crw-s": "f345",
    	"sym-crw": "f346",
    	"sym-crypto-com": "f347",
    	"sym-csm-s": "f348",
    	"sym-csm": "f349",
    	"sym-csx-s": "f34a",
    	"sym-csx": "f34b",
    	"sym-ctc-s": "f34c",
    	"sym-ctc": "f34d",
    	"sym-ctk-s": "f34e",
    	"sym-ctk": "f34f",
    	"sym-ctsi-s": "f350",
    	"sym-ctsi": "f351",
    	"sym-ctxc-s": "f352",
    	"sym-ctxc": "f353",
    	"sym-cult-s": "f354",
    	"sym-cult": "f355",
    	"sym-cur-s": "f356",
    	"sym-cur": "f357",
    	"sym-cvc-s": "f358",
    	"sym-cvc": "f359",
    	"sym-cvcoin-s": "f35a",
    	"sym-cvcoin": "f35b",
    	"sym-cvnt-s": "f35c",
    	"sym-cvnt": "f35d",
    	"sym-cvp-s": "f35e",
    	"sym-cvp": "f35f",
    	"sym-cvt-s": "f360",
    	"sym-cvt": "f361",
    	"sym-cvx-s": "f362",
    	"sym-cvx": "f363",
    	"sym-cw-s": "f364",
    	"sym-cw": "f365",
    	"sym-cyc-s": "f366",
    	"sym-cyc": "f367",
    	"sym-dac-s": "f368",
    	"sym-dac": "f369",
    	"sym-dacs-s": "f36a",
    	"sym-dacs": "f36b",
    	"sym-dadi-s": "f36c",
    	"sym-dadi": "f36d",
    	"sym-dag-s": "f36e",
    	"sym-dag": "f36f",
    	"sym-dai-s": "f370",
    	"sym-dai": "f371",
    	"sym-dao-s": "f372",
    	"sym-dao": "f373",
    	"sym-dar-s": "f374",
    	"sym-dar": "f375",
    	"sym-dash-s": "f376",
    	"sym-dash": "f377",
    	"sym-dat-s": "f378",
    	"sym-dat": "f379",
    	"sym-data-s": "f37a",
    	"sym-data": "f37b",
    	"sym-datx-s": "f37c",
    	"sym-datx": "f37d",
    	"sym-dbc-s": "f37e",
    	"sym-dbc": "f37f",
    	"sym-dbet-s": "f380",
    	"sym-dbet": "f381",
    	"sym-dbix-s": "f382",
    	"sym-dbix": "f383",
    	"sym-dcn-s": "f384",
    	"sym-dcn": "f385",
    	"sym-dcr-s": "f386",
    	"sym-dcr": "f387",
    	"sym-dct-s": "f388",
    	"sym-dct": "f389",
    	"sym-ddd-s": "f38a",
    	"sym-ddd": "f38b",
    	"sym-dego-s": "f38c",
    	"sym-dego": "f38d",
    	"sym-dent-s": "f38e",
    	"sym-dent": "f38f",
    	"sym-dext-s": "f390",
    	"sym-dext": "f391",
    	"sym-dgb-s": "f392",
    	"sym-dgb": "f393",
    	"sym-dgd-s": "f394",
    	"sym-dgd": "f395",
    	"sym-dgtx-s": "f396",
    	"sym-dgtx": "f397",
    	"sym-dgx-s": "f398",
    	"sym-dgx": "f399",
    	"sym-dhx-s": "f39a",
    	"sym-dhx": "f39b",
    	"sym-dia-s": "f39c",
    	"sym-dia": "f39d",
    	"sym-dice-s": "f39e",
    	"sym-dice": "f39f",
    	"sym-dim-s": "f3a0",
    	"sym-dim": "f3a1",
    	"sym-dlt-s": "f3a2",
    	"sym-dlt": "f3a3",
    	"sym-dmd-s": "f3a4",
    	"sym-dmd": "f3a5",
    	"sym-dmt-s": "f3a6",
    	"sym-dmt": "f3a7",
    	"sym-dnt-s": "f3a8",
    	"sym-dnt": "f3a9",
    	"sym-dock-s": "f3aa",
    	"sym-dock": "f3ab",
    	"sym-dodo-s": "f3ac",
    	"sym-dodo": "f3ad",
    	"sym-doge-s": "f3ae",
    	"sym-doge": "f3af",
    	"sym-dose-s": "f3b0",
    	"sym-dose": "f3b1",
    	"sym-dot-s": "f3b2",
    	"sym-dot": "f3b3",
    	"sym-dpx-s": "f3b4",
    	"sym-dpx": "f3b5",
    	"sym-dpy-s": "f3b6",
    	"sym-dpy": "f3b7",
    	"sym-dream-s": "f3b8",
    	"sym-dream": "f3b9",
    	"sym-drep-s": "f3ba",
    	"sym-drep": "f3bb",
    	"sym-drg-s": "f3bc",
    	"sym-drg": "f3bd",
    	"sym-drgn-s": "f3be",
    	"sym-drgn": "f3bf",
    	"sym-drt-s": "f3c0",
    	"sym-drt": "f3c1",
    	"sym-dta-s": "f3c2",
    	"sym-dta": "f3c3",
    	"sym-dtb-s": "f3c4",
    	"sym-dtb": "f3c5",
    	"sym-dtr-s": "f3c6",
    	"sym-dtr": "f3c7",
    	"sym-dusk-s": "f3c8",
    	"sym-dusk": "f3c9",
    	"sym-dx-s": "f3ca",
    	"sym-dx": "f3cb",
    	"sym-dydx-s": "f3cc",
    	"sym-dydx": "f3cd",
    	"sym-dyn-s": "f3ce",
    	"sym-dyn": "f3cf",
    	"sym-easy": "f3d0",
    	"sym-ecom-s": "f3d1",
    	"sym-ecom": "f3d2",
    	"sym-edc-s": "f3d3",
    	"sym-edc": "f3d4",
    	"sym-edg-s": "f3d5",
    	"sym-edg": "f3d6",
    	"sym-edo-s": "f3d7",
    	"sym-edo": "f3d8",
    	"sym-edp-s": "f3d9",
    	"sym-edp": "f3da",
    	"sym-edr-s": "f3db",
    	"sym-edr": "f3dc",
    	"sym-efi-s": "f3dd",
    	"sym-efi": "f3de",
    	"sym-egld-s": "f3df",
    	"sym-egld": "f3e0",
    	"sym-egt-s": "f3e1",
    	"sym-egt": "f3e2",
    	"sym-ehr-s": "f3e3",
    	"sym-ehr": "f3e4",
    	"sym-eko-s": "f3e5",
    	"sym-eko": "f3e6",
    	"sym-ekt-s": "f3e7",
    	"sym-ekt": "f3e8",
    	"sym-ela-s": "f3e9",
    	"sym-ela": "f3ea",
    	"sym-elec-s": "f3eb",
    	"sym-elec": "f3ec",
    	"sym-elf-s": "f3ed",
    	"sym-elf": "f3ee",
    	"sym-em-s": "f3ef",
    	"sym-em": "f3f0",
    	"sym-emc-s": "f3f1",
    	"sym-emc": "f3f2",
    	"sym-emc2-s": "f3f3",
    	"sym-emc2": "f3f4",
    	"sym-eng-s": "f3f5",
    	"sym-eng": "f3f6",
    	"sym-enj-s": "f3f7",
    	"sym-enj": "f3f8",
    	"sym-ens-s": "f3f9",
    	"sym-ens": "f3fa",
    	"sym-eos-s": "f3fb",
    	"sym-eos": "f3fc",
    	"sym-eosdac-s": "f3fd",
    	"sym-eosdac": "f3fe",
    	"sym-eq-s": "f3ff",
    	"sym-eq": "f400",
    	"sym-erd-s": "f401",
    	"sym-erd": "f402",
    	"sym-ern-s": "f403",
    	"sym-ern": "f404",
    	"sym-es": "f405",
    	"sym-es-s": "f406",
    	"sym-esd-s": "f407",
    	"sym-esd": "f408",
    	"sym-etc-s": "f409",
    	"sym-etc": "f40a",
    	"sym-eth-s": "f40b",
    	"sym-eth": "f40c",
    	"sym-ethup-s": "f40d",
    	"sym-ethup": "f40e",
    	"sym-ethw-s": "f40f",
    	"sym-ethw": "f410",
    	"sym-etn-s": "f411",
    	"sym-etn": "f412",
    	"sym-etp-s": "f413",
    	"sym-etp": "f414",
    	"sym-eul-s": "f415",
    	"sym-eul": "f416",
    	"sym-eur-s": "f417",
    	"sym-eur": "f418",
    	"sym-euroc-s": "f419",
    	"sym-euroc": "f41a",
    	"sym-eurs-s": "f41b",
    	"sym-eurs": "f41c",
    	"sym-eurt-s": "f41d",
    	"sym-eurt": "f41e",
    	"sym-evn-s": "f41f",
    	"sym-evn": "f420",
    	"sym-evx-s": "f421",
    	"sym-evx": "f422",
    	"sym-ewt-s": "f423",
    	"sym-ewt": "f424",
    	"sym-exp-s": "f425",
    	"sym-exp": "f426",
    	"sym-exrd-s": "f427",
    	"sym-exrd": "f428",
    	"sym-exy-s": "f429",
    	"sym-exy": "f42a",
    	"sym-ez-s": "f42b",
    	"sym-ez": "f42c",
    	"sym-fair-s": "f42d",
    	"sym-fair": "f42e",
    	"sym-farm-s": "f42f",
    	"sym-farm": "f430",
    	"sym-fct-s": "f431",
    	"sym-fct": "f432",
    	"sym-fdz-s": "f433",
    	"sym-fdz": "f434",
    	"sym-fee-s": "f435",
    	"sym-fee": "f436",
    	"sym-fet-s": "f437",
    	"sym-fet": "f438",
    	"sym-fida-s": "f439",
    	"sym-fida": "f43a",
    	"sym-fil-s": "f43b",
    	"sym-fil": "f43c",
    	"sym-fio-s": "f43d",
    	"sym-fio": "f43e",
    	"sym-firo-s": "f43f",
    	"sym-firo": "f440",
    	"sym-fis-s": "f441",
    	"sym-fis": "f442",
    	"sym-fldc-s": "f443",
    	"sym-fldc": "f444",
    	"sym-flo-s": "f445",
    	"sym-flo": "f446",
    	"sym-floki-s": "f447",
    	"sym-floki": "f448",
    	"sym-flow-s": "f449",
    	"sym-flow": "f44a",
    	"sym-flr-s": "f44b",
    	"sym-flr": "f44c",
    	"sym-flux-s": "f44d",
    	"sym-flux": "f44e",
    	"sym-fluz-s": "f44f",
    	"sym-fluz": "f450",
    	"sym-fnb-s": "f451",
    	"sym-fnb": "f452",
    	"sym-foam-s": "f453",
    	"sym-foam": "f454",
    	"sym-for-s": "f455",
    	"sym-for": "f456",
    	"sym-forth-s": "f457",
    	"sym-forth": "f458",
    	"sym-fota-s": "f459",
    	"sym-fota": "f45a",
    	"sym-fox-s": "f45b",
    	"sym-fox": "f45c",
    	"sym-fpis-s": "f45d",
    	"sym-fpis": "f45e",
    	"sym-frax-s": "f45f",
    	"sym-frax": "f460",
    	"sym-front-s": "f461",
    	"sym-front": "f462",
    	"sym-fsn-s": "f463",
    	"sym-fsn": "f464",
    	"sym-ftc-s": "f465",
    	"sym-ftc": "f466",
    	"sym-fti-s": "f467",
    	"sym-fti": "f468",
    	"sym-ftm-s": "f469",
    	"sym-ftm": "f46a",
    	"sym-ftt-s": "f46b",
    	"sym-ftt": "f46c",
    	"sym-ftx-s": "f46d",
    	"sym-ftx": "f46e",
    	"sym-fuel-s": "f46f",
    	"sym-fuel": "f470",
    	"sym-fun-s": "f471",
    	"sym-fun": "f472",
    	"sym-fx-s": "f473",
    	"sym-fx": "f474",
    	"sym-fxc-s": "f475",
    	"sym-fxc": "f476",
    	"sym-fxs-s": "f477",
    	"sym-fxs": "f478",
    	"sym-fxt-s": "f479",
    	"sym-fxt": "f47a",
    	"sym-gal-s": "f47b",
    	"sym-gal": "f47c",
    	"sym-gala-s": "f47d",
    	"sym-gala": "f47e",
    	"sym-game-s": "f47f",
    	"sym-game": "f480",
    	"sym-gamee-s": "f481",
    	"sym-gamee": "f482",
    	"sym-gard-s": "f483",
    	"sym-gard": "f484",
    	"sym-gari-s": "f485",
    	"sym-gari": "f486",
    	"sym-gas-s": "f487",
    	"sym-gas": "f488",
    	"sym-gbc-s": "f489",
    	"sym-gbc": "f48a",
    	"sym-gbp-s": "f48b",
    	"sym-gbp": "f48c",
    	"sym-gbx-s": "f48d",
    	"sym-gbx": "f48e",
    	"sym-gbyte-s": "f48f",
    	"sym-gbyte": "f490",
    	"sym-gc-s": "f491",
    	"sym-gc": "f492",
    	"sym-gcc-s": "f493",
    	"sym-gcc": "f494",
    	"sym-ge-s": "f495",
    	"sym-ge": "f496",
    	"sym-geist-s": "f497",
    	"sym-geist": "f498",
    	"sym-gen-s": "f499",
    	"sym-gen": "f49a",
    	"sym-gene-s": "f49b",
    	"sym-gene": "f49c",
    	"sym-gens-s": "f49d",
    	"sym-gens": "f49e",
    	"sym-get-s": "f49f",
    	"sym-get": "f4a0",
    	"sym-ghst-s": "f4a1",
    	"sym-ghst": "f4a2",
    	"sym-glc-s": "f4a3",
    	"sym-glc": "f4a4",
    	"sym-gld-s": "f4a5",
    	"sym-gld": "f4a6",
    	"sym-glm-s": "f4a7",
    	"sym-glm": "f4a8",
    	"sym-glmr-s": "f4a9",
    	"sym-glmr": "f4aa",
    	"sym-gmat-s": "f4ab",
    	"sym-gmat": "f4ac",
    	"sym-gmt-s": "f4ad",
    	"sym-gmt": "f4ae",
    	"sym-gmt2-s": "f4af",
    	"sym-gmt2": "f4b0",
    	"sym-gmx-s": "f4b1",
    	"sym-gmx": "f4b2",
    	"sym-gno-s": "f4b3",
    	"sym-gno": "f4b4",
    	"sym-gnt-s": "f4b5",
    	"sym-gnt": "f4b6",
    	"sym-gnx-s": "f4b7",
    	"sym-gnx": "f4b8",
    	"sym-go-s": "f4b9",
    	"sym-go": "f4ba",
    	"sym-gods-s": "f4bb",
    	"sym-gods": "f4bc",
    	"sym-got-s": "f4bd",
    	"sym-got": "f4be",
    	"sym-grc-s": "f4bf",
    	"sym-grc": "f4c0",
    	"sym-grin-s": "f4c1",
    	"sym-grin": "f4c2",
    	"sym-grs-s": "f4c3",
    	"sym-grs": "f4c4",
    	"sym-grt-s": "f4c5",
    	"sym-grt": "f4c6",
    	"sym-gsc-s": "f4c7",
    	"sym-gsc": "f4c8",
    	"sym-gst-s": "f4c9",
    	"sym-gst": "f4ca",
    	"sym-gt-s": "f4cb",
    	"sym-gt": "f4cc",
    	"sym-gtc-s": "f4cd",
    	"sym-gtc": "f4ce",
    	"sym-gtc2-s": "f4cf",
    	"sym-gtc2": "f4d0",
    	"sym-gto-s": "f4d1",
    	"sym-gto": "f4d2",
    	"sym-gup-s": "f4d3",
    	"sym-gup": "f4d4",
    	"sym-gusd-s": "f4d5",
    	"sym-gusd": "f4d6",
    	"sym-gvt-s": "f4d7",
    	"sym-gvt": "f4d8",
    	"sym-gxc-s": "f4d9",
    	"sym-gxc": "f4da",
    	"sym-gxs-s": "f4db",
    	"sym-gxs": "f4dc",
    	"sym-hard-s": "f4dd",
    	"sym-hard": "f4de",
    	"sym-hbar-s": "f4df",
    	"sym-hbar": "f4e0",
    	"sym-hc-s": "f4e1",
    	"sym-hc": "f4e2",
    	"sym-hdx-s": "f4e3",
    	"sym-hdx": "f4e4",
    	"sym-hedg-s": "f4e5",
    	"sym-hedg": "f4e6",
    	"sym-hegic-s": "f4e7",
    	"sym-hegic": "f4e8",
    	"sym-hex-s": "f4e9",
    	"sym-hex": "f4ea",
    	"sym-hft-s": "f4eb",
    	"sym-hft": "f4ec",
    	"sym-hg-s": "f4ed",
    	"sym-hg": "f4ee",
    	"sym-hgs-s": "f4ef",
    	"sym-hgs": "f4f0",
    	"sym-hh-s": "f4f1",
    	"sym-hh": "f4f2",
    	"sym-high-s": "f4f3",
    	"sym-high": "f4f4",
    	"sym-hit-s": "f4f5",
    	"sym-hit": "f4f6",
    	"sym-hive-s": "f4f7",
    	"sym-hive": "f4f8",
    	"sym-hkd-s": "f4f9",
    	"sym-hkd": "f4fa",
    	"sym-hko-s": "f4fb",
    	"sym-hko": "f4fc",
    	"sym-hmq-s": "f4fd",
    	"sym-hmq": "f4fe",
    	"sym-hns-s": "f4ff",
    	"sym-hns": "f500",
    	"sym-ho-s": "f501",
    	"sym-ho": "f502",
    	"sym-hopr-s": "f503",
    	"sym-hopr": "f504",
    	"sym-hot-s": "f505",
    	"sym-hot": "f506",
    	"sym-hp-s": "f507",
    	"sym-hp": "f508",
    	"sym-hpb-s": "f509",
    	"sym-hpb": "f50a",
    	"sym-hpc-s": "f50b",
    	"sym-hpc": "f50c",
    	"sym-hpt-s": "f50d",
    	"sym-hpt": "f50e",
    	"sym-hrc-s": "f50f",
    	"sym-hrc": "f510",
    	"sym-hsc-s": "f511",
    	"sym-hsc": "f512",
    	"sym-hsr-s": "f513",
    	"sym-hsr": "f514",
    	"sym-hst-s": "f515",
    	"sym-hst": "f516",
    	"sym-ht-s": "f517",
    	"sym-ht": "f518",
    	"sym-html-s": "f519",
    	"sym-html": "f51a",
    	"sym-htt-s": "f51b",
    	"sym-htt": "f51c",
    	"sym-huc-s": "f51d",
    	"sym-huc": "f51e",
    	"sym-hunt-s": "f51f",
    	"sym-hunt": "f520",
    	"sym-hvn-s": "f521",
    	"sym-hvn": "f522",
    	"sym-hxro-s": "f523",
    	"sym-hxro": "f524",
    	"sym-hyc-s": "f525",
    	"sym-hyc": "f526",
    	"sym-hydra-s": "f527",
    	"sym-hydra": "f528",
    	"sym-hydro-s": "f529",
    	"sym-hydro": "f52a",
    	"sym-icn-s": "f52b",
    	"sym-icn": "f52c",
    	"sym-icos-s": "f52d",
    	"sym-icos": "f52e",
    	"sym-icp-s": "f52f",
    	"sym-icp": "f530",
    	"sym-icx-s": "f531",
    	"sym-icx": "f532",
    	"sym-idex-s": "f533",
    	"sym-idex": "f534",
    	"sym-idh-s": "f535",
    	"sym-idh": "f536",
    	"sym-idr-s": "f537",
    	"sym-idr": "f538",
    	"sym-ift-s": "f539",
    	"sym-ift": "f53a",
    	"sym-ignis-s": "f53b",
    	"sym-ignis": "f53c",
    	"sym-ihf-s": "f53d",
    	"sym-ihf": "f53e",
    	"sym-iht-s": "f53f",
    	"sym-iht": "f540",
    	"sym-ilc-s": "f541",
    	"sym-ilc": "f542",
    	"sym-ilv-s": "f543",
    	"sym-ilv": "f544",
    	"sym-imx-s": "f545",
    	"sym-imx": "f546",
    	"sym-incnt-s": "f547",
    	"sym-incnt": "f548",
    	"sym-ind-s": "f549",
    	"sym-ind": "f54a",
    	"sym-indi-s": "f54b",
    	"sym-indi": "f54c",
    	"sym-inj-s": "f54d",
    	"sym-inj": "f54e",
    	"sym-ink-s": "f54f",
    	"sym-ink": "f550",
    	"sym-inr-s": "f551",
    	"sym-inr": "f552",
    	"sym-ins-s": "f553",
    	"sym-ins": "f554",
    	"sym-int-s": "f555",
    	"sym-int": "f556",
    	"sym-intr-s": "f557",
    	"sym-intr": "f558",
    	"sym-ioc-s": "f559",
    	"sym-ioc": "f55a",
    	"sym-ion-s": "f55b",
    	"sym-ion": "f55c",
    	"sym-iost-s": "f55d",
    	"sym-iost": "f55e",
    	"sym-iot-s": "f55f",
    	"sym-iot": "f560",
    	"sym-iotx-s": "f561",
    	"sym-iotx": "f562",
    	"sym-iq-s": "f563",
    	"sym-iq": "f564",
    	"sym-iris-s": "f565",
    	"sym-iris": "f566",
    	"sym-itc-s": "f567",
    	"sym-itc": "f568",
    	"sym-ivy-s": "f569",
    	"sym-ivy": "f56a",
    	"sym-ixt-s": "f56b",
    	"sym-ixt": "f56c",
    	"sym-jasmy-s": "f56d",
    	"sym-jasmy": "f56e",
    	"sym-jnt-s": "f56f",
    	"sym-jnt": "f570",
    	"sym-joe-s": "f571",
    	"sym-joe": "f572",
    	"sym-jpeg-s": "f573",
    	"sym-jpeg": "f574",
    	"sym-jpy-s": "f575",
    	"sym-jpy": "f576",
    	"sym-jst-s": "f577",
    	"sym-jst": "f578",
    	"sym-juno-s": "f579",
    	"sym-juno": "f57a",
    	"sym-just-s": "f57b",
    	"sym-just": "f57c",
    	"sym-juv-s": "f57d",
    	"sym-juv": "f57e",
    	"sym-kan-s": "f57f",
    	"sym-kan": "f580",
    	"sym-kapex-s": "f581",
    	"sym-kapex": "f582",
    	"sym-kar-s": "f583",
    	"sym-kar": "f584",
    	"sym-kava-s": "f585",
    	"sym-kava": "f586",
    	"sym-kbc-s": "f587",
    	"sym-kbc": "f588",
    	"sym-kcash-s": "f589",
    	"sym-kcash": "f58a",
    	"sym-kda-s": "f58b",
    	"sym-kda": "f58c",
    	"sym-keep-s": "f58d",
    	"sym-keep": "f58e",
    	"sym-key-s": "f58f",
    	"sym-key": "f590",
    	"sym-kick-s": "f591",
    	"sym-kick": "f592",
    	"sym-kilt-s": "f593",
    	"sym-kilt": "f594",
    	"sym-kin-s": "f595",
    	"sym-kin": "f596",
    	"sym-kint-s": "f597",
    	"sym-kint": "f598",
    	"sym-klay-s": "f599",
    	"sym-klay": "f59a",
    	"sym-kma-s": "f59b",
    	"sym-kma": "f59c",
    	"sym-kmd-s": "f59d",
    	"sym-kmd": "f59e",
    	"sym-knc-s": "f59f",
    	"sym-knc": "f5a0",
    	"sym-kore-s": "f5a1",
    	"sym-kore": "f5a2",
    	"sym-kp3r-s": "f5a3",
    	"sym-kp3r": "f5a4",
    	"sym-krm-s": "f5a5",
    	"sym-krm": "f5a6",
    	"sym-krw-s": "f5a7",
    	"sym-krw": "f5a8",
    	"sym-ksm-s": "f5a9",
    	"sym-ksm": "f5aa",
    	"sym-ksx-s": "f5ab",
    	"sym-ksx": "f5ac",
    	"sym-kyl-s": "f5ad",
    	"sym-kyl": "f5ae",
    	"sym-la-s": "f5af",
    	"sym-la": "f5b0",
    	"sym-lak-s": "f5b1",
    	"sym-lak": "f5b2",
    	"sym-lamb-s": "f5b3",
    	"sym-lamb": "f5b4",
    	"sym-latx-s": "f5b5",
    	"sym-latx": "f5b6",
    	"sym-layr-s": "f5b7",
    	"sym-layr": "f5b8",
    	"sym-lba-s": "f5b9",
    	"sym-lba": "f5ba",
    	"sym-lbc-s": "f5bb",
    	"sym-lbc": "f5bc",
    	"sym-lcc-s": "f5bd",
    	"sym-lcc": "f5be",
    	"sym-lcx-s": "f5bf",
    	"sym-lcx": "f5c0",
    	"sym-ldo-s": "f5c1",
    	"sym-ldo": "f5c2",
    	"sym-lend-s": "f5c3",
    	"sym-lend": "f5c4",
    	"sym-leo-s": "f5c5",
    	"sym-leo": "f5c6",
    	"sym-leoc-s": "f5c7",
    	"sym-leoc": "f5c8",
    	"sym-let-s": "f5c9",
    	"sym-let": "f5ca",
    	"sym-life-s": "f5cb",
    	"sym-life": "f5cc",
    	"sym-lina-s": "f5cd",
    	"sym-lina": "f5ce",
    	"sym-link-s": "f5cf",
    	"sym-link": "f5d0",
    	"sym-lit-s": "f5d1",
    	"sym-lit": "f5d2",
    	"sym-lmc-s": "f5d3",
    	"sym-lmc": "f5d4",
    	"sym-lml-s": "f5d5",
    	"sym-lml": "f5d6",
    	"sym-lmwr-s": "f5d7",
    	"sym-lmwr": "f5d8",
    	"sym-lnc-s": "f5d9",
    	"sym-lnc": "f5da",
    	"sym-lnd-s": "f5db",
    	"sym-lnd": "f5dc",
    	"sym-loc-s": "f5dd",
    	"sym-loc": "f5de",
    	"sym-loka-s": "f5df",
    	"sym-loka": "f5e0",
    	"sym-looks-s": "f5e1",
    	"sym-looks": "f5e2",
    	"sym-loom-s": "f5e3",
    	"sym-loom": "f5e4",
    	"sym-lpt-s": "f5e5",
    	"sym-lpt": "f5e6",
    	"sym-lqty-s": "f5e7",
    	"sym-lqty": "f5e8",
    	"sym-lrc-s": "f5e9",
    	"sym-lrc": "f5ea",
    	"sym-lrn-s": "f5eb",
    	"sym-lrn": "f5ec",
    	"sym-lsk-s": "f5ed",
    	"sym-lsk": "f5ee",
    	"sym-ltc-s": "f5ef",
    	"sym-ltc": "f5f0",
    	"sym-lto-s": "f5f1",
    	"sym-lto": "f5f2",
    	"sym-lun-s": "f5f3",
    	"sym-lun": "f5f4",
    	"sym-luna-s": "f5f5",
    	"sym-luna": "f5f6",
    	"sym-luna2-s": "f5f7",
    	"sym-luna2": "f5f8",
    	"sym-lxt-s": "f5f9",
    	"sym-lxt": "f5fa",
    	"sym-lym-s": "f5fb",
    	"sym-lym": "f5fc",
    	"sym-m2k-s": "f5fd",
    	"sym-m2k": "f5fe",
    	"sym-ma-s": "f5ff",
    	"sym-ma": "f600",
    	"sym-magic-s": "f601",
    	"sym-magic": "f602",
    	"sym-maid-s": "f603",
    	"sym-maid": "f604",
    	"sym-man-s": "f605",
    	"sym-man": "f606",
    	"sym-mana-s": "f607",
    	"sym-mana": "f608",
    	"sym-maps-s": "f609",
    	"sym-maps": "f60a",
    	"sym-mask-s": "f60b",
    	"sym-mask": "f60c",
    	"sym-mass-s": "f60d",
    	"sym-mass": "f60e",
    	"sym-math-s": "f60f",
    	"sym-math": "f610",
    	"sym-matic-s": "f611",
    	"sym-matic": "f612",
    	"sym-mbl-s": "f613",
    	"sym-mbl": "f614",
    	"sym-mbt-s": "f615",
    	"sym-mbt": "f616",
    	"sym-mc-s": "f617",
    	"sym-mc": "f618",
    	"sym-mco-s": "f619",
    	"sym-mco": "f61a",
    	"sym-mda-s": "f61b",
    	"sym-mda": "f61c",
    	"sym-mds-s": "f61d",
    	"sym-mds": "f61e",
    	"sym-mdt-s": "f61f",
    	"sym-mdt": "f620",
    	"sym-mdx-s": "f621",
    	"sym-mdx": "f622",
    	"sym-med-s": "f623",
    	"sym-med": "f624",
    	"sym-mer-s": "f625",
    	"sym-mer": "f626",
    	"sym-mes-s": "f627",
    	"sym-mes": "f628",
    	"sym-met-s": "f629",
    	"sym-met": "f62a",
    	"sym-meta-s": "f62b",
    	"sym-meta": "f62c",
    	"sym-metis-s": "f62d",
    	"sym-metis": "f62e",
    	"sym-mft-s": "f62f",
    	"sym-mft": "f630",
    	"sym-mgc-s": "f631",
    	"sym-mgc": "f632",
    	"sym-mgo-s": "f633",
    	"sym-mgo": "f634",
    	"sym-mhc-s": "f635",
    	"sym-mhc": "f636",
    	"sym-mina-s": "f637",
    	"sym-mina": "f638",
    	"sym-mir-s": "f639",
    	"sym-mir": "f63a",
    	"sym-mith-s": "f63b",
    	"sym-mith": "f63c",
    	"sym-mitx-s": "f63d",
    	"sym-mitx": "f63e",
    	"sym-mjp-s": "f63f",
    	"sym-mjp": "f640",
    	"sym-mkr-s": "f641",
    	"sym-mkr": "f642",
    	"sym-mln-s": "f643",
    	"sym-mln": "f644",
    	"sym-mngo-s": "f645",
    	"sym-mngo": "f646",
    	"sym-mnx-s": "f647",
    	"sym-mnx": "f648",
    	"sym-moac-s": "f649",
    	"sym-moac": "f64a",
    	"sym-mob-s": "f64b",
    	"sym-mob": "f64c",
    	"sym-mobi-s": "f64d",
    	"sym-mobi": "f64e",
    	"sym-moc-s": "f64f",
    	"sym-moc": "f650",
    	"sym-mod-s": "f651",
    	"sym-mod": "f652",
    	"sym-mona-s": "f653",
    	"sym-mona": "f654",
    	"sym-moon-s": "f655",
    	"sym-moon": "f656",
    	"sym-morph-s": "f657",
    	"sym-morph": "f658",
    	"sym-movr-s": "f659",
    	"sym-movr": "f65a",
    	"sym-mpl-s": "f65b",
    	"sym-mpl": "f65c",
    	"sym-mrk-s": "f65d",
    	"sym-mrk": "f65e",
    	"sym-msol-s": "f65f",
    	"sym-msol": "f660",
    	"sym-msp-s": "f661",
    	"sym-msp": "f662",
    	"sym-mta-s": "f663",
    	"sym-mta": "f664",
    	"sym-mtc-s": "f665",
    	"sym-mtc": "f666",
    	"sym-mth-s": "f667",
    	"sym-mth": "f668",
    	"sym-mtl-s": "f669",
    	"sym-mtl": "f66a",
    	"sym-mtn-s": "f66b",
    	"sym-mtn": "f66c",
    	"sym-mtx-s": "f66d",
    	"sym-mtx": "f66e",
    	"sym-mue-s": "f66f",
    	"sym-mue": "f670",
    	"sym-multi-s": "f671",
    	"sym-multi": "f672",
    	"sym-mv-s": "f673",
    	"sym-mv": "f674",
    	"sym-mx-s": "f675",
    	"sym-mx": "f676",
    	"sym-mxc-s": "f677",
    	"sym-mxc": "f678",
    	"sym-mxm-s": "f679",
    	"sym-mxm": "f67a",
    	"sym-mxn-s": "f67b",
    	"sym-mxn": "f67c",
    	"sym-myr-s": "f67d",
    	"sym-myr": "f67e",
    	"sym-n9l-s": "f67f",
    	"sym-n9l": "f680",
    	"sym-nanj-s": "f681",
    	"sym-nanj": "f682",
    	"sym-nano-s": "f683",
    	"sym-nano": "f684",
    	"sym-nas-s": "f685",
    	"sym-nas": "f686",
    	"sym-naut-s": "f687",
    	"sym-naut": "f688",
    	"sym-nav-s": "f689",
    	"sym-nav": "f68a",
    	"sym-ncash-s": "f68b",
    	"sym-ncash": "f68c",
    	"sym-nct-s": "f68d",
    	"sym-nct": "f68e",
    	"sym-near-s": "f68f",
    	"sym-near": "f690",
    	"sym-nebl-s": "f691",
    	"sym-nebl": "f692",
    	"sym-nec-s": "f693",
    	"sym-nec": "f694",
    	"sym-neo-s": "f695",
    	"sym-neo": "f696",
    	"sym-neos-s": "f697",
    	"sym-neos": "f698",
    	"sym-nest-s": "f699",
    	"sym-nest": "f69a",
    	"sym-neu-s": "f69b",
    	"sym-neu": "f69c",
    	"sym-new-s": "f69d",
    	"sym-new": "f69e",
    	"sym-nexo-s": "f69f",
    	"sym-nexo": "f6a0",
    	"sym-nft-s": "f6a1",
    	"sym-nft": "f6a2",
    	"sym-ng-s": "f6a3",
    	"sym-ng": "f6a4",
    	"sym-ngc-s": "f6a5",
    	"sym-ngc": "f6a6",
    	"sym-ngn-s": "f6a7",
    	"sym-ngn": "f6a8",
    	"sym-nim-s": "f6a9",
    	"sym-nim": "f6aa",
    	"sym-niy-s": "f6ab",
    	"sym-niy": "f6ac",
    	"sym-nkd-s": "f6ad",
    	"sym-nkd": "f6ae",
    	"sym-nkn-s": "f6af",
    	"sym-nkn": "f6b0",
    	"sym-nlc2-s": "f6b1",
    	"sym-nlc2": "f6b2",
    	"sym-nlg-s": "f6b3",
    	"sym-nlg": "f6b4",
    	"sym-nmc-s": "f6b5",
    	"sym-nmc": "f6b6",
    	"sym-nmr-s": "f6b7",
    	"sym-nmr": "f6b8",
    	"sym-nn-s": "f6b9",
    	"sym-nn": "f6ba",
    	"sym-noah-s": "f6bb",
    	"sym-noah": "f6bc",
    	"sym-nodl-s": "f6bd",
    	"sym-nodl": "f6be",
    	"sym-note-s": "f6bf",
    	"sym-note": "f6c0",
    	"sym-npg-s": "f6c1",
    	"sym-npg": "f6c2",
    	"sym-nplc-s": "f6c3",
    	"sym-nplc": "f6c4",
    	"sym-npxs-s": "f6c5",
    	"sym-npxs": "f6c6",
    	"sym-nq-s": "f6c7",
    	"sym-nq": "f6c8",
    	"sym-nrg-s": "f6c9",
    	"sym-nrg": "f6ca",
    	"sym-ntk-s": "f6cb",
    	"sym-ntk": "f6cc",
    	"sym-nu-s": "f6cd",
    	"sym-nu": "f6ce",
    	"sym-nuls-s": "f6cf",
    	"sym-nuls": "f6d0",
    	"sym-nvc-s": "f6d1",
    	"sym-nvc": "f6d2",
    	"sym-nxc-s": "f6d3",
    	"sym-nxc": "f6d4",
    	"sym-nxs-s": "f6d5",
    	"sym-nxs": "f6d6",
    	"sym-nxt-s": "f6d7",
    	"sym-nxt": "f6d8",
    	"sym-nym-s": "f6d9",
    	"sym-nym": "f6da",
    	"sym-o-s": "f6db",
    	"sym-o": "f6dc",
    	"sym-oak-s": "f6dd",
    	"sym-oak": "f6de",
    	"sym-oax-s": "f6df",
    	"sym-oax": "f6e0",
    	"sym-ocean-s": "f6e1",
    	"sym-ocean": "f6e2",
    	"sym-ocn-s": "f6e3",
    	"sym-ocn": "f6e4",
    	"sym-ode-s": "f6e5",
    	"sym-ode": "f6e6",
    	"sym-ogn-s": "f6e7",
    	"sym-ogn": "f6e8",
    	"sym-ogo-s": "f6e9",
    	"sym-ogo": "f6ea",
    	"sym-ok-s": "f6eb",
    	"sym-ok": "f6ec",
    	"sym-okb-s": "f6ed",
    	"sym-okb": "f6ee",
    	"sym-om-s": "f6ef",
    	"sym-om": "f6f0",
    	"sym-omg-s": "f6f1",
    	"sym-omg": "f6f2",
    	"sym-omni-s": "f6f3",
    	"sym-omni": "f6f4",
    	"sym-one-s": "f6f5",
    	"sym-one": "f6f6",
    	"sym-ong-s": "f6f7",
    	"sym-ong": "f6f8",
    	"sym-onot-s": "f6f9",
    	"sym-onot": "f6fa",
    	"sym-ont-s": "f6fb",
    	"sym-ont": "f6fc",
    	"sym-ooki-s": "f6fd",
    	"sym-ooki": "f6fe",
    	"sym-orbs-s": "f6ff",
    	"sym-orbs": "f700",
    	"sym-orca-s": "f701",
    	"sym-orca": "f702",
    	"sym-orme-s": "f703",
    	"sym-orme": "f704",
    	"sym-orn-s": "f705",
    	"sym-orn": "f706",
    	"sym-ors-s": "f707",
    	"sym-ors": "f708",
    	"sym-osmo-s": "f709",
    	"sym-osmo": "f70a",
    	"sym-ost-s": "f70b",
    	"sym-ost": "f70c",
    	"sym-otn-s": "f70d",
    	"sym-otn": "f70e",
    	"sym-oxt-s": "f70f",
    	"sym-oxt": "f710",
    	"sym-oxy-s": "f711",
    	"sym-oxy": "f712",
    	"sym-pai-s": "f713",
    	"sym-pai": "f714",
    	"sym-pal-s": "f715",
    	"sym-pal": "f716",
    	"sym-paper-s": "f717",
    	"sym-paper": "f718",
    	"sym-para-s": "f719",
    	"sym-para": "f71a",
    	"sym-part-s": "f71b",
    	"sym-part": "f71c",
    	"sym-pasc-s": "f71d",
    	"sym-pasc": "f71e",
    	"sym-pat-s": "f71f",
    	"sym-pat": "f720",
    	"sym-pax-s": "f721",
    	"sym-pax": "f722",
    	"sym-paxg-s": "f723",
    	"sym-paxg": "f724",
    	"sym-pay-s": "f725",
    	"sym-pay": "f726",
    	"sym-pbt-s": "f727",
    	"sym-pbt": "f728",
    	"sym-pcl-s": "f729",
    	"sym-pcl": "f72a",
    	"sym-pcx-s": "f72b",
    	"sym-pcx": "f72c",
    	"sym-pdex-s": "f72d",
    	"sym-pdex": "f72e",
    	"sym-people-s": "f72f",
    	"sym-people": "f730",
    	"sym-perl-s": "f731",
    	"sym-perl": "f732",
    	"sym-perp-s": "f733",
    	"sym-perp": "f734",
    	"sym-pha-s": "f735",
    	"sym-pha": "f736",
    	"sym-phb-s": "f737",
    	"sym-phb": "f738",
    	"sym-php-s": "f739",
    	"sym-php": "f73a",
    	"sym-phx-s": "f73b",
    	"sym-phx": "f73c",
    	"sym-pi-s": "f73d",
    	"sym-pi": "f73e",
    	"sym-pica-s": "f73f",
    	"sym-pica": "f740",
    	"sym-pink-s": "f741",
    	"sym-pink": "f742",
    	"sym-pivx-s": "f743",
    	"sym-pivx": "f744",
    	"sym-pkt-s": "f745",
    	"sym-pkt": "f746",
    	"sym-pl-s": "f747",
    	"sym-pl": "f748",
    	"sym-pla-s": "f749",
    	"sym-pla": "f74a",
    	"sym-plbt-s": "f74b",
    	"sym-plbt": "f74c",
    	"sym-plm-s": "f74d",
    	"sym-plm": "f74e",
    	"sym-pln-s": "f74f",
    	"sym-pln": "f750",
    	"sym-plr-s": "f751",
    	"sym-plr": "f752",
    	"sym-ply-s": "f753",
    	"sym-ply": "f754",
    	"sym-pma-s": "f755",
    	"sym-pma": "f756",
    	"sym-png-s": "f757",
    	"sym-png": "f758",
    	"sym-pnt-s": "f759",
    	"sym-pnt": "f75a",
    	"sym-poa-s": "f75b",
    	"sym-poa": "f75c",
    	"sym-poe-s": "f75d",
    	"sym-poe": "f75e",
    	"sym-polis-s": "f75f",
    	"sym-polis": "f760",
    	"sym-pols-s": "f761",
    	"sym-pols": "f762",
    	"sym-poly-s": "f763",
    	"sym-poly": "f764",
    	"sym-pond-s": "f765",
    	"sym-pond": "f766",
    	"sym-pot-s": "f767",
    	"sym-pot": "f768",
    	"sym-powr-s": "f769",
    	"sym-powr": "f76a",
    	"sym-ppc-s": "f76b",
    	"sym-ppc": "f76c",
    	"sym-ppt-s": "f76d",
    	"sym-ppt": "f76e",
    	"sym-pra-s": "f76f",
    	"sym-pra": "f770",
    	"sym-pre-s": "f771",
    	"sym-pre": "f772",
    	"sym-prg-s": "f773",
    	"sym-prg": "f774",
    	"sym-pro-s": "f775",
    	"sym-pro": "f776",
    	"sym-prq-s": "f777",
    	"sym-prq": "f778",
    	"sym-pst-s": "f779",
    	"sym-pst": "f77a",
    	"sym-pstake-s": "f77b",
    	"sym-pstake": "f77c",
    	"sym-pton-s": "f77d",
    	"sym-pton": "f77e",
    	"sym-pundix-s": "f77f",
    	"sym-pundix": "f780",
    	"sym-pvt-s": "f781",
    	"sym-pvt": "f782",
    	"sym-pxg-s": "f783",
    	"sym-pxg": "f784",
    	"sym-pyr-s": "f785",
    	"sym-pyr": "f786",
    	"sym-qash-s": "f787",
    	"sym-qash": "f788",
    	"sym-qau-s": "f789",
    	"sym-qau": "f78a",
    	"sym-qc-s": "f78b",
    	"sym-qc": "f78c",
    	"sym-qi-s": "f78d",
    	"sym-qi": "f78e",
    	"sym-qi2-s": "f78f",
    	"sym-qi2": "f790",
    	"sym-qkc-s": "f791",
    	"sym-qkc": "f792",
    	"sym-qlc-s": "f793",
    	"sym-qlc": "f794",
    	"sym-qnt-s": "f795",
    	"sym-qnt": "f796",
    	"sym-qntu-s": "f797",
    	"sym-qntu": "f798",
    	"sym-qo-s": "f799",
    	"sym-qo": "f79a",
    	"sym-qrdo-s": "f79b",
    	"sym-qrdo": "f79c",
    	"sym-qrl-s": "f79d",
    	"sym-qrl": "f79e",
    	"sym-qsp-s": "f79f",
    	"sym-qsp": "f7a0",
    	"sym-qtum-s": "f7a1",
    	"sym-qtum": "f7a2",
    	"sym-quick-s": "f7a3",
    	"sym-quick": "f7a4",
    	"sym-qun-s": "f7a5",
    	"sym-qun": "f7a6",
    	"sym-r-s": "f7a7",
    	"sym-r": "f7a8",
    	"sym-rad-s": "f7a9",
    	"sym-rad": "f7aa",
    	"sym-radar-s": "f7ab",
    	"sym-radar": "f7ac",
    	"sym-rads-s": "f7ad",
    	"sym-rads": "f7ae",
    	"sym-ramp-s": "f7af",
    	"sym-ramp": "f7b0",
    	"sym-rare-s": "f7b1",
    	"sym-rare": "f7b2",
    	"sym-rari-s": "f7b3",
    	"sym-rari": "f7b4",
    	"sym-rating-s": "f7b5",
    	"sym-rating": "f7b6",
    	"sym-ray-s": "f7b7",
    	"sym-ray": "f7b8",
    	"sym-rb-s": "f7b9",
    	"sym-rb": "f7ba",
    	"sym-rbc-s": "f7bb",
    	"sym-rbc": "f7bc",
    	"sym-rblx-s": "f7bd",
    	"sym-rblx": "f7be",
    	"sym-rbn-s": "f7bf",
    	"sym-rbn": "f7c0",
    	"sym-rbtc-s": "f7c1",
    	"sym-rbtc": "f7c2",
    	"sym-rby-s": "f7c3",
    	"sym-rby": "f7c4",
    	"sym-rcn-s": "f7c5",
    	"sym-rcn": "f7c6",
    	"sym-rdd-s": "f7c7",
    	"sym-rdd": "f7c8",
    	"sym-rdn-s": "f7c9",
    	"sym-rdn": "f7ca",
    	"sym-real-s": "f7cb",
    	"sym-real": "f7cc",
    	"sym-reef-s": "f7cd",
    	"sym-reef": "f7ce",
    	"sym-rem-s": "f7cf",
    	"sym-rem": "f7d0",
    	"sym-ren-s": "f7d1",
    	"sym-ren": "f7d2",
    	"sym-rep-s": "f7d3",
    	"sym-rep": "f7d4",
    	"sym-repv2-s": "f7d5",
    	"sym-repv2": "f7d6",
    	"sym-req-s": "f7d7",
    	"sym-req": "f7d8",
    	"sym-rev-s": "f7d9",
    	"sym-rev": "f7da",
    	"sym-revv-s": "f7db",
    	"sym-revv": "f7dc",
    	"sym-rfox-s": "f7dd",
    	"sym-rfox": "f7de",
    	"sym-rfr-s": "f7df",
    	"sym-rfr": "f7e0",
    	"sym-ric-s": "f7e1",
    	"sym-ric": "f7e2",
    	"sym-rif-s": "f7e3",
    	"sym-rif": "f7e4",
    	"sym-ring-s": "f7e5",
    	"sym-ring": "f7e6",
    	"sym-rlc-s": "f7e7",
    	"sym-rlc": "f7e8",
    	"sym-rly-s": "f7e9",
    	"sym-rly": "f7ea",
    	"sym-rmrk-s": "f7eb",
    	"sym-rmrk": "f7ec",
    	"sym-rndr-s": "f7ed",
    	"sym-rndr": "f7ee",
    	"sym-rntb-s": "f7ef",
    	"sym-rntb": "f7f0",
    	"sym-ron-s": "f7f1",
    	"sym-ron": "f7f2",
    	"sym-rook-s": "f7f3",
    	"sym-rook": "f7f4",
    	"sym-rose-s": "f7f5",
    	"sym-rose": "f7f6",
    	"sym-rox-s": "f7f7",
    	"sym-rox": "f7f8",
    	"sym-rp-s": "f7f9",
    	"sym-rp": "f7fa",
    	"sym-rpl-s": "f7fb",
    	"sym-rpl": "f7fc",
    	"sym-rpx-s": "f7fd",
    	"sym-rpx": "f7fe",
    	"sym-rsr-s": "f7ff",
    	"sym-rsr": "f800",
    	"sym-rsv-s": "f801",
    	"sym-rsv": "f802",
    	"sym-rty-s": "f803",
    	"sym-rty": "f804",
    	"sym-rub-s": "f805",
    	"sym-rub": "f806",
    	"sym-ruff-s": "f807",
    	"sym-ruff": "f808",
    	"sym-rune-s": "f809",
    	"sym-rune": "f80a",
    	"sym-rvn-s": "f80b",
    	"sym-rvn": "f80c",
    	"sym-rvr-s": "f80d",
    	"sym-rvr": "f80e",
    	"sym-rvt-s": "f80f",
    	"sym-rvt": "f810",
    	"sym-sai-s": "f811",
    	"sym-sai": "f812",
    	"sym-salt-s": "f813",
    	"sym-salt": "f814",
    	"sym-samo-s": "f815",
    	"sym-samo": "f816",
    	"sym-san-s": "f817",
    	"sym-san": "f818",
    	"sym-sand-s": "f819",
    	"sym-sand": "f81a",
    	"sym-sats-s": "f81b",
    	"sym-sats": "f81c",
    	"sym-sbd-s": "f81d",
    	"sym-sbd": "f81e",
    	"sym-sbr-s": "f81f",
    	"sym-sbr": "f820",
    	"sym-sc-s": "f821",
    	"sym-sc": "f822",
    	"sym-scc-s": "f823",
    	"sym-scc": "f824",
    	"sym-scrt-s": "f825",
    	"sym-scrt": "f826",
    	"sym-sdc-s": "f827",
    	"sym-sdc": "f828",
    	"sym-sdn-s": "f829",
    	"sym-sdn": "f82a",
    	"sym-seele-s": "f82b",
    	"sym-seele": "f82c",
    	"sym-sek-s": "f82d",
    	"sym-sek": "f82e",
    	"sym-sen-s": "f82f",
    	"sym-sen": "f830",
    	"sym-sent-s": "f831",
    	"sym-sent": "f832",
    	"sym-sero-s": "f833",
    	"sym-sero": "f834",
    	"sym-sexc-s": "f835",
    	"sym-sexc": "f836",
    	"sym-sfp-s": "f837",
    	"sym-sfp": "f838",
    	"sym-sgb-s": "f839",
    	"sym-sgb": "f83a",
    	"sym-sgc-s": "f83b",
    	"sym-sgc": "f83c",
    	"sym-sgd-s": "f83d",
    	"sym-sgd": "f83e",
    	"sym-sgn-s": "f83f",
    	"sym-sgn": "f840",
    	"sym-sgu-s": "f841",
    	"sym-sgu": "f842",
    	"sym-shib-s": "f843",
    	"sym-shib": "f844",
    	"sym-shift-s": "f845",
    	"sym-shift": "f846",
    	"sym-ship-s": "f847",
    	"sym-ship": "f848",
    	"sym-shping-s": "f849",
    	"sym-shping": "f84a",
    	"sym-si-s": "f84b",
    	"sym-si": "f84c",
    	"sym-sib-s": "f84d",
    	"sym-sib": "f84e",
    	"sym-sil-s": "f84f",
    	"sym-sil": "f850",
    	"sym-six-s": "f851",
    	"sym-six": "f852",
    	"sym-sjcx-s": "f853",
    	"sym-sjcx": "f854",
    	"sym-skl-s": "f855",
    	"sym-skl": "f856",
    	"sym-skm-s": "f857",
    	"sym-skm": "f858",
    	"sym-sku-s": "f859",
    	"sym-sku": "f85a",
    	"sym-sky-s": "f85b",
    	"sym-sky": "f85c",
    	"sym-slp-s": "f85d",
    	"sym-slp": "f85e",
    	"sym-slr-s": "f85f",
    	"sym-slr": "f860",
    	"sym-sls-s": "f861",
    	"sym-sls": "f862",
    	"sym-slt-s": "f863",
    	"sym-slt": "f864",
    	"sym-slv-s": "f865",
    	"sym-slv": "f866",
    	"sym-smart-s": "f867",
    	"sym-smart": "f868",
    	"sym-smn-s": "f869",
    	"sym-smn": "f86a",
    	"sym-smt-s": "f86b",
    	"sym-smt": "f86c",
    	"sym-snc-s": "f86d",
    	"sym-snc": "f86e",
    	"sym-snet-s": "f86f",
    	"sym-snet": "f870",
    	"sym-sngls-s": "f871",
    	"sym-sngls": "f872",
    	"sym-snm-s": "f873",
    	"sym-snm": "f874",
    	"sym-snt-s": "f875",
    	"sym-snt": "f876",
    	"sym-snx-s": "f877",
    	"sym-snx": "f878",
    	"sym-soc-s": "f879",
    	"sym-soc": "f87a",
    	"sym-socks-s": "f87b",
    	"sym-socks": "f87c",
    	"sym-sol-s": "f87d",
    	"sym-sol": "f87e",
    	"sym-solid-s": "f87f",
    	"sym-solid": "f880",
    	"sym-solo-s": "f881",
    	"sym-solo": "f882",
    	"sym-solve-s": "f883",
    	"sym-solve": "f884",
    	"sym-sos-s": "f885",
    	"sym-sos": "f886",
    	"sym-soul-s": "f887",
    	"sym-soul": "f888",
    	"sym-sp-s": "f889",
    	"sym-sp": "f88a",
    	"sym-sparta-s": "f88b",
    	"sym-sparta": "f88c",
    	"sym-spc-s": "f88d",
    	"sym-spc": "f88e",
    	"sym-spd-s": "f88f",
    	"sym-spd": "f890",
    	"sym-spell-s": "f891",
    	"sym-spell": "f892",
    	"sym-sphr-s": "f893",
    	"sym-sphr": "f894",
    	"sym-sphtx-s": "f895",
    	"sym-sphtx": "f896",
    	"sym-spnd-s": "f897",
    	"sym-spnd": "f898",
    	"sym-spnk-s": "f899",
    	"sym-spnk": "f89a",
    	"sym-srm-s": "f89b",
    	"sym-srm": "f89c",
    	"sym-srn-s": "f89d",
    	"sym-srn": "f89e",
    	"sym-ssp-s": "f89f",
    	"sym-ssp": "f8a0",
    	"sym-ssv-s": "f8a1",
    	"sym-ssv": "f8a2",
    	"sym-stacs-s": "f8a3",
    	"sym-stacs": "f8a4",
    	"sym-step-s": "f8a5",
    	"sym-step": "f8a6",
    	"sym-stg-s": "f8a7",
    	"sym-stg": "f8a8",
    	"sym-stmx-s": "f8a9",
    	"sym-stmx": "f8aa",
    	"sym-storm-s": "f8ab",
    	"sym-storm": "f8ac",
    	"sym-stpt-s": "f8ad",
    	"sym-stpt": "f8ae",
    	"sym-stq-s": "f8af",
    	"sym-stq": "f8b0",
    	"sym-str-s": "f8b1",
    	"sym-str": "f8b2",
    	"sym-strat-s": "f8b3",
    	"sym-strat": "f8b4",
    	"sym-strax-s": "f8b5",
    	"sym-strax": "f8b6",
    	"sym-strk-s": "f8b7",
    	"sym-strk": "f8b8",
    	"sym-strong-s": "f8b9",
    	"sym-strong": "f8ba",
    	"sym-stx-s": "f8bb",
    	"sym-stx": "f8bc",
    	"sym-sub-s": "f8bd",
    	"sym-sub": "f8be",
    	"sym-sui-s": "f8bf",
    	"sym-sui": "f8c0",
    	"sym-sun-s": "f8c1",
    	"sym-sun": "f8c2",
    	"sym-super-s": "f8c3",
    	"sym-super": "f8c4",
    	"sym-susd-s": "f8c5",
    	"sym-susd": "f8c6",
    	"sym-sushi-s": "f8c7",
    	"sym-sushi": "f8c8",
    	"sym-swftc-s": "f8c9",
    	"sym-swftc": "f8ca",
    	"sym-swm-s": "f8cb",
    	"sym-swm": "f8cc",
    	"sym-swrv-s": "f8cd",
    	"sym-swrv": "f8ce",
    	"sym-swt-s": "f8cf",
    	"sym-swt": "f8d0",
    	"sym-swth-s": "f8d1",
    	"sym-swth": "f8d2",
    	"sym-sxp-s": "f8d3",
    	"sym-sxp": "f8d4",
    	"sym-syn-s": "f8d5",
    	"sym-syn": "f8d6",
    	"sym-sys-s": "f8d7",
    	"sym-sys": "f8d8",
    	"sym-t-s": "f8d9",
    	"sym-t": "f8da",
    	"sym-taas-s": "f8db",
    	"sym-taas": "f8dc",
    	"sym-tau-s": "f8dd",
    	"sym-tau": "f8de",
    	"sym-tbtc-s": "f8df",
    	"sym-tbtc": "f8e0",
    	"sym-tct-s": "f8e1",
    	"sym-tct": "f8e2",
    	"sym-teer-s": "f8e3",
    	"sym-teer": "f8e4",
    	"sym-tel-s": "f8e5",
    	"sym-temco-s": "f8e6",
    	"sym-temco": "f8e7",
    	"sym-tfuel-s": "f8e8",
    	"sym-tfuel": "f8e9",
    	"sym-thb-s": "f8ea",
    	"sym-thb": "f8eb",
    	"sym-thc-s": "f8ec",
    	"sym-thc": "f8ed",
    	"sym-theta-s": "f8ee",
    	"sym-theta": "f8ef",
    	"sym-thx-s": "f8f0",
    	"sym-thx": "f8f1",
    	"sym-time-s": "f8f2",
    	"sym-time": "f8f3",
    	"sym-tio-s": "f8f4",
    	"sym-tio": "f8f5",
    	"sym-tix-s": "f8f6",
    	"sym-tix": "f8f7",
    	"sym-tkn-s": "f8f8",
    	"sym-tkn": "f8f9",
    	"sym-tky-s": "f8fa",
    	"sym-tky": "f8fb",
    	"sym-tlm-s": "f8fc",
    	"sym-tlm": "f8fd",
    	"sym-tnb-s": "f8fe",
    	"sym-tnb": "f8ff",
    	"sym-tnc-s": "f900",
    	"sym-tnc": "f901",
    	"sym-tnt-s": "f902",
    	"sym-tnt": "f903",
    	"sym-toke-s": "f904",
    	"sym-toke": "f905",
    	"sym-tomb-s": "f906",
    	"sym-tomb": "f907",
    	"sym-tomo-s": "f908",
    	"sym-tomo": "f909",
    	"sym-top-s": "f90a",
    	"sym-top": "f90b",
    	"sym-torn-s": "f90c",
    	"sym-torn": "f90d",
    	"sym-tower-s": "f90e",
    	"sym-tower": "f90f",
    	"sym-tpay-s": "f910",
    	"sym-tpay": "f911",
    	"sym-trac-s": "f912",
    	"sym-trac": "f913",
    	"sym-trb-s": "f914",
    	"sym-trb": "f915",
    	"sym-tribe-s": "f916",
    	"sym-tribe": "f917",
    	"sym-trig-s": "f918",
    	"sym-trig": "f919",
    	"sym-trio-s": "f91a",
    	"sym-trio": "f91b",
    	"sym-troy-s": "f91c",
    	"sym-troy": "f91d",
    	"sym-trst-s": "f91e",
    	"sym-trst": "f91f",
    	"sym-tru-s": "f920",
    	"sym-tru": "f921",
    	"sym-true-s": "f922",
    	"sym-true": "f923",
    	"sym-trx-s": "f924",
    	"sym-trx": "f925",
    	"sym-try-s": "f926",
    	"sym-try": "f927",
    	"sym-tryb-s": "f928",
    	"sym-tryb": "f929",
    	"sym-tt-s": "f92a",
    	"sym-tt": "f92b",
    	"sym-ttc-s": "f92c",
    	"sym-ttc": "f92d",
    	"sym-ttt-s": "f92e",
    	"sym-ttt": "f92f",
    	"sym-ttu-s": "f930",
    	"sym-ttu": "f931",
    	"sym-tube-s": "f932",
    	"sym-tube": "f933",
    	"sym-tusd-s": "f934",
    	"sym-tusd": "f935",
    	"sym-tvk-s": "f936",
    	"sym-tvk": "f937",
    	"sym-twt-s": "f938",
    	"sym-twt": "f939",
    	"sym-uah-s": "f93a",
    	"sym-uah": "f93b",
    	"sym-ubq-s": "f93c",
    	"sym-ubq": "f93d",
    	"sym-ubt-s": "f93e",
    	"sym-ubt": "f93f",
    	"sym-uft-s": "f940",
    	"sym-uft": "f941",
    	"sym-ugas-s": "f942",
    	"sym-ugas": "f943",
    	"sym-uip-s": "f944",
    	"sym-uip": "f945",
    	"sym-ukg-s": "f946",
    	"sym-ukg": "f947",
    	"sym-uma-s": "f948",
    	"sym-uma": "f949",
    	"sym-umami-s": "f94a",
    	"sym-umami": "f94b",
    	"sym-unfi-s": "f94c",
    	"sym-unfi": "f94d",
    	"sym-uni-s": "f94e",
    	"sym-uni": "f94f",
    	"sym-unq-s": "f950",
    	"sym-unq": "f951",
    	"sym-up-s": "f952",
    	"sym-up": "f953",
    	"sym-upp-s": "f954",
    	"sym-upp": "f955",
    	"sym-usd-s": "f956",
    	"sym-usd": "f957",
    	"sym-usdc-s": "f958",
    	"sym-usdc": "f959",
    	"sym-usds-s": "f95a",
    	"sym-usds": "f95b",
    	"sym-usk-s": "f95c",
    	"sym-usk": "f95d",
    	"sym-ust-s": "f95e",
    	"sym-ust": "f95f",
    	"sym-utk-s": "f960",
    	"sym-utk": "f961",
    	"sym-utnp-s": "f962",
    	"sym-utnp": "f963",
    	"sym-utt-s": "f964",
    	"sym-utt": "f965",
    	"sym-uuu-s": "f966",
    	"sym-uuu": "f967",
    	"sym-ux-s": "f968",
    	"sym-ux": "f969",
    	"sym-vader-s": "f96a",
    	"sym-vader": "f96b",
    	"sym-vai-s": "f96c",
    	"sym-vai": "f96d",
    	"sym-vbk-s": "f96e",
    	"sym-vbk": "f96f",
    	"sym-vdx-s": "f970",
    	"sym-vdx": "f971",
    	"sym-vee-s": "f972",
    	"sym-vee": "f973",
    	"sym-vemp-s": "f974",
    	"sym-vemp": "f975",
    	"sym-ven-s": "f976",
    	"sym-ven": "f977",
    	"sym-veo-s": "f978",
    	"sym-veo": "f979",
    	"sym-veri-s": "f97a",
    	"sym-veri": "f97b",
    	"sym-vex-s": "f97c",
    	"sym-vex": "f97d",
    	"sym-vgx-s": "f97e",
    	"sym-vgx": "f97f",
    	"sym-via-s": "f980",
    	"sym-via": "f981",
    	"sym-vib-s": "f982",
    	"sym-vib": "f983",
    	"sym-vibe-s": "f984",
    	"sym-vibe": "f985",
    	"sym-vid-s": "f986",
    	"sym-vid": "f987",
    	"sym-vidt-s": "f988",
    	"sym-vidt": "f989",
    	"sym-vidy-s": "f98a",
    	"sym-vidy": "f98b",
    	"sym-vitae-s": "f98c",
    	"sym-vitae": "f98d",
    	"sym-vite-s": "f98e",
    	"sym-vite": "f98f",
    	"sym-vlx-s": "f990",
    	"sym-vlx": "f991",
    	"sym-vox-s": "f992",
    	"sym-vox": "f993",
    	"sym-voxel-s": "f994",
    	"sym-voxel": "f995",
    	"sym-vra-s": "f996",
    	"sym-vra": "f997",
    	"sym-vrc-s": "f998",
    	"sym-vrc": "f999",
    	"sym-vrm-s": "f99a",
    	"sym-vrm": "f99b",
    	"sym-vsys-s": "f99c",
    	"sym-vsys": "f99d",
    	"sym-vtc-s": "f99e",
    	"sym-vtc": "f99f",
    	"sym-vtho-s": "f9a0",
    	"sym-vtho": "f9a1",
    	"sym-wabi-s": "f9a2",
    	"sym-wabi": "f9a3",
    	"sym-wan-s": "f9a4",
    	"sym-wan": "f9a5",
    	"sym-waves-s": "f9a6",
    	"sym-waves": "f9a7",
    	"sym-wax-s": "f9a8",
    	"sym-wax": "f9a9",
    	"sym-wbtc-s": "f9aa",
    	"sym-wbtc": "f9ab",
    	"sym-wet-s": "f9ac",
    	"sym-wet": "f9ad",
    	"sym-weth-s": "f9ae",
    	"sym-weth": "f9af",
    	"sym-wib-s": "f9b0",
    	"sym-wib": "f9b1",
    	"sym-wicc-s": "f9b2",
    	"sym-wicc": "f9b3",
    	"sym-win-s": "f9b4",
    	"sym-win": "f9b5",
    	"sym-wing-s": "f9b6",
    	"sym-wing": "f9b7",
    	"sym-wings-s": "f9b8",
    	"sym-wings": "f9b9",
    	"sym-wnxm-s": "f9ba",
    	"sym-wnxm": "f9bb",
    	"sym-woo-s": "f9bc",
    	"sym-woo": "f9bd",
    	"sym-wpr-s": "f9be",
    	"sym-wpr": "f9bf",
    	"sym-wrx-s": "f9c0",
    	"sym-wrx": "f9c1",
    	"sym-wtc-s": "f9c2",
    	"sym-wtc": "f9c3",
    	"sym-wtt-s": "f9c4",
    	"sym-wtt": "f9c5",
    	"sym-wwb-s": "f9c6",
    	"sym-wwb": "f9c7",
    	"sym-wxt-s": "f9c8",
    	"sym-wxt": "f9c9",
    	"sym-xas-s": "f9ca",
    	"sym-xas": "f9cb",
    	"sym-xaur-s": "f9cc",
    	"sym-xaur": "f9cd",
    	"sym-xaut-s": "f9ce",
    	"sym-xaut": "f9cf",
    	"sym-xava-s": "f9d0",
    	"sym-xava": "f9d1",
    	"sym-xbc-s": "f9d2",
    	"sym-xbc": "f9d3",
    	"sym-xcn-s": "f9d4",
    	"sym-xcn": "f9d5",
    	"sym-xcon-s": "f9d6",
    	"sym-xcon": "f9d7",
    	"sym-xcp-s": "f9d8",
    	"sym-xcp": "f9d9",
    	"sym-xdefi-s": "f9da",
    	"sym-xdefi": "f9db",
    	"sym-xdn-s": "f9dc",
    	"sym-xdn": "f9dd",
    	"sym-xel-s": "f9de",
    	"sym-xel": "f9df",
    	"sym-xem-s": "f9e0",
    	"sym-xem": "f9e1",
    	"sym-xes-s": "f9e2",
    	"sym-xes": "f9e3",
    	"sym-xhv-s": "f9e4",
    	"sym-xhv": "f9e5",
    	"sym-xin-s": "f9e6",
    	"sym-xin": "f9e7",
    	"sym-xlm-s": "f9e8",
    	"sym-xlm": "f9e9",
    	"sym-xmc-s": "f9ea",
    	"sym-xmc": "f9eb",
    	"sym-xmr-s": "f9ec",
    	"sym-xmr": "f9ed",
    	"sym-xmx-s": "f9ee",
    	"sym-xmx": "f9ef",
    	"sym-xmy-s": "f9f0",
    	"sym-xmy": "f9f1",
    	"sym-xnk-s": "f9f2",
    	"sym-xnk": "f9f3",
    	"sym-xns-s": "f9f4",
    	"sym-xns": "f9f5",
    	"sym-xor-s": "f9f6",
    	"sym-xor": "f9f7",
    	"sym-xos-s": "f9f8",
    	"sym-xos": "f9f9",
    	"sym-xpm-s": "f9fa",
    	"sym-xpm": "f9fb",
    	"sym-xpr-s": "f9fc",
    	"sym-xpr": "f9fd",
    	"sym-xrc-s": "f9fe",
    	"sym-xrc": "f9ff",
    	"sym-xrp-s": "fa00",
    	"sym-xrp": "fa01",
    	"sym-xrpx-s": "fa02",
    	"sym-xrpx": "fa03",
    	"sym-xrt-s": "fa04",
    	"sym-xrt": "fa05",
    	"sym-xst-s": "fa06",
    	"sym-xst": "fa07",
    	"sym-xtp-s": "fa08",
    	"sym-xtp": "fa09",
    	"sym-xtz-s": "fa0a",
    	"sym-xtz": "fa0b",
    	"sym-xtzdown-s": "fa0c",
    	"sym-xtzdown": "fa0d",
    	"sym-xvc-s": "fa0e",
    	"sym-xvc": "fa0f",
    	"sym-xvg-s": "fa10",
    	"sym-xvg": "fa11",
    	"sym-xvs-s": "fa12",
    	"sym-xvs": "fa13",
    	"sym-xwc-s": "fa14",
    	"sym-xwc": "fa15",
    	"sym-xyo-s": "fa16",
    	"sym-xyo": "fa17",
    	"sym-xzc-s": "fa18",
    	"sym-xzc": "fa19",
    	"sym-yam-s": "fa1a",
    	"sym-yam": "fa1b",
    	"sym-yee-s": "fa1c",
    	"sym-yee": "fa1d",
    	"sym-yeed-s": "fa1e",
    	"sym-yeed": "fa1f",
    	"sym-yfi-s": "fa20",
    	"sym-yfi": "fa21",
    	"sym-yfii-s": "fa22",
    	"sym-yfii": "fa23",
    	"sym-ygg-s": "fa24",
    	"sym-ygg": "fa25",
    	"sym-yoyow-s": "fa26",
    	"sym-yoyow": "fa27",
    	"sym-zar-s": "fa28",
    	"sym-zar": "fa29",
    	"sym-zcl-s": "fa2a",
    	"sym-zcl": "fa2b",
    	"sym-zcn-s": "fa2c",
    	"sym-zcn": "fa2d",
    	"sym-zco-s": "fa2e",
    	"sym-zco": "fa2f",
    	"sym-zec-s": "fa30",
    	"sym-zec": "fa31",
    	"sym-zen-s": "fa32",
    	"sym-zen": "fa33",
    	"sym-zil-s": "fa34",
    	"sym-zil": "fa35",
    	"sym-zks-s": "fa36",
    	"sym-zks": "fa37",
    	"sym-zla-s": "fa38",
    	"sym-zla": "fa39",
    	"sym-zlk": "fa3a",
    	"sym-zondo-s": "fa3b",
    	"sym-zondo": "fa3c",
    	"sym-zpr-s": "fa3d",
    	"sym-zpr": "fa3e",
    	"sym-zpt-s": "fa3f",
    	"sym-zpt": "fa40",
    	"sym-zrc-s": "fa41",
    	"sym-zrc": "fa42",
    	"sym-zrx-s": "fa43",
    	"sym-zrx": "fa44",
    	"sym-zsc-s": "fa45",
    	"sym-zsc": "fa46",
    	"sym-ztg-s": "fa47",
    	"sym-ztg": "fa48",
    	"ustc-s": "fa49",
    	ustc: ustc,
    	"cur-anct": "f1d3",
    	"cur-anct-s": "f1d2",
    	"cur-aud": "f205",
    	"cur-aud-s": "f204",
    	"cur-bnb": "f278",
    	"cur-bnb-s": "f277",
    	"sym-xbt": "f2a2",
    	"cur-btc": "f2a2",
    	"sym-xbt-s": "f2a1",
    	"cur-btc-s": "f2a1",
    	"cur-busd": "f2c2",
    	"cur-busd-s": "f2c1",
    	"exc-bitz": "f2c6",
    	"cur-bz": "f2c6",
    	"exc-bitz-s": "f2c5",
    	"cur-bz-s": "f2c5",
    	"cur-cad": "f2d0",
    	"cur-cad-s": "f2cf",
    	"cur-chf": "f2f0",
    	"cur-chf-s": "f2ef",
    	"cur-cny": "f314",
    	"cur-cny-s": "f313",
    	"sym-cs": "f328",
    	"sym-cs-s": "f327",
    	"sym-crm": "f340",
    	"sym-crm-s": "f33f",
    	"cur-dai": "f371",
    	"cur-dai-s": "f370",
    	"sym-xdg": "f3af",
    	"sym-xdg-s": "f3ae",
    	"cur-eos": "f3fc",
    	"cur-eos-s": "f3fb",
    	"sym-eth2": "f40c",
    	"sym-eth2s": "f40c",
    	"sym-eth2.s": "f40c",
    	"cur-eth": "f40c",
    	"sym-eth2-s": "f40b",
    	"sym-eth2s-s": "f40b",
    	"sym-eth2.s-s": "f40b",
    	"cur-eth-s": "f40b",
    	"cur-eur": "f418",
    	"cur-eur-s": "f417",
    	"cur-eurs": "f41c",
    	"cur-eurs-s": "f41b",
    	"sym-usdt": "f41e",
    	"cur-usdt": "f41e",
    	"sym-usdt-s": "f41d",
    	"cur-usdt-s": "f41d",
    	"exc-kraken": "f436",
    	"exc-kraken-futures": "f436",
    	"exc-kraken-s": "f435",
    	"exc-kraken-futures-s": "f435",
    	"cur-gbp": "f48c",
    	"cur-gbp-s": "f48b",
    	"exc-gemini": "f4d6",
    	"cur-gusd": "f4d6",
    	"exc-gemini-s": "f4d5",
    	"cur-gusd-s": "f4d5",
    	"cur-hkd": "f4fa",
    	"cur-hkd-s": "f4f9",
    	"sym-husd": "f518",
    	"exc-huobi": "f518",
    	"cur-ht": "f518",
    	"sym-husd-s": "f517",
    	"exc-huobi-s": "f517",
    	"cur-ht-s": "f517",
    	"cur-idr": "f538",
    	"cur-idr-s": "f537",
    	"sym-iota": "f560",
    	"sym-iota-s": "f55f",
    	"cur-inr": "f552",
    	"cur-inr-s": "f551",
    	"cur-jpy": "f576",
    	"cur-jpy-s": "f575",
    	"cur-krw": "f5a8",
    	"cur-krw-s": "f5a7",
    	"sym-medx": "f624",
    	"sym-medx-s": "f623",
    	"cur-mxn": "f67c",
    	"cur-mxn-s": "f67b",
    	"cur-myr": "f67e",
    	"cur-myr-s": "f67d",
    	"cur-ngn": "f6a8",
    	"cur-ngn-s": "f6a7",
    	"cur-pax": "f722",
    	"cur-pax-s": "f721",
    	"cur-php": "f73a",
    	"cur-php-s": "f739",
    	"cur-pln": "f750",
    	"cur-pln-s": "f74f",
    	"cur-qash": "f788",
    	"cur-qash-s": "f787",
    	"cur-rub": "f806",
    	"cur-rur": "f806",
    	"cur-rub-s": "f805",
    	"cur-rur-s": "f805",
    	"sym-steem": "f81e",
    	"sym-steem-s": "f81d",
    	"sym-xsc": "f822",
    	"sym-xsc-s": "f821",
    	"cur-sgd": "f83e",
    	"cur-sgd-s": "f83d",
    	"sym-storj": "f854",
    	"sym-storj-s": "f853",
    	"sym-tel": "f8dc",
    	"cur-trx": "f925",
    	"cur-trx-s": "f924",
    	"cur-tusd": "f935",
    	"cur-tusd-s": "f934",
    	"cur-usd": "f957",
    	"cur-usd-s": "f956",
    	"cur-usdc": "f959",
    	"cur-usdc-s": "f958",
    	"sym-vet": "f977",
    	"sym-vet-s": "f976",
    	"sym-waxp": "f9a9",
    	"sym-waxp-s": "f9a8",
    	"cur-xlm": "f9e9",
    	"cur-xlm-s": "f9e8",
    	"cur-xmr": "f9ed",
    	"cur-xmr-s": "f9ec",
    	"cur-xrp": "fa01",
    	"cur-xrp-s": "fa00",
    	"cur-zar": "fa29",
    	"cur-zar-s": "fa28",
    	"exc-binance-us": "f108",
    	"exc-binance-us-s": "f107",
    	"exc-mexbt": "f11e",
    	"exc-mexbt-s": "f11d",
    	"exc-coinbase-pro": "f12c",
    	"exc-gdax": "f12c",
    	"exc-coinbase-pro-s": "f12b",
    	"exc-gdax-s": "f12b",
    	"exc-quadriga": "f155",
    	"exc-quadriga-s": "f154",
    	"cur-crc": "f334",
    	"cur-crc-s": "f333",
    	"cur-lak": "f5b2",
    	"cur-lak-s": "f5b1",
    	"cur-sek": "f82e",
    	"cur-sek-s": "f82d",
    	"cur-thb": "f8eb",
    	"cur-thb-s": "f8ea",
    	"cur-try": "f927",
    	"cur-try-s": "f926",
    	"cur-uah": "f93b",
    	"cur-uah-s": "f93a",
    	"exc-ftx": "f46c",
    	"exc-ftx-s": "f46b",
    	"exc-ftx-us": "f46c",
    	"exc-ftx-us-s": "f46b",
    	"sym-cgld": "f2e0",
    	"sym-cgld-s": "f2df",
    	"exc-uniswap-v2": "f94f",
    	"exc-uniswap-v2-s": "f94e",
    	"sym-kshib": "f844",
    	"sym-kshib-s": "f843",
    	"sym-easy-s": "f3d0",
    	"sym-srare": "f7b2",
    	"sym-srare-s": "f7b1",
    	"sym-ape.2": "f1d9",
    	"sym-ape.2-s": "f1d8"
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
    var amb = "AirDAO";
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
    var axl = "Axelar Network";
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
    var crust = "";
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
    var dmd = "DMD";
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
    var ethw = "EthereumPoW";
    var etn = "Electroneum";
    var etp = "Metaverse ETP";
    var eul = "Euler";
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
    var flux = "Flux";
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
    var gal = "Galxe";
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
    var gene = "Genopets";
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
    var gmx = "GMX";
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
    var hydra = "Hydra";
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
    var moon = "r/CryptoCurrency Moons";
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
    var oak = "";
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
    var ply = "Aurigami";
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
    var rdn = "Raiden Network";
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
    var ssv = "SSV Network";
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
    var sui = "";
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
    var umami = "";
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
    	"crypto-com": "",
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
    	crust: crust,
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
    	eul: eul,
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
    	flux: flux,
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
    	gmx: gmx,
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
    	oak: oak,
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
    	ssv: ssv,
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
    	sui: sui,
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
    	umami: umami,
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
