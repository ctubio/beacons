
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

    var ustc = "fa3a";
    var beacons = {
    	"exc-_default-s": "f101",
    	"exc-_default": "f102",
    	"sym-_default-s": "f169",
    	"sym-_default": "f16a",
    	"sym-d": "f16a",
    	"sym-d-s": "f169",
    	"sym-default": "f16a",
    	"sym-default-s": "f169",
    	"exc-d": "f102",
    	"exc-d-s": "f101",
    	"exc-default": "f102",
    	"exc-default-s": "f101",
    	"cur-default": "f16a",
    	"cur-default-s": "f169",
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
    	"exc-crypto-com": "f132",
    	"exc-cryptofacilities-s": "f133",
    	"exc-cryptofacilities": "f134",
    	"exc-deribit-s": "f135",
    	"exc-deribit": "f136",
    	"exc-dex-aggregated-s": "f137",
    	"exc-dex-aggregated": "f138",
    	"exc-gateio-s": "f139",
    	"exc-gateio": "f13a",
    	"exc-hitbtc-s": "f13b",
    	"exc-hitbtc": "f13c",
    	"exc-kucoin-s": "f13d",
    	"exc-kucoin": "f13e",
    	"exc-liquid-s": "f13f",
    	"exc-liquid": "f140",
    	"exc-luno-s": "f141",
    	"exc-luno": "f142",
    	"exc-mtgox-s": "f143",
    	"exc-mtgox": "f144",
    	"exc-mxc-s": "f145",
    	"exc-mxc": "f146",
    	"exc-nbatopshop-s": "f147",
    	"exc-nbatopshop": "f148",
    	"exc-nymex-s": "f149",
    	"exc-nymex": "f14a",
    	"exc-okcoin-s": "f14b",
    	"exc-okcoin": "f14c",
    	"exc-okx-s": "f14d",
    	"exc-okx": "f14e",
    	"exc-opensea-s": "f14f",
    	"exc-opensea": "f150",
    	"exc-poloniex-s": "f151",
    	"exc-poloniex": "f152",
    	"exc-qryptos-s": "f153",
    	"exc-qryptos": "f154",
    	"exc-quadrigacx-s": "f155",
    	"exc-quadrigacx": "f156",
    	"exc-quick-s": "f157",
    	"exc-quick": "f158",
    	"exc-quoine-s": "f159",
    	"exc-quoine": "f15a",
    	"exc-rarible-s": "f15b",
    	"exc-rarible": "f15c",
    	"exc-totle-s": "f15d",
    	"exc-totle": "f15e",
    	"exc-upbit-s": "f15f",
    	"exc-upbit": "f160",
    	"exc-vaultofsatoshi-s": "f161",
    	"exc-vaultofsatoshi": "f162",
    	"exc-wex-s": "f163",
    	"exc-wex": "f164",
    	"exc-zaif-s": "f165",
    	"exc-zaif": "f166",
    	"exc-zonda-s": "f167",
    	"exc-zonda": "f168",
    	"sym-1inch-s": "f16b",
    	"sym-1inch": "f16c",
    	"sym-1st-s": "f16d",
    	"sym-1st": "f16e",
    	"sym-6a-s": "f16f",
    	"sym-6a": "f170",
    	"sym-6b-s": "f171",
    	"sym-6b": "f172",
    	"sym-6c-s": "f173",
    	"sym-6c": "f174",
    	"sym-6e-s": "f175",
    	"sym-6e": "f176",
    	"sym-6j-s": "f177",
    	"sym-6j": "f178",
    	"sym-6l-s": "f179",
    	"sym-6l": "f17a",
    	"sym-6m-s": "f17b",
    	"sym-6m": "f17c",
    	"sym-6n-s": "f17d",
    	"sym-6n": "f17e",
    	"sym-6s-s": "f17f",
    	"sym-6s": "f180",
    	"sym-a38-s": "f181",
    	"sym-a38": "f182",
    	"sym-aac-s": "f183",
    	"sym-aac": "f184",
    	"sym-aave-s": "f185",
    	"sym-aave": "f186",
    	"sym-abbc-s": "f187",
    	"sym-abbc": "f188",
    	"sym-abt-s": "f189",
    	"sym-abt": "f18a",
    	"sym-abyss-s": "f18b",
    	"sym-abyss": "f18c",
    	"sym-aca-s": "f18d",
    	"sym-aca": "f18e",
    	"sym-acat-s": "f18f",
    	"sym-acat": "f190",
    	"sym-ach-s": "f191",
    	"sym-ach": "f192",
    	"sym-act-s": "f193",
    	"sym-act": "f194",
    	"sym-ad0-s": "f195",
    	"sym-ad0": "f196",
    	"sym-ada-s": "f197",
    	"sym-ada": "f198",
    	"sym-adel-s": "f199",
    	"sym-adel": "f19a",
    	"sym-adh-s": "f19b",
    	"sym-adh": "f19c",
    	"sym-adm-s": "f19d",
    	"sym-adm": "f19e",
    	"sym-ado-s": "f19f",
    	"sym-ado": "f1a0",
    	"sym-adt-s": "f1a1",
    	"sym-adt": "f1a2",
    	"sym-adx-s": "f1a3",
    	"sym-adx": "f1a4",
    	"sym-ae-s": "f1a5",
    	"sym-ae": "f1a6",
    	"sym-aed-s": "f1a7",
    	"sym-aed": "f1a8",
    	"sym-aeon-s": "f1a9",
    	"sym-aeon": "f1aa",
    	"sym-aep-s": "f1ab",
    	"sym-aep": "f1ac",
    	"sym-aergo-s": "f1ad",
    	"sym-aergo": "f1ae",
    	"sym-agi-s": "f1af",
    	"sym-agi": "f1b0",
    	"sym-agld-s": "f1b1",
    	"sym-agld": "f1b2",
    	"sym-aid-s": "f1b3",
    	"sym-aid": "f1b4",
    	"sym-aion-s": "f1b5",
    	"sym-aion": "f1b6",
    	"sym-air-s": "f1b7",
    	"sym-air": "f1b8",
    	"sym-akro-s": "f1b9",
    	"sym-akro": "f1ba",
    	"sym-akt-s": "f1bb",
    	"sym-akt": "f1bc",
    	"sym-alcx-s": "f1bd",
    	"sym-alcx": "f1be",
    	"sym-aleph-s": "f1bf",
    	"sym-aleph": "f1c0",
    	"sym-algo-s": "f1c1",
    	"sym-algo": "f1c2",
    	"sym-ali-s": "f1c3",
    	"sym-ali": "f1c4",
    	"sym-alice-s": "f1c5",
    	"sym-alice": "f1c6",
    	"sym-alpha-s": "f1c7",
    	"sym-alpha": "f1c8",
    	"sym-amb-s": "f1c9",
    	"sym-amb": "f1ca",
    	"sym-amlt-s": "f1cb",
    	"sym-amlt": "f1cc",
    	"sym-amp-s": "f1cd",
    	"sym-amp": "f1ce",
    	"sym-ampl-s": "f1cf",
    	"sym-ampl": "f1d0",
    	"sym-anc-s": "f1d1",
    	"sym-anc": "f1d2",
    	"sym-anct-s": "f1d3",
    	"sym-anct": "f1d4",
    	"sym-ankr-s": "f1d5",
    	"sym-ankr": "f1d6",
    	"sym-ant-s": "f1d7",
    	"sym-ant": "f1d8",
    	"sym-ape-s": "f1d9",
    	"sym-ape": "f1da",
    	"sym-api3-s": "f1db",
    	"sym-api3": "f1dc",
    	"sym-apis-s": "f1dd",
    	"sym-apis": "f1de",
    	"sym-appc-s": "f1df",
    	"sym-appc": "f1e0",
    	"sym-aptos-s": "f1e1",
    	"sym-aptos": "f1e2",
    	"sym-ar-s": "f1e3",
    	"sym-ar": "f1e4",
    	"sym-arbi-s": "f1e5",
    	"sym-arbi": "f1e6",
    	"sym-ardr-s": "f1e7",
    	"sym-ardr": "f1e8",
    	"sym-ark-s": "f1e9",
    	"sym-ark": "f1ea",
    	"sym-arn-s": "f1eb",
    	"sym-arn": "f1ec",
    	"sym-arpa-s": "f1ed",
    	"sym-arpa": "f1ee",
    	"sym-art-s": "f1ef",
    	"sym-art": "f1f0",
    	"sym-aspt-s": "f1f1",
    	"sym-aspt": "f1f2",
    	"sym-ast-s": "f1f3",
    	"sym-ast": "f1f4",
    	"sym-astr-s": "f1f5",
    	"sym-astr": "f1f6",
    	"sym-at-s": "f1f7",
    	"sym-at": "f1f8",
    	"sym-atlas-s": "f1f9",
    	"sym-atlas": "f1fa",
    	"sym-atm-s": "f1fb",
    	"sym-atm": "f1fc",
    	"sym-atom-s": "f1fd",
    	"sym-atom": "f1fe",
    	"sym-atp-s": "f1ff",
    	"sym-atp": "f200",
    	"sym-atri-s": "f201",
    	"sym-atri": "f202",
    	"sym-auction-s": "f203",
    	"sym-auction": "f204",
    	"sym-aud-s": "f205",
    	"sym-aud": "f206",
    	"sym-audio-s": "f207",
    	"sym-audio": "f208",
    	"sym-aup-s": "f209",
    	"sym-aup": "f20a",
    	"sym-aury-s": "f20b",
    	"sym-aury": "f20c",
    	"sym-ausd-s": "f20d",
    	"sym-ausd": "f20e",
    	"sym-auto-s": "f20f",
    	"sym-auto": "f210",
    	"sym-ava-s": "f211",
    	"sym-ava": "f212",
    	"sym-avax-s": "f213",
    	"sym-avax": "f214",
    	"sym-avt-s": "f215",
    	"sym-avt": "f216",
    	"sym-axl-s": "f217",
    	"sym-axl": "f218",
    	"sym-axpr-s": "f219",
    	"sym-axpr": "f21a",
    	"sym-axs-s": "f21b",
    	"sym-axs": "f21c",
    	"sym-b": "f21d",
    	"sym-b0-s": "f21e",
    	"sym-b0": "f21f",
    	"sym-b2g-s": "f220",
    	"sym-b2g": "f221",
    	"sym-bab-s": "f222",
    	"sym-bab": "f223",
    	"sym-badger-s": "f224",
    	"sym-badger": "f225",
    	"sym-bake-s": "f226",
    	"sym-bake": "f227",
    	"sym-bal-s": "f228",
    	"sym-bal": "f229",
    	"sym-banca-s": "f22a",
    	"sym-banca": "f22b",
    	"sym-band-s": "f22c",
    	"sym-band": "f22d",
    	"sym-bat-s": "f22e",
    	"sym-bat": "f22f",
    	"sym-bay-s": "f230",
    	"sym-bay": "f231",
    	"sym-bbc-s": "f232",
    	"sym-bbc": "f233",
    	"sym-bcc-s": "f234",
    	"sym-bcc": "f235",
    	"sym-bcd-s": "f236",
    	"sym-bcd": "f237",
    	"sym-bch-s": "f238",
    	"sym-bch": "f239",
    	"sym-bci-s": "f23a",
    	"sym-bci": "f23b",
    	"sym-bcn-s": "f23c",
    	"sym-bcn": "f23d",
    	"sym-bcpt-s": "f23e",
    	"sym-bcpt": "f23f",
    	"sym-bcu-s": "f240",
    	"sym-bcu": "f241",
    	"sym-bcv-s": "f242",
    	"sym-bcv": "f243",
    	"sym-bcy-s": "f244",
    	"sym-bcy": "f245",
    	"sym-bdg-s": "f246",
    	"sym-bdg": "f247",
    	"sym-beam-s": "f248",
    	"sym-beam": "f249",
    	"sym-beet-s": "f24a",
    	"sym-beet": "f24b",
    	"sym-bel-s": "f24c",
    	"sym-bel": "f24d",
    	"sym-bela-s": "f24e",
    	"sym-bela": "f24f",
    	"sym-berry-s": "f250",
    	"sym-berry": "f251",
    	"sym-beta-s": "f252",
    	"sym-beta": "f253",
    	"sym-betr-s": "f254",
    	"sym-betr": "f255",
    	"sym-bez-s": "f256",
    	"sym-bez": "f257",
    	"sym-bft-s": "f258",
    	"sym-bft": "f259",
    	"sym-bfx-s": "f25a",
    	"sym-bfx": "f25b",
    	"sym-bhd-s": "f25c",
    	"sym-bhd": "f25d",
    	"sym-bht-s": "f25e",
    	"sym-bht": "f25f",
    	"sym-bico-s": "f260",
    	"sym-bico": "f261",
    	"sym-bit-s": "f262",
    	"sym-bit": "f263",
    	"sym-bitb-s": "f264",
    	"sym-bitb": "f265",
    	"sym-bix-s": "f266",
    	"sym-bix": "f267",
    	"sym-bk-s": "f268",
    	"sym-bk": "f269",
    	"sym-bkx-s": "f26a",
    	"sym-bkx": "f26b",
    	"sym-blk-s": "f26c",
    	"sym-blk": "f26d",
    	"sym-block-s": "f26e",
    	"sym-block": "f26f",
    	"sym-blok-s": "f270",
    	"sym-blok": "f271",
    	"sym-blt-s": "f272",
    	"sym-blt": "f273",
    	"sym-blz-s": "f274",
    	"sym-blz": "f275",
    	"sym-bmc-s": "f276",
    	"sym-bmc": "f277",
    	"sym-bnb-s": "f278",
    	"sym-bnb": "f279",
    	"sym-bnc-s": "f27a",
    	"sym-bnc": "f27b",
    	"sym-bnk-s": "f27c",
    	"sym-bnk": "f27d",
    	"sym-bnt-s": "f27e",
    	"sym-bnt": "f27f",
    	"sym-bo-s": "f280",
    	"sym-bo": "f281",
    	"sym-boba-s": "f282",
    	"sym-boba": "f283",
    	"sym-bond-s": "f284",
    	"sym-bond": "f285",
    	"sym-boo-s": "f286",
    	"sym-boo": "f287",
    	"sym-bor-s": "f288",
    	"sym-bor": "f289",
    	"sym-bora-s": "f28a",
    	"sym-bora": "f28b",
    	"sym-bos-s": "f28c",
    	"sym-bos": "f28d",
    	"sym-box-s": "f28e",
    	"sym-box": "f28f",
    	"sym-brd-s": "f290",
    	"sym-brd": "f291",
    	"sym-breed-s": "f292",
    	"sym-breed": "f293",
    	"sym-brg-s": "f294",
    	"sym-brg": "f295",
    	"sym-brick-s": "f296",
    	"sym-brick": "f297",
    	"sym-bsd-s": "f298",
    	"sym-bsd": "f299",
    	"sym-bsv-s": "f29a",
    	"sym-bsv": "f29b",
    	"sym-bsx-s": "f29c",
    	"sym-bsx": "f29d",
    	"sym-bt1-s": "f29e",
    	"sym-bt1": "f29f",
    	"sym-bt2-s": "f2a0",
    	"sym-bt2": "f2a1",
    	"sym-btc-s": "f2a2",
    	"sym-btc": "f2a3",
    	"sym-btcd-s": "f2a4",
    	"sym-btcd": "f2a5",
    	"sym-btcfx-s": "f2a6",
    	"sym-btcfx": "f2a7",
    	"sym-btcp-s": "f2a8",
    	"sym-btcp": "f2a9",
    	"sym-btg-s": "f2aa",
    	"sym-btg": "f2ab",
    	"sym-btm-s": "f2ac",
    	"sym-btm": "f2ad",
    	"sym-btn-s": "f2ae",
    	"sym-btn": "f2af",
    	"sym-bto-s": "f2b0",
    	"sym-bto": "f2b1",
    	"sym-btrst-s": "f2b2",
    	"sym-btrst": "f2b3",
    	"sym-bts-s": "f2b4",
    	"sym-bts": "f2b5",
    	"sym-btt-s": "f2b6",
    	"sym-btt": "f2b7",
    	"sym-btu-s": "f2b8",
    	"sym-btu": "f2b9",
    	"sym-btx-s": "f2ba",
    	"sym-btx": "f2bb",
    	"sym-burger-s": "f2bc",
    	"sym-burger": "f2bd",
    	"sym-burst-s": "f2be",
    	"sym-burst": "f2bf",
    	"sym-bus-s": "f2c0",
    	"sym-bus": "f2c1",
    	"sym-busd-s": "f2c2",
    	"sym-busd": "f2c3",
    	"sym-bwx-s": "f2c4",
    	"sym-bwx": "f2c5",
    	"sym-bz-s": "f2c6",
    	"sym-bz": "f2c7",
    	"sym-bzrx-s": "f2c8",
    	"sym-bzrx": "f2c9",
    	"sym-c-s": "f2ca",
    	"sym-c": "f2cb",
    	"sym-c20-s": "f2cc",
    	"sym-c20": "f2cd",
    	"sym-c98-s": "f2ce",
    	"sym-c98": "f2cf",
    	"sym-cad-s": "f2d0",
    	"sym-cad": "f2d1",
    	"sym-cake-s": "f2d2",
    	"sym-cake": "f2d3",
    	"sym-cas-s": "f2d4",
    	"sym-cas": "f2d5",
    	"sym-cat-s": "f2d6",
    	"sym-cat": "f2d7",
    	"sym-cbc-s": "f2d8",
    	"sym-cbc": "f2d9",
    	"sym-cbt-s": "f2da",
    	"sym-cbt": "f2db",
    	"sym-cdt-s": "f2dc",
    	"sym-cdt": "f2dd",
    	"sym-cel-s": "f2de",
    	"sym-cel": "f2df",
    	"sym-celo-s": "f2e0",
    	"sym-celo": "f2e1",
    	"sym-celr-s": "f2e2",
    	"sym-celr": "f2e3",
    	"sym-cennz-s": "f2e4",
    	"sym-cennz": "f2e5",
    	"sym-cfg-s": "f2e6",
    	"sym-cfg": "f2e7",
    	"sym-cfi-s": "f2e8",
    	"sym-cfi": "f2e9",
    	"sym-cfx-s": "f2ea",
    	"sym-cfx": "f2eb",
    	"sym-cgt-s": "f2ec",
    	"sym-cgt": "f2ed",
    	"sym-chat-s": "f2ee",
    	"sym-chat": "f2ef",
    	"sym-chf-s": "f2f0",
    	"sym-chf": "f2f1",
    	"sym-chp-s": "f2f2",
    	"sym-chp": "f2f3",
    	"sym-chr-s": "f2f4",
    	"sym-chr": "f2f5",
    	"sym-chsb-s": "f2f6",
    	"sym-chsb": "f2f7",
    	"sym-chx-s": "f2f8",
    	"sym-chx": "f2f9",
    	"sym-chz-s": "f2fa",
    	"sym-chz": "f2fb",
    	"sym-ckb-s": "f2fc",
    	"sym-ckb": "f2fd",
    	"sym-cl-s": "f2fe",
    	"sym-cl": "f2ff",
    	"sym-clam-s": "f300",
    	"sym-clam": "f301",
    	"sym-cln-s": "f302",
    	"sym-cln": "f303",
    	"sym-clo-s": "f304",
    	"sym-clo": "f305",
    	"sym-cloak-s": "f306",
    	"sym-cloak": "f307",
    	"sym-clv-s": "f308",
    	"sym-clv": "f309",
    	"sym-cmct-s": "f30a",
    	"sym-cmct": "f30b",
    	"sym-cmt-s": "f30c",
    	"sym-cmt": "f30d",
    	"sym-cnd-s": "f30e",
    	"sym-cnd": "f30f",
    	"sym-cnn-s": "f310",
    	"sym-cnn": "f311",
    	"sym-cnx-s": "f312",
    	"sym-cnx": "f313",
    	"sym-cny-s": "f314",
    	"sym-cny": "f315",
    	"sym-cob-s": "f316",
    	"sym-cob": "f317",
    	"sym-cocos-s": "f318",
    	"sym-cocos": "f319",
    	"sym-comp-s": "f31a",
    	"sym-comp": "f31b",
    	"sym-cope-s": "f31c",
    	"sym-cope": "f31d",
    	"sym-cos-s": "f31e",
    	"sym-cos": "f31f",
    	"sym-cosm-s": "f320",
    	"sym-cosm": "f321",
    	"sym-coss-s": "f322",
    	"sym-coss": "f323",
    	"sym-coti-s": "f324",
    	"sym-coti": "f325",
    	"sym-cov-s": "f326",
    	"sym-cov": "f327",
    	"sym-cova-s": "f328",
    	"sym-cova": "f329",
    	"sym-cpt-s": "f32a",
    	"sym-cpt": "f32b",
    	"sym-cpx-s": "f32c",
    	"sym-cpx": "f32d",
    	"sym-cqt-s": "f32e",
    	"sym-cqt": "f32f",
    	"sym-cra-s": "f330",
    	"sym-cra": "f331",
    	"sym-crab-s": "f332",
    	"sym-crab": "f333",
    	"sym-crc-s": "f334",
    	"sym-crc": "f335",
    	"sym-cre-s": "f336",
    	"sym-cre": "f337",
    	"sym-cream-s": "f338",
    	"sym-cream": "f339",
    	"sym-cring-s": "f33a",
    	"sym-cring": "f33b",
    	"sym-cro-s": "f33c",
    	"sym-cro": "f33d",
    	"sym-crpt-s": "f33e",
    	"sym-crpt": "f33f",
    	"sym-cru-s": "f340",
    	"sym-cru": "f341",
    	"sym-crv-s": "f342",
    	"sym-crv": "f343",
    	"sym-crw-s": "f344",
    	"sym-crw": "f345",
    	"sym-csm-s": "f346",
    	"sym-csm": "f347",
    	"sym-csx-s": "f348",
    	"sym-csx": "f349",
    	"sym-ctc-s": "f34a",
    	"sym-ctc": "f34b",
    	"sym-ctk-s": "f34c",
    	"sym-ctk": "f34d",
    	"sym-ctsi-s": "f34e",
    	"sym-ctsi": "f34f",
    	"sym-ctxc-s": "f350",
    	"sym-ctxc": "f351",
    	"sym-cult-s": "f352",
    	"sym-cult": "f353",
    	"sym-cur-s": "f354",
    	"sym-cur": "f355",
    	"sym-cvc-s": "f356",
    	"sym-cvc": "f357",
    	"sym-cvcoin-s": "f358",
    	"sym-cvcoin": "f359",
    	"sym-cvnt-s": "f35a",
    	"sym-cvnt": "f35b",
    	"sym-cvp-s": "f35c",
    	"sym-cvp": "f35d",
    	"sym-cvt-s": "f35e",
    	"sym-cvt": "f35f",
    	"sym-cvx-s": "f360",
    	"sym-cvx": "f361",
    	"sym-cw-s": "f362",
    	"sym-cw": "f363",
    	"sym-cyc-s": "f364",
    	"sym-cyc": "f365",
    	"sym-dac-s": "f366",
    	"sym-dac": "f367",
    	"sym-dacs-s": "f368",
    	"sym-dacs": "f369",
    	"sym-dadi-s": "f36a",
    	"sym-dadi": "f36b",
    	"sym-dag-s": "f36c",
    	"sym-dag": "f36d",
    	"sym-dai-s": "f36e",
    	"sym-dai": "f36f",
    	"sym-dao-s": "f370",
    	"sym-dao": "f371",
    	"sym-dar-s": "f372",
    	"sym-dar": "f373",
    	"sym-dash-s": "f374",
    	"sym-dash": "f375",
    	"sym-dat-s": "f376",
    	"sym-dat": "f377",
    	"sym-data-s": "f378",
    	"sym-data": "f379",
    	"sym-datx-s": "f37a",
    	"sym-datx": "f37b",
    	"sym-dbc-s": "f37c",
    	"sym-dbc": "f37d",
    	"sym-dbet-s": "f37e",
    	"sym-dbet": "f37f",
    	"sym-dbix-s": "f380",
    	"sym-dbix": "f381",
    	"sym-dcn-s": "f382",
    	"sym-dcn": "f383",
    	"sym-dcr-s": "f384",
    	"sym-dcr": "f385",
    	"sym-dct-s": "f386",
    	"sym-dct": "f387",
    	"sym-ddd-s": "f388",
    	"sym-ddd": "f389",
    	"sym-dego-s": "f38a",
    	"sym-dego": "f38b",
    	"sym-dent-s": "f38c",
    	"sym-dent": "f38d",
    	"sym-dext-s": "f38e",
    	"sym-dext": "f38f",
    	"sym-dgb-s": "f390",
    	"sym-dgb": "f391",
    	"sym-dgd-s": "f392",
    	"sym-dgd": "f393",
    	"sym-dgtx-s": "f394",
    	"sym-dgtx": "f395",
    	"sym-dgx-s": "f396",
    	"sym-dgx": "f397",
    	"sym-dhx-s": "f398",
    	"sym-dhx": "f399",
    	"sym-dia-s": "f39a",
    	"sym-dia": "f39b",
    	"sym-dice-s": "f39c",
    	"sym-dice": "f39d",
    	"sym-dim-s": "f39e",
    	"sym-dim": "f39f",
    	"sym-dlt-s": "f3a0",
    	"sym-dlt": "f3a1",
    	"sym-dmd-s": "f3a2",
    	"sym-dmd": "f3a3",
    	"sym-dmt-s": "f3a4",
    	"sym-dmt": "f3a5",
    	"sym-dnt-s": "f3a6",
    	"sym-dnt": "f3a7",
    	"sym-dock-s": "f3a8",
    	"sym-dock": "f3a9",
    	"sym-dodo-s": "f3aa",
    	"sym-dodo": "f3ab",
    	"sym-doge-s": "f3ac",
    	"sym-doge": "f3ad",
    	"sym-dose-s": "f3ae",
    	"sym-dose": "f3af",
    	"sym-dot-s": "f3b0",
    	"sym-dot": "f3b1",
    	"sym-dpx-s": "f3b2",
    	"sym-dpx": "f3b3",
    	"sym-dpy-s": "f3b4",
    	"sym-dpy": "f3b5",
    	"sym-dream-s": "f3b6",
    	"sym-dream": "f3b7",
    	"sym-drep-s": "f3b8",
    	"sym-drep": "f3b9",
    	"sym-drg-s": "f3ba",
    	"sym-drg": "f3bb",
    	"sym-drgn-s": "f3bc",
    	"sym-drgn": "f3bd",
    	"sym-drt-s": "f3be",
    	"sym-drt": "f3bf",
    	"sym-dta-s": "f3c0",
    	"sym-dta": "f3c1",
    	"sym-dtb-s": "f3c2",
    	"sym-dtb": "f3c3",
    	"sym-dtr-s": "f3c4",
    	"sym-dtr": "f3c5",
    	"sym-dusk-s": "f3c6",
    	"sym-dusk": "f3c7",
    	"sym-dx-s": "f3c8",
    	"sym-dx": "f3c9",
    	"sym-dydx-s": "f3ca",
    	"sym-dydx": "f3cb",
    	"sym-dyn-s": "f3cc",
    	"sym-dyn": "f3cd",
    	"sym-easy": "f3ce",
    	"sym-ecom-s": "f3cf",
    	"sym-ecom": "f3d0",
    	"sym-edc-s": "f3d1",
    	"sym-edc": "f3d2",
    	"sym-edg-s": "f3d3",
    	"sym-edg": "f3d4",
    	"sym-edo-s": "f3d5",
    	"sym-edo": "f3d6",
    	"sym-edp-s": "f3d7",
    	"sym-edp": "f3d8",
    	"sym-edr-s": "f3d9",
    	"sym-edr": "f3da",
    	"sym-efi-s": "f3db",
    	"sym-efi": "f3dc",
    	"sym-egld-s": "f3dd",
    	"sym-egld": "f3de",
    	"sym-egt-s": "f3df",
    	"sym-egt": "f3e0",
    	"sym-ehr-s": "f3e1",
    	"sym-ehr": "f3e2",
    	"sym-eko-s": "f3e3",
    	"sym-eko": "f3e4",
    	"sym-ekt-s": "f3e5",
    	"sym-ekt": "f3e6",
    	"sym-ela-s": "f3e7",
    	"sym-ela": "f3e8",
    	"sym-elec-s": "f3e9",
    	"sym-elec": "f3ea",
    	"sym-elf-s": "f3eb",
    	"sym-elf": "f3ec",
    	"sym-em-s": "f3ed",
    	"sym-em": "f3ee",
    	"sym-emc-s": "f3ef",
    	"sym-emc": "f3f0",
    	"sym-emc2-s": "f3f1",
    	"sym-emc2": "f3f2",
    	"sym-eng-s": "f3f3",
    	"sym-eng": "f3f4",
    	"sym-enj-s": "f3f5",
    	"sym-enj": "f3f6",
    	"sym-ens-s": "f3f7",
    	"sym-ens": "f3f8",
    	"sym-eos-s": "f3f9",
    	"sym-eos": "f3fa",
    	"sym-eosdac-s": "f3fb",
    	"sym-eosdac": "f3fc",
    	"sym-eq-s": "f3fd",
    	"sym-eq": "f3fe",
    	"sym-erd-s": "f3ff",
    	"sym-erd": "f400",
    	"sym-ern-s": "f401",
    	"sym-ern": "f402",
    	"sym-es": "f403",
    	"sym-es-s": "f404",
    	"sym-esd-s": "f405",
    	"sym-esd": "f406",
    	"sym-etc-s": "f407",
    	"sym-etc": "f408",
    	"sym-eth-s": "f409",
    	"sym-eth": "f40a",
    	"sym-ethup-s": "f40b",
    	"sym-ethup": "f40c",
    	"sym-ethw-s": "f40d",
    	"sym-ethw": "f40e",
    	"sym-etn-s": "f40f",
    	"sym-etn": "f410",
    	"sym-etp-s": "f411",
    	"sym-etp": "f412",
    	"sym-eur-s": "f413",
    	"sym-eur": "f414",
    	"sym-euroc-s": "f415",
    	"sym-euroc": "f416",
    	"sym-eurs-s": "f417",
    	"sym-eurs": "f418",
    	"sym-eurt-s": "f419",
    	"sym-eurt": "f41a",
    	"sym-evn-s": "f41b",
    	"sym-evn": "f41c",
    	"sym-evx-s": "f41d",
    	"sym-evx": "f41e",
    	"sym-ewt-s": "f41f",
    	"sym-ewt": "f420",
    	"sym-exp-s": "f421",
    	"sym-exp": "f422",
    	"sym-exrd-s": "f423",
    	"sym-exrd": "f424",
    	"sym-exy-s": "f425",
    	"sym-exy": "f426",
    	"sym-ez-s": "f427",
    	"sym-ez": "f428",
    	"sym-fair-s": "f429",
    	"sym-fair": "f42a",
    	"sym-farm-s": "f42b",
    	"sym-farm": "f42c",
    	"sym-fct-s": "f42d",
    	"sym-fct": "f42e",
    	"sym-fdz-s": "f42f",
    	"sym-fdz": "f430",
    	"sym-fee-s": "f431",
    	"sym-fee": "f432",
    	"sym-fet-s": "f433",
    	"sym-fet": "f434",
    	"sym-fida-s": "f435",
    	"sym-fida": "f436",
    	"sym-fil-s": "f437",
    	"sym-fil": "f438",
    	"sym-fio-s": "f439",
    	"sym-fio": "f43a",
    	"sym-firo-s": "f43b",
    	"sym-firo": "f43c",
    	"sym-fis-s": "f43d",
    	"sym-fis": "f43e",
    	"sym-fldc-s": "f43f",
    	"sym-fldc": "f440",
    	"sym-flo-s": "f441",
    	"sym-flo": "f442",
    	"sym-floki-s": "f443",
    	"sym-floki": "f444",
    	"sym-flow-s": "f445",
    	"sym-flow": "f446",
    	"sym-flr-s": "f447",
    	"sym-flr": "f448",
    	"sym-fluz-s": "f449",
    	"sym-fluz": "f44a",
    	"sym-fnb-s": "f44b",
    	"sym-fnb": "f44c",
    	"sym-foam-s": "f44d",
    	"sym-foam": "f44e",
    	"sym-for-s": "f44f",
    	"sym-for": "f450",
    	"sym-forth-s": "f451",
    	"sym-forth": "f452",
    	"sym-fota-s": "f453",
    	"sym-fota": "f454",
    	"sym-fox-s": "f455",
    	"sym-fox": "f456",
    	"sym-fpis-s": "f457",
    	"sym-fpis": "f458",
    	"sym-frax-s": "f459",
    	"sym-frax": "f45a",
    	"sym-front-s": "f45b",
    	"sym-front": "f45c",
    	"sym-fsn-s": "f45d",
    	"sym-fsn": "f45e",
    	"sym-ftc-s": "f45f",
    	"sym-ftc": "f460",
    	"sym-fti-s": "f461",
    	"sym-fti": "f462",
    	"sym-ftm-s": "f463",
    	"sym-ftm": "f464",
    	"sym-ftt-s": "f465",
    	"sym-ftt": "f466",
    	"sym-ftx-s": "f467",
    	"sym-ftx": "f468",
    	"sym-fuel-s": "f469",
    	"sym-fuel": "f46a",
    	"sym-fun-s": "f46b",
    	"sym-fun": "f46c",
    	"sym-fx-s": "f46d",
    	"sym-fx": "f46e",
    	"sym-fxc-s": "f46f",
    	"sym-fxc": "f470",
    	"sym-fxs-s": "f471",
    	"sym-fxs": "f472",
    	"sym-fxt-s": "f473",
    	"sym-fxt": "f474",
    	"sym-gal-s": "f475",
    	"sym-gal": "f476",
    	"sym-gala-s": "f477",
    	"sym-gala": "f478",
    	"sym-game-s": "f479",
    	"sym-game": "f47a",
    	"sym-gamee-s": "f47b",
    	"sym-gamee": "f47c",
    	"sym-gard-s": "f47d",
    	"sym-gard": "f47e",
    	"sym-gari-s": "f47f",
    	"sym-gari": "f480",
    	"sym-gas-s": "f481",
    	"sym-gas": "f482",
    	"sym-gbc-s": "f483",
    	"sym-gbc": "f484",
    	"sym-gbp-s": "f485",
    	"sym-gbp": "f486",
    	"sym-gbx-s": "f487",
    	"sym-gbx": "f488",
    	"sym-gbyte-s": "f489",
    	"sym-gbyte": "f48a",
    	"sym-gc-s": "f48b",
    	"sym-gc": "f48c",
    	"sym-gcc-s": "f48d",
    	"sym-gcc": "f48e",
    	"sym-ge-s": "f48f",
    	"sym-ge": "f490",
    	"sym-geist-s": "f491",
    	"sym-geist": "f492",
    	"sym-gen-s": "f493",
    	"sym-gen": "f494",
    	"sym-gene-s": "f495",
    	"sym-gene": "f496",
    	"sym-gens-s": "f497",
    	"sym-gens": "f498",
    	"sym-get-s": "f499",
    	"sym-get": "f49a",
    	"sym-ghst-s": "f49b",
    	"sym-ghst": "f49c",
    	"sym-glc-s": "f49d",
    	"sym-glc": "f49e",
    	"sym-gld-s": "f49f",
    	"sym-gld": "f4a0",
    	"sym-glm-s": "f4a1",
    	"sym-glm": "f4a2",
    	"sym-glmr-s": "f4a3",
    	"sym-glmr": "f4a4",
    	"sym-gmat-s": "f4a5",
    	"sym-gmat": "f4a6",
    	"sym-gmt-s": "f4a7",
    	"sym-gmt": "f4a8",
    	"sym-gmt2-s": "f4a9",
    	"sym-gmt2": "f4aa",
    	"sym-gno-s": "f4ab",
    	"sym-gno": "f4ac",
    	"sym-gnt-s": "f4ad",
    	"sym-gnt": "f4ae",
    	"sym-gnx-s": "f4af",
    	"sym-gnx": "f4b0",
    	"sym-go-s": "f4b1",
    	"sym-go": "f4b2",
    	"sym-gods-s": "f4b3",
    	"sym-gods": "f4b4",
    	"sym-got-s": "f4b5",
    	"sym-got": "f4b6",
    	"sym-grc-s": "f4b7",
    	"sym-grc": "f4b8",
    	"sym-grin-s": "f4b9",
    	"sym-grin": "f4ba",
    	"sym-grs-s": "f4bb",
    	"sym-grs": "f4bc",
    	"sym-grt-s": "f4bd",
    	"sym-grt": "f4be",
    	"sym-gsc-s": "f4bf",
    	"sym-gsc": "f4c0",
    	"sym-gst-s": "f4c1",
    	"sym-gst": "f4c2",
    	"sym-gt-s": "f4c3",
    	"sym-gt": "f4c4",
    	"sym-gtc-s": "f4c5",
    	"sym-gtc": "f4c6",
    	"sym-gtc2-s": "f4c7",
    	"sym-gtc2": "f4c8",
    	"sym-gto-s": "f4c9",
    	"sym-gto": "f4ca",
    	"sym-gup-s": "f4cb",
    	"sym-gup": "f4cc",
    	"sym-gusd-s": "f4cd",
    	"sym-gusd": "f4ce",
    	"sym-gvt-s": "f4cf",
    	"sym-gvt": "f4d0",
    	"sym-gxc-s": "f4d1",
    	"sym-gxc": "f4d2",
    	"sym-gxs-s": "f4d3",
    	"sym-gxs": "f4d4",
    	"sym-hard-s": "f4d5",
    	"sym-hard": "f4d6",
    	"sym-hbar-s": "f4d7",
    	"sym-hbar": "f4d8",
    	"sym-hc-s": "f4d9",
    	"sym-hc": "f4da",
    	"sym-hdx-s": "f4db",
    	"sym-hdx": "f4dc",
    	"sym-hedg-s": "f4dd",
    	"sym-hedg": "f4de",
    	"sym-hegic-s": "f4df",
    	"sym-hegic": "f4e0",
    	"sym-hex-s": "f4e1",
    	"sym-hex": "f4e2",
    	"sym-hft-s": "f4e3",
    	"sym-hft": "f4e4",
    	"sym-hg-s": "f4e5",
    	"sym-hg": "f4e6",
    	"sym-hgs-s": "f4e7",
    	"sym-hgs": "f4e8",
    	"sym-hh-s": "f4e9",
    	"sym-hh": "f4ea",
    	"sym-high-s": "f4eb",
    	"sym-high": "f4ec",
    	"sym-hit-s": "f4ed",
    	"sym-hit": "f4ee",
    	"sym-hive-s": "f4ef",
    	"sym-hive": "f4f0",
    	"sym-hkd-s": "f4f1",
    	"sym-hkd": "f4f2",
    	"sym-hko-s": "f4f3",
    	"sym-hko": "f4f4",
    	"sym-hmq-s": "f4f5",
    	"sym-hmq": "f4f6",
    	"sym-hns-s": "f4f7",
    	"sym-hns": "f4f8",
    	"sym-ho-s": "f4f9",
    	"sym-ho": "f4fa",
    	"sym-hopr-s": "f4fb",
    	"sym-hopr": "f4fc",
    	"sym-hot-s": "f4fd",
    	"sym-hot": "f4fe",
    	"sym-hp-s": "f4ff",
    	"sym-hp": "f500",
    	"sym-hpb-s": "f501",
    	"sym-hpb": "f502",
    	"sym-hpc-s": "f503",
    	"sym-hpc": "f504",
    	"sym-hpt-s": "f505",
    	"sym-hpt": "f506",
    	"sym-hrc-s": "f507",
    	"sym-hrc": "f508",
    	"sym-hsc-s": "f509",
    	"sym-hsc": "f50a",
    	"sym-hsr-s": "f50b",
    	"sym-hsr": "f50c",
    	"sym-hst-s": "f50d",
    	"sym-hst": "f50e",
    	"sym-ht-s": "f50f",
    	"sym-ht": "f510",
    	"sym-html-s": "f511",
    	"sym-html": "f512",
    	"sym-htt-s": "f513",
    	"sym-htt": "f514",
    	"sym-huc-s": "f515",
    	"sym-huc": "f516",
    	"sym-hunt-s": "f517",
    	"sym-hunt": "f518",
    	"sym-hvn-s": "f519",
    	"sym-hvn": "f51a",
    	"sym-hxro-s": "f51b",
    	"sym-hxro": "f51c",
    	"sym-hyc-s": "f51d",
    	"sym-hyc": "f51e",
    	"sym-hydra-s": "f51f",
    	"sym-hydra": "f520",
    	"sym-hydro-s": "f521",
    	"sym-hydro": "f522",
    	"sym-icn-s": "f523",
    	"sym-icn": "f524",
    	"sym-icos-s": "f525",
    	"sym-icos": "f526",
    	"sym-icp-s": "f527",
    	"sym-icp": "f528",
    	"sym-icx-s": "f529",
    	"sym-icx": "f52a",
    	"sym-idex-s": "f52b",
    	"sym-idex": "f52c",
    	"sym-idh-s": "f52d",
    	"sym-idh": "f52e",
    	"sym-idr-s": "f52f",
    	"sym-idr": "f530",
    	"sym-ift-s": "f531",
    	"sym-ift": "f532",
    	"sym-ignis-s": "f533",
    	"sym-ignis": "f534",
    	"sym-ihf-s": "f535",
    	"sym-ihf": "f536",
    	"sym-iht-s": "f537",
    	"sym-iht": "f538",
    	"sym-ilc-s": "f539",
    	"sym-ilc": "f53a",
    	"sym-ilv-s": "f53b",
    	"sym-ilv": "f53c",
    	"sym-imx-s": "f53d",
    	"sym-imx": "f53e",
    	"sym-incnt-s": "f53f",
    	"sym-incnt": "f540",
    	"sym-ind-s": "f541",
    	"sym-ind": "f542",
    	"sym-indi-s": "f543",
    	"sym-indi": "f544",
    	"sym-inj-s": "f545",
    	"sym-inj": "f546",
    	"sym-ink-s": "f547",
    	"sym-ink": "f548",
    	"sym-inr-s": "f549",
    	"sym-inr": "f54a",
    	"sym-ins-s": "f54b",
    	"sym-ins": "f54c",
    	"sym-int-s": "f54d",
    	"sym-int": "f54e",
    	"sym-intr-s": "f54f",
    	"sym-intr": "f550",
    	"sym-ioc-s": "f551",
    	"sym-ioc": "f552",
    	"sym-ion-s": "f553",
    	"sym-ion": "f554",
    	"sym-iost-s": "f555",
    	"sym-iost": "f556",
    	"sym-iot-s": "f557",
    	"sym-iot": "f558",
    	"sym-iotx-s": "f559",
    	"sym-iotx": "f55a",
    	"sym-iq-s": "f55b",
    	"sym-iq": "f55c",
    	"sym-iris-s": "f55d",
    	"sym-iris": "f55e",
    	"sym-itc-s": "f55f",
    	"sym-itc": "f560",
    	"sym-ivy-s": "f561",
    	"sym-ivy": "f562",
    	"sym-ixt-s": "f563",
    	"sym-ixt": "f564",
    	"sym-jasmy-s": "f565",
    	"sym-jasmy": "f566",
    	"sym-jnt-s": "f567",
    	"sym-jnt": "f568",
    	"sym-joe-s": "f569",
    	"sym-joe": "f56a",
    	"sym-jpeg-s": "f56b",
    	"sym-jpeg": "f56c",
    	"sym-jpy-s": "f56d",
    	"sym-jpy": "f56e",
    	"sym-jst-s": "f56f",
    	"sym-jst": "f570",
    	"sym-juno-s": "f571",
    	"sym-juno": "f572",
    	"sym-just-s": "f573",
    	"sym-just": "f574",
    	"sym-juv-s": "f575",
    	"sym-juv": "f576",
    	"sym-kan-s": "f577",
    	"sym-kan": "f578",
    	"sym-kapex-s": "f579",
    	"sym-kapex": "f57a",
    	"sym-kar-s": "f57b",
    	"sym-kar": "f57c",
    	"sym-kava-s": "f57d",
    	"sym-kava": "f57e",
    	"sym-kbc-s": "f57f",
    	"sym-kbc": "f580",
    	"sym-kcash-s": "f581",
    	"sym-kcash": "f582",
    	"sym-kda-s": "f583",
    	"sym-kda": "f584",
    	"sym-keep-s": "f585",
    	"sym-keep": "f586",
    	"sym-key-s": "f587",
    	"sym-key": "f588",
    	"sym-kick-s": "f589",
    	"sym-kick": "f58a",
    	"sym-kilt-s": "f58b",
    	"sym-kilt": "f58c",
    	"sym-kin-s": "f58d",
    	"sym-kin": "f58e",
    	"sym-kint-s": "f58f",
    	"sym-kint": "f590",
    	"sym-klay-s": "f591",
    	"sym-klay": "f592",
    	"sym-kma-s": "f593",
    	"sym-kma": "f594",
    	"sym-kmd-s": "f595",
    	"sym-kmd": "f596",
    	"sym-knc-s": "f597",
    	"sym-knc": "f598",
    	"sym-kore-s": "f599",
    	"sym-kore": "f59a",
    	"sym-kp3r-s": "f59b",
    	"sym-kp3r": "f59c",
    	"sym-krm-s": "f59d",
    	"sym-krm": "f59e",
    	"sym-krw-s": "f59f",
    	"sym-krw": "f5a0",
    	"sym-ksm-s": "f5a1",
    	"sym-ksm": "f5a2",
    	"sym-ksx-s": "f5a3",
    	"sym-ksx": "f5a4",
    	"sym-kyl-s": "f5a5",
    	"sym-kyl": "f5a6",
    	"sym-la-s": "f5a7",
    	"sym-la": "f5a8",
    	"sym-lak-s": "f5a9",
    	"sym-lak": "f5aa",
    	"sym-lamb-s": "f5ab",
    	"sym-lamb": "f5ac",
    	"sym-latx-s": "f5ad",
    	"sym-latx": "f5ae",
    	"sym-layr-s": "f5af",
    	"sym-layr": "f5b0",
    	"sym-lba-s": "f5b1",
    	"sym-lba": "f5b2",
    	"sym-lbc-s": "f5b3",
    	"sym-lbc": "f5b4",
    	"sym-lcc-s": "f5b5",
    	"sym-lcc": "f5b6",
    	"sym-lcx-s": "f5b7",
    	"sym-lcx": "f5b8",
    	"sym-ldo-s": "f5b9",
    	"sym-ldo": "f5ba",
    	"sym-lend-s": "f5bb",
    	"sym-lend": "f5bc",
    	"sym-leo-s": "f5bd",
    	"sym-leo": "f5be",
    	"sym-leoc-s": "f5bf",
    	"sym-leoc": "f5c0",
    	"sym-let-s": "f5c1",
    	"sym-let": "f5c2",
    	"sym-life-s": "f5c3",
    	"sym-life": "f5c4",
    	"sym-lina-s": "f5c5",
    	"sym-lina": "f5c6",
    	"sym-link-s": "f5c7",
    	"sym-link": "f5c8",
    	"sym-lit-s": "f5c9",
    	"sym-lit": "f5ca",
    	"sym-lmc-s": "f5cb",
    	"sym-lmc": "f5cc",
    	"sym-lml-s": "f5cd",
    	"sym-lml": "f5ce",
    	"sym-lmwr-s": "f5cf",
    	"sym-lmwr": "f5d0",
    	"sym-lnc-s": "f5d1",
    	"sym-lnc": "f5d2",
    	"sym-lnd-s": "f5d3",
    	"sym-lnd": "f5d4",
    	"sym-loc-s": "f5d5",
    	"sym-loc": "f5d6",
    	"sym-loka-s": "f5d7",
    	"sym-loka": "f5d8",
    	"sym-looks-s": "f5d9",
    	"sym-looks": "f5da",
    	"sym-loom-s": "f5db",
    	"sym-loom": "f5dc",
    	"sym-lpt-s": "f5dd",
    	"sym-lpt": "f5de",
    	"sym-lqty-s": "f5df",
    	"sym-lqty": "f5e0",
    	"sym-lrc-s": "f5e1",
    	"sym-lrc": "f5e2",
    	"sym-lrn-s": "f5e3",
    	"sym-lrn": "f5e4",
    	"sym-lsk-s": "f5e5",
    	"sym-lsk": "f5e6",
    	"sym-ltc-s": "f5e7",
    	"sym-ltc": "f5e8",
    	"sym-lto-s": "f5e9",
    	"sym-lto": "f5ea",
    	"sym-lun-s": "f5eb",
    	"sym-lun": "f5ec",
    	"sym-luna-s": "f5ed",
    	"sym-luna": "f5ee",
    	"sym-luna2-s": "f5ef",
    	"sym-luna2": "f5f0",
    	"sym-lxt-s": "f5f1",
    	"sym-lxt": "f5f2",
    	"sym-lym-s": "f5f3",
    	"sym-lym": "f5f4",
    	"sym-m2k-s": "f5f5",
    	"sym-m2k": "f5f6",
    	"sym-ma-s": "f5f7",
    	"sym-ma": "f5f8",
    	"sym-magic-s": "f5f9",
    	"sym-magic": "f5fa",
    	"sym-maid-s": "f5fb",
    	"sym-maid": "f5fc",
    	"sym-man-s": "f5fd",
    	"sym-man": "f5fe",
    	"sym-mana-s": "f5ff",
    	"sym-mana": "f600",
    	"sym-maps-s": "f601",
    	"sym-maps": "f602",
    	"sym-mask-s": "f603",
    	"sym-mask": "f604",
    	"sym-mass-s": "f605",
    	"sym-mass": "f606",
    	"sym-math-s": "f607",
    	"sym-math": "f608",
    	"sym-matic-s": "f609",
    	"sym-matic": "f60a",
    	"sym-mbl-s": "f60b",
    	"sym-mbl": "f60c",
    	"sym-mbt-s": "f60d",
    	"sym-mbt": "f60e",
    	"sym-mc-s": "f60f",
    	"sym-mc": "f610",
    	"sym-mco-s": "f611",
    	"sym-mco": "f612",
    	"sym-mda-s": "f613",
    	"sym-mda": "f614",
    	"sym-mds-s": "f615",
    	"sym-mds": "f616",
    	"sym-mdt-s": "f617",
    	"sym-mdt": "f618",
    	"sym-mdx-s": "f619",
    	"sym-mdx": "f61a",
    	"sym-med-s": "f61b",
    	"sym-med": "f61c",
    	"sym-mer-s": "f61d",
    	"sym-mer": "f61e",
    	"sym-mes-s": "f61f",
    	"sym-mes": "f620",
    	"sym-met-s": "f621",
    	"sym-met": "f622",
    	"sym-meta-s": "f623",
    	"sym-meta": "f624",
    	"sym-metis-s": "f625",
    	"sym-metis": "f626",
    	"sym-mft-s": "f627",
    	"sym-mft": "f628",
    	"sym-mgc-s": "f629",
    	"sym-mgc": "f62a",
    	"sym-mgo-s": "f62b",
    	"sym-mgo": "f62c",
    	"sym-mhc-s": "f62d",
    	"sym-mhc": "f62e",
    	"sym-mina-s": "f62f",
    	"sym-mina": "f630",
    	"sym-mir-s": "f631",
    	"sym-mir": "f632",
    	"sym-mith-s": "f633",
    	"sym-mith": "f634",
    	"sym-mitx-s": "f635",
    	"sym-mitx": "f636",
    	"sym-mjp-s": "f637",
    	"sym-mjp": "f638",
    	"sym-mkr-s": "f639",
    	"sym-mkr": "f63a",
    	"sym-mln-s": "f63b",
    	"sym-mln": "f63c",
    	"sym-mngo-s": "f63d",
    	"sym-mngo": "f63e",
    	"sym-mnx-s": "f63f",
    	"sym-mnx": "f640",
    	"sym-moac-s": "f641",
    	"sym-moac": "f642",
    	"sym-mob-s": "f643",
    	"sym-mob": "f644",
    	"sym-mobi-s": "f645",
    	"sym-mobi": "f646",
    	"sym-moc-s": "f647",
    	"sym-moc": "f648",
    	"sym-mod-s": "f649",
    	"sym-mod": "f64a",
    	"sym-mona-s": "f64b",
    	"sym-mona": "f64c",
    	"sym-moon-s": "f64d",
    	"sym-moon": "f64e",
    	"sym-morph-s": "f64f",
    	"sym-morph": "f650",
    	"sym-movr-s": "f651",
    	"sym-movr": "f652",
    	"sym-mpl-s": "f653",
    	"sym-mpl": "f654",
    	"sym-mrk-s": "f655",
    	"sym-mrk": "f656",
    	"sym-msol-s": "f657",
    	"sym-msol": "f658",
    	"sym-msp-s": "f659",
    	"sym-msp": "f65a",
    	"sym-mta-s": "f65b",
    	"sym-mta": "f65c",
    	"sym-mtc-s": "f65d",
    	"sym-mtc": "f65e",
    	"sym-mth-s": "f65f",
    	"sym-mth": "f660",
    	"sym-mtl-s": "f661",
    	"sym-mtl": "f662",
    	"sym-mtn-s": "f663",
    	"sym-mtn": "f664",
    	"sym-mtx-s": "f665",
    	"sym-mtx": "f666",
    	"sym-mue-s": "f667",
    	"sym-mue": "f668",
    	"sym-multi-s": "f669",
    	"sym-multi": "f66a",
    	"sym-mv-s": "f66b",
    	"sym-mv": "f66c",
    	"sym-mx-s": "f66d",
    	"sym-mx": "f66e",
    	"sym-mxc-s": "f66f",
    	"sym-mxc": "f670",
    	"sym-mxm-s": "f671",
    	"sym-mxm": "f672",
    	"sym-mxn-s": "f673",
    	"sym-mxn": "f674",
    	"sym-myr-s": "f675",
    	"sym-myr": "f676",
    	"sym-n9l-s": "f677",
    	"sym-n9l": "f678",
    	"sym-nanj-s": "f679",
    	"sym-nanj": "f67a",
    	"sym-nano-s": "f67b",
    	"sym-nano": "f67c",
    	"sym-nas-s": "f67d",
    	"sym-nas": "f67e",
    	"sym-naut-s": "f67f",
    	"sym-naut": "f680",
    	"sym-nav-s": "f681",
    	"sym-nav": "f682",
    	"sym-ncash-s": "f683",
    	"sym-ncash": "f684",
    	"sym-nct-s": "f685",
    	"sym-nct": "f686",
    	"sym-near-s": "f687",
    	"sym-near": "f688",
    	"sym-nebl-s": "f689",
    	"sym-nebl": "f68a",
    	"sym-nec-s": "f68b",
    	"sym-nec": "f68c",
    	"sym-neo-s": "f68d",
    	"sym-neo": "f68e",
    	"sym-neos-s": "f68f",
    	"sym-neos": "f690",
    	"sym-nest-s": "f691",
    	"sym-nest": "f692",
    	"sym-neu-s": "f693",
    	"sym-neu": "f694",
    	"sym-new-s": "f695",
    	"sym-new": "f696",
    	"sym-nexo-s": "f697",
    	"sym-nexo": "f698",
    	"sym-nft-s": "f699",
    	"sym-nft": "f69a",
    	"sym-ng-s": "f69b",
    	"sym-ng": "f69c",
    	"sym-ngc-s": "f69d",
    	"sym-ngc": "f69e",
    	"sym-ngn-s": "f69f",
    	"sym-ngn": "f6a0",
    	"sym-nim-s": "f6a1",
    	"sym-nim": "f6a2",
    	"sym-niy-s": "f6a3",
    	"sym-niy": "f6a4",
    	"sym-nkd-s": "f6a5",
    	"sym-nkd": "f6a6",
    	"sym-nkn-s": "f6a7",
    	"sym-nkn": "f6a8",
    	"sym-nlc2-s": "f6a9",
    	"sym-nlc2": "f6aa",
    	"sym-nlg-s": "f6ab",
    	"sym-nlg": "f6ac",
    	"sym-nmc-s": "f6ad",
    	"sym-nmc": "f6ae",
    	"sym-nmr-s": "f6af",
    	"sym-nmr": "f6b0",
    	"sym-nn-s": "f6b1",
    	"sym-nn": "f6b2",
    	"sym-noah-s": "f6b3",
    	"sym-noah": "f6b4",
    	"sym-nodl-s": "f6b5",
    	"sym-nodl": "f6b6",
    	"sym-note-s": "f6b7",
    	"sym-note": "f6b8",
    	"sym-npg-s": "f6b9",
    	"sym-npg": "f6ba",
    	"sym-nplc-s": "f6bb",
    	"sym-nplc": "f6bc",
    	"sym-npxs-s": "f6bd",
    	"sym-npxs": "f6be",
    	"sym-nq-s": "f6bf",
    	"sym-nq": "f6c0",
    	"sym-nrg-s": "f6c1",
    	"sym-nrg": "f6c2",
    	"sym-ntk-s": "f6c3",
    	"sym-ntk": "f6c4",
    	"sym-nu-s": "f6c5",
    	"sym-nu": "f6c6",
    	"sym-nuls-s": "f6c7",
    	"sym-nuls": "f6c8",
    	"sym-nvc-s": "f6c9",
    	"sym-nvc": "f6ca",
    	"sym-nxc-s": "f6cb",
    	"sym-nxc": "f6cc",
    	"sym-nxs-s": "f6cd",
    	"sym-nxs": "f6ce",
    	"sym-nxt-s": "f6cf",
    	"sym-nxt": "f6d0",
    	"sym-nym-s": "f6d1",
    	"sym-nym": "f6d2",
    	"sym-o-s": "f6d3",
    	"sym-o": "f6d4",
    	"sym-oax-s": "f6d5",
    	"sym-oax": "f6d6",
    	"sym-ocean-s": "f6d7",
    	"sym-ocean": "f6d8",
    	"sym-ocn-s": "f6d9",
    	"sym-ocn": "f6da",
    	"sym-ode-s": "f6db",
    	"sym-ode": "f6dc",
    	"sym-ogn-s": "f6dd",
    	"sym-ogn": "f6de",
    	"sym-ogo-s": "f6df",
    	"sym-ogo": "f6e0",
    	"sym-ok-s": "f6e1",
    	"sym-ok": "f6e2",
    	"sym-okb-s": "f6e3",
    	"sym-okb": "f6e4",
    	"sym-om-s": "f6e5",
    	"sym-om": "f6e6",
    	"sym-omg-s": "f6e7",
    	"sym-omg": "f6e8",
    	"sym-omni-s": "f6e9",
    	"sym-omni": "f6ea",
    	"sym-one-s": "f6eb",
    	"sym-one": "f6ec",
    	"sym-ong-s": "f6ed",
    	"sym-ong": "f6ee",
    	"sym-onot-s": "f6ef",
    	"sym-onot": "f6f0",
    	"sym-ont-s": "f6f1",
    	"sym-ont": "f6f2",
    	"sym-ooki-s": "f6f3",
    	"sym-ooki": "f6f4",
    	"sym-orbs-s": "f6f5",
    	"sym-orbs": "f6f6",
    	"sym-orca-s": "f6f7",
    	"sym-orca": "f6f8",
    	"sym-orme-s": "f6f9",
    	"sym-orme": "f6fa",
    	"sym-orn-s": "f6fb",
    	"sym-orn": "f6fc",
    	"sym-ors-s": "f6fd",
    	"sym-ors": "f6fe",
    	"sym-osmo-s": "f6ff",
    	"sym-osmo": "f700",
    	"sym-ost-s": "f701",
    	"sym-ost": "f702",
    	"sym-otn-s": "f703",
    	"sym-otn": "f704",
    	"sym-oxt-s": "f705",
    	"sym-oxt": "f706",
    	"sym-oxy-s": "f707",
    	"sym-oxy": "f708",
    	"sym-pai-s": "f709",
    	"sym-pai": "f70a",
    	"sym-pal-s": "f70b",
    	"sym-pal": "f70c",
    	"sym-paper-s": "f70d",
    	"sym-paper": "f70e",
    	"sym-para-s": "f70f",
    	"sym-para": "f710",
    	"sym-part-s": "f711",
    	"sym-part": "f712",
    	"sym-pasc-s": "f713",
    	"sym-pasc": "f714",
    	"sym-pat-s": "f715",
    	"sym-pat": "f716",
    	"sym-pax-s": "f717",
    	"sym-pax": "f718",
    	"sym-paxg-s": "f719",
    	"sym-paxg": "f71a",
    	"sym-pay-s": "f71b",
    	"sym-pay": "f71c",
    	"sym-pbt-s": "f71d",
    	"sym-pbt": "f71e",
    	"sym-pcl-s": "f71f",
    	"sym-pcl": "f720",
    	"sym-pcx-s": "f721",
    	"sym-pcx": "f722",
    	"sym-pdex-s": "f723",
    	"sym-pdex": "f724",
    	"sym-people-s": "f725",
    	"sym-people": "f726",
    	"sym-perl-s": "f727",
    	"sym-perl": "f728",
    	"sym-perp-s": "f729",
    	"sym-perp": "f72a",
    	"sym-pha-s": "f72b",
    	"sym-pha": "f72c",
    	"sym-phb-s": "f72d",
    	"sym-phb": "f72e",
    	"sym-php-s": "f72f",
    	"sym-php": "f730",
    	"sym-phx-s": "f731",
    	"sym-phx": "f732",
    	"sym-pi-s": "f733",
    	"sym-pi": "f734",
    	"sym-pica-s": "f735",
    	"sym-pica": "f736",
    	"sym-pink-s": "f737",
    	"sym-pink": "f738",
    	"sym-pivx-s": "f739",
    	"sym-pivx": "f73a",
    	"sym-pkt-s": "f73b",
    	"sym-pkt": "f73c",
    	"sym-pl-s": "f73d",
    	"sym-pl": "f73e",
    	"sym-pla-s": "f73f",
    	"sym-pla": "f740",
    	"sym-plbt-s": "f741",
    	"sym-plbt": "f742",
    	"sym-plm-s": "f743",
    	"sym-plm": "f744",
    	"sym-pln-s": "f745",
    	"sym-pln": "f746",
    	"sym-plr-s": "f747",
    	"sym-plr": "f748",
    	"sym-ply-s": "f749",
    	"sym-ply": "f74a",
    	"sym-pma-s": "f74b",
    	"sym-pma": "f74c",
    	"sym-png-s": "f74d",
    	"sym-png": "f74e",
    	"sym-pnt-s": "f74f",
    	"sym-pnt": "f750",
    	"sym-poa-s": "f751",
    	"sym-poa": "f752",
    	"sym-poe-s": "f753",
    	"sym-poe": "f754",
    	"sym-polis-s": "f755",
    	"sym-polis": "f756",
    	"sym-pols-s": "f757",
    	"sym-pols": "f758",
    	"sym-poly-s": "f759",
    	"sym-poly": "f75a",
    	"sym-pond-s": "f75b",
    	"sym-pond": "f75c",
    	"sym-pot-s": "f75d",
    	"sym-pot": "f75e",
    	"sym-powr-s": "f75f",
    	"sym-powr": "f760",
    	"sym-ppc-s": "f761",
    	"sym-ppc": "f762",
    	"sym-ppt-s": "f763",
    	"sym-ppt": "f764",
    	"sym-pra-s": "f765",
    	"sym-pra": "f766",
    	"sym-pre-s": "f767",
    	"sym-pre": "f768",
    	"sym-prg-s": "f769",
    	"sym-prg": "f76a",
    	"sym-pro-s": "f76b",
    	"sym-pro": "f76c",
    	"sym-prq-s": "f76d",
    	"sym-prq": "f76e",
    	"sym-pst-s": "f76f",
    	"sym-pst": "f770",
    	"sym-pstake-s": "f771",
    	"sym-pstake": "f772",
    	"sym-pton-s": "f773",
    	"sym-pton": "f774",
    	"sym-pundix-s": "f775",
    	"sym-pundix": "f776",
    	"sym-pvt-s": "f777",
    	"sym-pvt": "f778",
    	"sym-pxg-s": "f779",
    	"sym-pxg": "f77a",
    	"sym-pyr-s": "f77b",
    	"sym-pyr": "f77c",
    	"sym-qash-s": "f77d",
    	"sym-qash": "f77e",
    	"sym-qau-s": "f77f",
    	"sym-qau": "f780",
    	"sym-qc-s": "f781",
    	"sym-qc": "f782",
    	"sym-qi-s": "f783",
    	"sym-qi": "f784",
    	"sym-qi2-s": "f785",
    	"sym-qi2": "f786",
    	"sym-qkc-s": "f787",
    	"sym-qkc": "f788",
    	"sym-qlc-s": "f789",
    	"sym-qlc": "f78a",
    	"sym-qnt-s": "f78b",
    	"sym-qnt": "f78c",
    	"sym-qntu-s": "f78d",
    	"sym-qntu": "f78e",
    	"sym-qo-s": "f78f",
    	"sym-qo": "f790",
    	"sym-qrdo-s": "f791",
    	"sym-qrdo": "f792",
    	"sym-qrl-s": "f793",
    	"sym-qrl": "f794",
    	"sym-qsp-s": "f795",
    	"sym-qsp": "f796",
    	"sym-qtum-s": "f797",
    	"sym-qtum": "f798",
    	"sym-quick-s": "f799",
    	"sym-quick": "f79a",
    	"sym-qun-s": "f79b",
    	"sym-qun": "f79c",
    	"sym-r-s": "f79d",
    	"sym-r": "f79e",
    	"sym-rad-s": "f79f",
    	"sym-rad": "f7a0",
    	"sym-radar-s": "f7a1",
    	"sym-radar": "f7a2",
    	"sym-rads-s": "f7a3",
    	"sym-rads": "f7a4",
    	"sym-ramp-s": "f7a5",
    	"sym-ramp": "f7a6",
    	"sym-rare-s": "f7a7",
    	"sym-rare": "f7a8",
    	"sym-rari-s": "f7a9",
    	"sym-rari": "f7aa",
    	"sym-rating-s": "f7ab",
    	"sym-rating": "f7ac",
    	"sym-ray-s": "f7ad",
    	"sym-ray": "f7ae",
    	"sym-rb-s": "f7af",
    	"sym-rb": "f7b0",
    	"sym-rbc-s": "f7b1",
    	"sym-rbc": "f7b2",
    	"sym-rblx-s": "f7b3",
    	"sym-rblx": "f7b4",
    	"sym-rbn-s": "f7b5",
    	"sym-rbn": "f7b6",
    	"sym-rbtc-s": "f7b7",
    	"sym-rbtc": "f7b8",
    	"sym-rby-s": "f7b9",
    	"sym-rby": "f7ba",
    	"sym-rcn-s": "f7bb",
    	"sym-rcn": "f7bc",
    	"sym-rdd-s": "f7bd",
    	"sym-rdd": "f7be",
    	"sym-rdn-s": "f7bf",
    	"sym-rdn": "f7c0",
    	"sym-real-s": "f7c1",
    	"sym-real": "f7c2",
    	"sym-reef-s": "f7c3",
    	"sym-reef": "f7c4",
    	"sym-rem-s": "f7c5",
    	"sym-rem": "f7c6",
    	"sym-ren-s": "f7c7",
    	"sym-ren": "f7c8",
    	"sym-rep-s": "f7c9",
    	"sym-rep": "f7ca",
    	"sym-repv2-s": "f7cb",
    	"sym-repv2": "f7cc",
    	"sym-req-s": "f7cd",
    	"sym-req": "f7ce",
    	"sym-rev-s": "f7cf",
    	"sym-rev": "f7d0",
    	"sym-revv-s": "f7d1",
    	"sym-revv": "f7d2",
    	"sym-rfox-s": "f7d3",
    	"sym-rfox": "f7d4",
    	"sym-rfr-s": "f7d5",
    	"sym-rfr": "f7d6",
    	"sym-ric-s": "f7d7",
    	"sym-ric": "f7d8",
    	"sym-rif-s": "f7d9",
    	"sym-rif": "f7da",
    	"sym-ring-s": "f7db",
    	"sym-ring": "f7dc",
    	"sym-rlc-s": "f7dd",
    	"sym-rlc": "f7de",
    	"sym-rly-s": "f7df",
    	"sym-rly": "f7e0",
    	"sym-rmrk-s": "f7e1",
    	"sym-rmrk": "f7e2",
    	"sym-rndr-s": "f7e3",
    	"sym-rndr": "f7e4",
    	"sym-rntb-s": "f7e5",
    	"sym-rntb": "f7e6",
    	"sym-ron-s": "f7e7",
    	"sym-ron": "f7e8",
    	"sym-rook-s": "f7e9",
    	"sym-rook": "f7ea",
    	"sym-rose-s": "f7eb",
    	"sym-rose": "f7ec",
    	"sym-rox-s": "f7ed",
    	"sym-rox": "f7ee",
    	"sym-rp-s": "f7ef",
    	"sym-rp": "f7f0",
    	"sym-rpl-s": "f7f1",
    	"sym-rpl": "f7f2",
    	"sym-rpx-s": "f7f3",
    	"sym-rpx": "f7f4",
    	"sym-rsr-s": "f7f5",
    	"sym-rsr": "f7f6",
    	"sym-rsv-s": "f7f7",
    	"sym-rsv": "f7f8",
    	"sym-rty-s": "f7f9",
    	"sym-rty": "f7fa",
    	"sym-rub-s": "f7fb",
    	"sym-rub": "f7fc",
    	"sym-ruff-s": "f7fd",
    	"sym-ruff": "f7fe",
    	"sym-rune-s": "f7ff",
    	"sym-rune": "f800",
    	"sym-rvn-s": "f801",
    	"sym-rvn": "f802",
    	"sym-rvr-s": "f803",
    	"sym-rvr": "f804",
    	"sym-rvt-s": "f805",
    	"sym-rvt": "f806",
    	"sym-sai-s": "f807",
    	"sym-sai": "f808",
    	"sym-salt-s": "f809",
    	"sym-salt": "f80a",
    	"sym-samo-s": "f80b",
    	"sym-samo": "f80c",
    	"sym-san-s": "f80d",
    	"sym-san": "f80e",
    	"sym-sand-s": "f80f",
    	"sym-sand": "f810",
    	"sym-sats-s": "f811",
    	"sym-sats": "f812",
    	"sym-sbd-s": "f813",
    	"sym-sbd": "f814",
    	"sym-sbr-s": "f815",
    	"sym-sbr": "f816",
    	"sym-sc-s": "f817",
    	"sym-sc": "f818",
    	"sym-scc-s": "f819",
    	"sym-scc": "f81a",
    	"sym-scrt-s": "f81b",
    	"sym-scrt": "f81c",
    	"sym-sdc-s": "f81d",
    	"sym-sdc": "f81e",
    	"sym-sdn-s": "f81f",
    	"sym-sdn": "f820",
    	"sym-seele-s": "f821",
    	"sym-seele": "f822",
    	"sym-sek-s": "f823",
    	"sym-sek": "f824",
    	"sym-sen-s": "f825",
    	"sym-sen": "f826",
    	"sym-sent-s": "f827",
    	"sym-sent": "f828",
    	"sym-sero-s": "f829",
    	"sym-sero": "f82a",
    	"sym-sexc-s": "f82b",
    	"sym-sexc": "f82c",
    	"sym-sfp-s": "f82d",
    	"sym-sfp": "f82e",
    	"sym-sgb-s": "f82f",
    	"sym-sgb": "f830",
    	"sym-sgc-s": "f831",
    	"sym-sgc": "f832",
    	"sym-sgd-s": "f833",
    	"sym-sgd": "f834",
    	"sym-sgn-s": "f835",
    	"sym-sgn": "f836",
    	"sym-sgu-s": "f837",
    	"sym-sgu": "f838",
    	"sym-shib-s": "f839",
    	"sym-shib": "f83a",
    	"sym-shift-s": "f83b",
    	"sym-shift": "f83c",
    	"sym-ship-s": "f83d",
    	"sym-ship": "f83e",
    	"sym-shping-s": "f83f",
    	"sym-shping": "f840",
    	"sym-si-s": "f841",
    	"sym-si": "f842",
    	"sym-sib-s": "f843",
    	"sym-sib": "f844",
    	"sym-sil-s": "f845",
    	"sym-sil": "f846",
    	"sym-six-s": "f847",
    	"sym-six": "f848",
    	"sym-sjcx-s": "f849",
    	"sym-sjcx": "f84a",
    	"sym-skl-s": "f84b",
    	"sym-skl": "f84c",
    	"sym-skm-s": "f84d",
    	"sym-skm": "f84e",
    	"sym-sku-s": "f84f",
    	"sym-sku": "f850",
    	"sym-sky-s": "f851",
    	"sym-sky": "f852",
    	"sym-slp-s": "f853",
    	"sym-slp": "f854",
    	"sym-slr-s": "f855",
    	"sym-slr": "f856",
    	"sym-sls-s": "f857",
    	"sym-sls": "f858",
    	"sym-slt-s": "f859",
    	"sym-slt": "f85a",
    	"sym-slv-s": "f85b",
    	"sym-slv": "f85c",
    	"sym-smart-s": "f85d",
    	"sym-smart": "f85e",
    	"sym-smn-s": "f85f",
    	"sym-smn": "f860",
    	"sym-smt-s": "f861",
    	"sym-smt": "f862",
    	"sym-snc-s": "f863",
    	"sym-snc": "f864",
    	"sym-snet-s": "f865",
    	"sym-snet": "f866",
    	"sym-sngls-s": "f867",
    	"sym-sngls": "f868",
    	"sym-snm-s": "f869",
    	"sym-snm": "f86a",
    	"sym-snt-s": "f86b",
    	"sym-snt": "f86c",
    	"sym-snx-s": "f86d",
    	"sym-snx": "f86e",
    	"sym-soc-s": "f86f",
    	"sym-soc": "f870",
    	"sym-socks-s": "f871",
    	"sym-socks": "f872",
    	"sym-sol-s": "f873",
    	"sym-sol": "f874",
    	"sym-solid-s": "f875",
    	"sym-solid": "f876",
    	"sym-solo-s": "f877",
    	"sym-solo": "f878",
    	"sym-solve-s": "f879",
    	"sym-solve": "f87a",
    	"sym-sos-s": "f87b",
    	"sym-sos": "f87c",
    	"sym-soul-s": "f87d",
    	"sym-soul": "f87e",
    	"sym-sp-s": "f87f",
    	"sym-sp": "f880",
    	"sym-sparta-s": "f881",
    	"sym-sparta": "f882",
    	"sym-spc-s": "f883",
    	"sym-spc": "f884",
    	"sym-spd-s": "f885",
    	"sym-spd": "f886",
    	"sym-spell-s": "f887",
    	"sym-spell": "f888",
    	"sym-sphr-s": "f889",
    	"sym-sphr": "f88a",
    	"sym-sphtx-s": "f88b",
    	"sym-sphtx": "f88c",
    	"sym-spnd-s": "f88d",
    	"sym-spnd": "f88e",
    	"sym-spnk-s": "f88f",
    	"sym-spnk": "f890",
    	"sym-srm-s": "f891",
    	"sym-srm": "f892",
    	"sym-srn-s": "f893",
    	"sym-srn": "f894",
    	"sym-ssp-s": "f895",
    	"sym-ssp": "f896",
    	"sym-stacs-s": "f897",
    	"sym-stacs": "f898",
    	"sym-step-s": "f899",
    	"sym-step": "f89a",
    	"sym-stg-s": "f89b",
    	"sym-stg": "f89c",
    	"sym-stmx-s": "f89d",
    	"sym-stmx": "f89e",
    	"sym-storm-s": "f89f",
    	"sym-storm": "f8a0",
    	"sym-stpt-s": "f8a1",
    	"sym-stpt": "f8a2",
    	"sym-stq-s": "f8a3",
    	"sym-stq": "f8a4",
    	"sym-str-s": "f8a5",
    	"sym-str": "f8a6",
    	"sym-strat-s": "f8a7",
    	"sym-strat": "f8a8",
    	"sym-strax-s": "f8a9",
    	"sym-strax": "f8aa",
    	"sym-strk-s": "f8ab",
    	"sym-strk": "f8ac",
    	"sym-strong-s": "f8ad",
    	"sym-strong": "f8ae",
    	"sym-stx-s": "f8af",
    	"sym-stx": "f8b0",
    	"sym-sub-s": "f8b1",
    	"sym-sub": "f8b2",
    	"sym-sun-s": "f8b3",
    	"sym-sun": "f8b4",
    	"sym-super-s": "f8b5",
    	"sym-super": "f8b6",
    	"sym-susd-s": "f8b7",
    	"sym-susd": "f8b8",
    	"sym-sushi-s": "f8b9",
    	"sym-sushi": "f8ba",
    	"sym-swftc-s": "f8bb",
    	"sym-swftc": "f8bc",
    	"sym-swm-s": "f8bd",
    	"sym-swm": "f8be",
    	"sym-swrv-s": "f8bf",
    	"sym-swrv": "f8c0",
    	"sym-swt-s": "f8c1",
    	"sym-swt": "f8c2",
    	"sym-swth-s": "f8c3",
    	"sym-swth": "f8c4",
    	"sym-sxp-s": "f8c5",
    	"sym-sxp": "f8c6",
    	"sym-syn-s": "f8c7",
    	"sym-syn": "f8c8",
    	"sym-sys-s": "f8c9",
    	"sym-sys": "f8ca",
    	"sym-t-s": "f8cb",
    	"sym-t": "f8cc",
    	"sym-taas-s": "f8cd",
    	"sym-taas": "f8ce",
    	"sym-tau-s": "f8cf",
    	"sym-tau": "f8d0",
    	"sym-tbtc-s": "f8d1",
    	"sym-tbtc": "f8d2",
    	"sym-tct-s": "f8d3",
    	"sym-tct": "f8d4",
    	"sym-teer-s": "f8d5",
    	"sym-teer": "f8d6",
    	"sym-tel-s": "f8d7",
    	"sym-temco-s": "f8d8",
    	"sym-temco": "f8d9",
    	"sym-tfuel-s": "f8da",
    	"sym-tfuel": "f8db",
    	"sym-thb-s": "f8dc",
    	"sym-thb": "f8dd",
    	"sym-thc-s": "f8de",
    	"sym-thc": "f8df",
    	"sym-theta-s": "f8e0",
    	"sym-theta": "f8e1",
    	"sym-thx-s": "f8e2",
    	"sym-thx": "f8e3",
    	"sym-time-s": "f8e4",
    	"sym-time": "f8e5",
    	"sym-tio-s": "f8e6",
    	"sym-tio": "f8e7",
    	"sym-tix-s": "f8e8",
    	"sym-tix": "f8e9",
    	"sym-tkn-s": "f8ea",
    	"sym-tkn": "f8eb",
    	"sym-tky-s": "f8ec",
    	"sym-tky": "f8ed",
    	"sym-tlm-s": "f8ee",
    	"sym-tlm": "f8ef",
    	"sym-tnb-s": "f8f0",
    	"sym-tnb": "f8f1",
    	"sym-tnc-s": "f8f2",
    	"sym-tnc": "f8f3",
    	"sym-tnt-s": "f8f4",
    	"sym-tnt": "f8f5",
    	"sym-toke-s": "f8f6",
    	"sym-toke": "f8f7",
    	"sym-tomb-s": "f8f8",
    	"sym-tomb": "f8f9",
    	"sym-tomo-s": "f8fa",
    	"sym-tomo": "f8fb",
    	"sym-top-s": "f8fc",
    	"sym-top": "f8fd",
    	"sym-torn-s": "f8fe",
    	"sym-torn": "f8ff",
    	"sym-tower-s": "f900",
    	"sym-tower": "f901",
    	"sym-tpay-s": "f902",
    	"sym-tpay": "f903",
    	"sym-trac-s": "f904",
    	"sym-trac": "f905",
    	"sym-trb-s": "f906",
    	"sym-trb": "f907",
    	"sym-tribe-s": "f908",
    	"sym-tribe": "f909",
    	"sym-trig-s": "f90a",
    	"sym-trig": "f90b",
    	"sym-trio-s": "f90c",
    	"sym-trio": "f90d",
    	"sym-troy-s": "f90e",
    	"sym-troy": "f90f",
    	"sym-trst-s": "f910",
    	"sym-trst": "f911",
    	"sym-tru-s": "f912",
    	"sym-tru": "f913",
    	"sym-true-s": "f914",
    	"sym-true": "f915",
    	"sym-trx-s": "f916",
    	"sym-trx": "f917",
    	"sym-try-s": "f918",
    	"sym-try": "f919",
    	"sym-tryb-s": "f91a",
    	"sym-tryb": "f91b",
    	"sym-tt-s": "f91c",
    	"sym-tt": "f91d",
    	"sym-ttc-s": "f91e",
    	"sym-ttc": "f91f",
    	"sym-ttt-s": "f920",
    	"sym-ttt": "f921",
    	"sym-ttu-s": "f922",
    	"sym-ttu": "f923",
    	"sym-tube-s": "f924",
    	"sym-tube": "f925",
    	"sym-tusd-s": "f926",
    	"sym-tusd": "f927",
    	"sym-tvk-s": "f928",
    	"sym-tvk": "f929",
    	"sym-twt-s": "f92a",
    	"sym-twt": "f92b",
    	"sym-uah-s": "f92c",
    	"sym-uah": "f92d",
    	"sym-ubq-s": "f92e",
    	"sym-ubq": "f92f",
    	"sym-ubt-s": "f930",
    	"sym-ubt": "f931",
    	"sym-uft-s": "f932",
    	"sym-uft": "f933",
    	"sym-ugas-s": "f934",
    	"sym-ugas": "f935",
    	"sym-uip-s": "f936",
    	"sym-uip": "f937",
    	"sym-ukg-s": "f938",
    	"sym-ukg": "f939",
    	"sym-uma-s": "f93a",
    	"sym-uma": "f93b",
    	"sym-unfi-s": "f93c",
    	"sym-unfi": "f93d",
    	"sym-uni-s": "f93e",
    	"sym-uni": "f93f",
    	"sym-unq-s": "f940",
    	"sym-unq": "f941",
    	"sym-up-s": "f942",
    	"sym-up": "f943",
    	"sym-upp-s": "f944",
    	"sym-upp": "f945",
    	"sym-usd-s": "f946",
    	"sym-usd": "f947",
    	"sym-usdc-s": "f948",
    	"sym-usdc": "f949",
    	"sym-usds-s": "f94a",
    	"sym-usds": "f94b",
    	"sym-usk-s": "f94c",
    	"sym-usk": "f94d",
    	"sym-ust-s": "f94e",
    	"sym-ust": "f94f",
    	"sym-utk-s": "f950",
    	"sym-utk": "f951",
    	"sym-utnp-s": "f952",
    	"sym-utnp": "f953",
    	"sym-utt-s": "f954",
    	"sym-utt": "f955",
    	"sym-uuu-s": "f956",
    	"sym-uuu": "f957",
    	"sym-ux-s": "f958",
    	"sym-ux": "f959",
    	"sym-vader-s": "f95a",
    	"sym-vader": "f95b",
    	"sym-vai-s": "f95c",
    	"sym-vai": "f95d",
    	"sym-vbk-s": "f95e",
    	"sym-vbk": "f95f",
    	"sym-vdx-s": "f960",
    	"sym-vdx": "f961",
    	"sym-vee-s": "f962",
    	"sym-vee": "f963",
    	"sym-vemp-s": "f964",
    	"sym-vemp": "f965",
    	"sym-ven-s": "f966",
    	"sym-ven": "f967",
    	"sym-veo-s": "f968",
    	"sym-veo": "f969",
    	"sym-veri-s": "f96a",
    	"sym-veri": "f96b",
    	"sym-vex-s": "f96c",
    	"sym-vex": "f96d",
    	"sym-vgx-s": "f96e",
    	"sym-vgx": "f96f",
    	"sym-via-s": "f970",
    	"sym-via": "f971",
    	"sym-vib-s": "f972",
    	"sym-vib": "f973",
    	"sym-vibe-s": "f974",
    	"sym-vibe": "f975",
    	"sym-vid-s": "f976",
    	"sym-vid": "f977",
    	"sym-vidt-s": "f978",
    	"sym-vidt": "f979",
    	"sym-vidy-s": "f97a",
    	"sym-vidy": "f97b",
    	"sym-vitae-s": "f97c",
    	"sym-vitae": "f97d",
    	"sym-vite-s": "f97e",
    	"sym-vite": "f97f",
    	"sym-vlx-s": "f980",
    	"sym-vlx": "f981",
    	"sym-vox-s": "f982",
    	"sym-vox": "f983",
    	"sym-voxel-s": "f984",
    	"sym-voxel": "f985",
    	"sym-vra-s": "f986",
    	"sym-vra": "f987",
    	"sym-vrc-s": "f988",
    	"sym-vrc": "f989",
    	"sym-vrm-s": "f98a",
    	"sym-vrm": "f98b",
    	"sym-vsys-s": "f98c",
    	"sym-vsys": "f98d",
    	"sym-vtc-s": "f98e",
    	"sym-vtc": "f98f",
    	"sym-vtho-s": "f990",
    	"sym-vtho": "f991",
    	"sym-wabi-s": "f992",
    	"sym-wabi": "f993",
    	"sym-wan-s": "f994",
    	"sym-wan": "f995",
    	"sym-waves-s": "f996",
    	"sym-waves": "f997",
    	"sym-wax-s": "f998",
    	"sym-wax": "f999",
    	"sym-wbtc-s": "f99a",
    	"sym-wbtc": "f99b",
    	"sym-wet-s": "f99c",
    	"sym-wet": "f99d",
    	"sym-weth-s": "f99e",
    	"sym-weth": "f99f",
    	"sym-wib-s": "f9a0",
    	"sym-wib": "f9a1",
    	"sym-wicc-s": "f9a2",
    	"sym-wicc": "f9a3",
    	"sym-win-s": "f9a4",
    	"sym-win": "f9a5",
    	"sym-wing-s": "f9a6",
    	"sym-wing": "f9a7",
    	"sym-wings-s": "f9a8",
    	"sym-wings": "f9a9",
    	"sym-wnxm-s": "f9aa",
    	"sym-wnxm": "f9ab",
    	"sym-woo-s": "f9ac",
    	"sym-woo": "f9ad",
    	"sym-wpr-s": "f9ae",
    	"sym-wpr": "f9af",
    	"sym-wrx-s": "f9b0",
    	"sym-wrx": "f9b1",
    	"sym-wtc-s": "f9b2",
    	"sym-wtc": "f9b3",
    	"sym-wtt-s": "f9b4",
    	"sym-wtt": "f9b5",
    	"sym-wwb-s": "f9b6",
    	"sym-wwb": "f9b7",
    	"sym-wxt-s": "f9b8",
    	"sym-wxt": "f9b9",
    	"sym-xas-s": "f9ba",
    	"sym-xas": "f9bb",
    	"sym-xaur-s": "f9bc",
    	"sym-xaur": "f9bd",
    	"sym-xaut-s": "f9be",
    	"sym-xaut": "f9bf",
    	"sym-xava-s": "f9c0",
    	"sym-xava": "f9c1",
    	"sym-xbc-s": "f9c2",
    	"sym-xbc": "f9c3",
    	"sym-xcn-s": "f9c4",
    	"sym-xcn": "f9c5",
    	"sym-xcon-s": "f9c6",
    	"sym-xcon": "f9c7",
    	"sym-xcp-s": "f9c8",
    	"sym-xcp": "f9c9",
    	"sym-xdefi-s": "f9ca",
    	"sym-xdefi": "f9cb",
    	"sym-xdn-s": "f9cc",
    	"sym-xdn": "f9cd",
    	"sym-xel-s": "f9ce",
    	"sym-xel": "f9cf",
    	"sym-xem-s": "f9d0",
    	"sym-xem": "f9d1",
    	"sym-xes-s": "f9d2",
    	"sym-xes": "f9d3",
    	"sym-xhv-s": "f9d4",
    	"sym-xhv": "f9d5",
    	"sym-xin-s": "f9d6",
    	"sym-xin": "f9d7",
    	"sym-xlm-s": "f9d8",
    	"sym-xlm": "f9d9",
    	"sym-xmc-s": "f9da",
    	"sym-xmc": "f9db",
    	"sym-xmr-s": "f9dc",
    	"sym-xmr": "f9dd",
    	"sym-xmx-s": "f9de",
    	"sym-xmx": "f9df",
    	"sym-xmy-s": "f9e0",
    	"sym-xmy": "f9e1",
    	"sym-xnk-s": "f9e2",
    	"sym-xnk": "f9e3",
    	"sym-xns-s": "f9e4",
    	"sym-xns": "f9e5",
    	"sym-xor-s": "f9e6",
    	"sym-xor": "f9e7",
    	"sym-xos-s": "f9e8",
    	"sym-xos": "f9e9",
    	"sym-xpm-s": "f9ea",
    	"sym-xpm": "f9eb",
    	"sym-xpr-s": "f9ec",
    	"sym-xpr": "f9ed",
    	"sym-xrc-s": "f9ee",
    	"sym-xrc": "f9ef",
    	"sym-xrp-s": "f9f0",
    	"sym-xrp": "f9f1",
    	"sym-xrpx-s": "f9f2",
    	"sym-xrpx": "f9f3",
    	"sym-xrt-s": "f9f4",
    	"sym-xrt": "f9f5",
    	"sym-xst-s": "f9f6",
    	"sym-xst": "f9f7",
    	"sym-xtp-s": "f9f8",
    	"sym-xtp": "f9f9",
    	"sym-xtz-s": "f9fa",
    	"sym-xtz": "f9fb",
    	"sym-xtzdown-s": "f9fc",
    	"sym-xtzdown": "f9fd",
    	"sym-xvc-s": "f9fe",
    	"sym-xvc": "f9ff",
    	"sym-xvg-s": "fa00",
    	"sym-xvg": "fa01",
    	"sym-xvs-s": "fa02",
    	"sym-xvs": "fa03",
    	"sym-xwc-s": "fa04",
    	"sym-xwc": "fa05",
    	"sym-xyo-s": "fa06",
    	"sym-xyo": "fa07",
    	"sym-xzc-s": "fa08",
    	"sym-xzc": "fa09",
    	"sym-yam-s": "fa0a",
    	"sym-yam": "fa0b",
    	"sym-yee-s": "fa0c",
    	"sym-yee": "fa0d",
    	"sym-yeed-s": "fa0e",
    	"sym-yeed": "fa0f",
    	"sym-yfi-s": "fa10",
    	"sym-yfi": "fa11",
    	"sym-yfii-s": "fa12",
    	"sym-yfii": "fa13",
    	"sym-ygg-s": "fa14",
    	"sym-ygg": "fa15",
    	"sym-yoyow-s": "fa16",
    	"sym-yoyow": "fa17",
    	"sym-zar-s": "fa18",
    	"sym-zar": "fa19",
    	"sym-zcl-s": "fa1a",
    	"sym-zcl": "fa1b",
    	"sym-zcn-s": "fa1c",
    	"sym-zcn": "fa1d",
    	"sym-zco-s": "fa1e",
    	"sym-zco": "fa1f",
    	"sym-zec-s": "fa20",
    	"sym-zec": "fa21",
    	"sym-zen-s": "fa22",
    	"sym-zen": "fa23",
    	"sym-zil-s": "fa24",
    	"sym-zil": "fa25",
    	"sym-zks-s": "fa26",
    	"sym-zks": "fa27",
    	"sym-zla-s": "fa28",
    	"sym-zla": "fa29",
    	"sym-zlk": "fa2a",
    	"sym-zondo-s": "fa2b",
    	"sym-zondo": "fa2c",
    	"sym-zpr-s": "fa2d",
    	"sym-zpr": "fa2e",
    	"sym-zpt-s": "fa2f",
    	"sym-zpt": "fa30",
    	"sym-zrc-s": "fa31",
    	"sym-zrc": "fa32",
    	"sym-zrx-s": "fa33",
    	"sym-zrx": "fa34",
    	"sym-zsc-s": "fa35",
    	"sym-zsc": "fa36",
    	"sym-ztg-s": "fa37",
    	"sym-ztg": "fa38",
    	"ustc-s": "fa39",
    	ustc: ustc,
    	"cur-anct": "f1d4",
    	"cur-anct-s": "f1d3",
    	"cur-aud": "f206",
    	"cur-aud-s": "f205",
    	"cur-bnb": "f279",
    	"cur-bnb-s": "f278",
    	"sym-xbt": "f2a3",
    	"cur-btc": "f2a3",
    	"sym-xbt-s": "f2a2",
    	"cur-btc-s": "f2a2",
    	"cur-busd": "f2c3",
    	"cur-busd-s": "f2c2",
    	"exc-bitz": "f2c7",
    	"cur-bz": "f2c7",
    	"exc-bitz-s": "f2c6",
    	"cur-bz-s": "f2c6",
    	"cur-cad": "f2d1",
    	"cur-cad-s": "f2d0",
    	"cur-chf": "f2f1",
    	"cur-chf-s": "f2f0",
    	"cur-cny": "f315",
    	"cur-cny-s": "f314",
    	"sym-cs": "f329",
    	"sym-cs-s": "f328",
    	"sym-crm": "f341",
    	"sym-crm-s": "f340",
    	"cur-dai": "f36f",
    	"cur-dai-s": "f36e",
    	"sym-xdg": "f3ad",
    	"sym-xdg-s": "f3ac",
    	"cur-eos": "f3fa",
    	"cur-eos-s": "f3f9",
    	"sym-eth2": "f40a",
    	"sym-eth2s": "f40a",
    	"sym-eth2.s": "f40a",
    	"cur-eth": "f40a",
    	"sym-eth2-s": "f409",
    	"sym-eth2s-s": "f409",
    	"sym-eth2.s-s": "f409",
    	"cur-eth-s": "f409",
    	"cur-eur": "f414",
    	"cur-eur-s": "f413",
    	"cur-eurs": "f418",
    	"cur-eurs-s": "f417",
    	"sym-usdt": "f41a",
    	"cur-usdt": "f41a",
    	"sym-usdt-s": "f419",
    	"cur-usdt-s": "f419",
    	"exc-kraken": "f432",
    	"exc-kraken-futures": "f432",
    	"exc-kraken-s": "f431",
    	"exc-kraken-futures-s": "f431",
    	"cur-gbp": "f486",
    	"cur-gbp-s": "f485",
    	"exc-gemini": "f4ce",
    	"cur-gusd": "f4ce",
    	"exc-gemini-s": "f4cd",
    	"cur-gusd-s": "f4cd",
    	"cur-hkd": "f4f2",
    	"cur-hkd-s": "f4f1",
    	"sym-husd": "f510",
    	"exc-huobi": "f510",
    	"cur-ht": "f510",
    	"sym-husd-s": "f50f",
    	"exc-huobi-s": "f50f",
    	"cur-ht-s": "f50f",
    	"cur-idr": "f530",
    	"cur-idr-s": "f52f",
    	"sym-iota": "f558",
    	"sym-iota-s": "f557",
    	"cur-inr": "f54a",
    	"cur-inr-s": "f549",
    	"cur-jpy": "f56e",
    	"cur-jpy-s": "f56d",
    	"cur-krw": "f5a0",
    	"cur-krw-s": "f59f",
    	"sym-medx": "f61c",
    	"sym-medx-s": "f61b",
    	"cur-mxn": "f674",
    	"cur-mxn-s": "f673",
    	"cur-myr": "f676",
    	"cur-myr-s": "f675",
    	"cur-ngn": "f6a0",
    	"cur-ngn-s": "f69f",
    	"cur-pax": "f718",
    	"cur-pax-s": "f717",
    	"cur-php": "f730",
    	"cur-php-s": "f72f",
    	"cur-pln": "f746",
    	"cur-pln-s": "f745",
    	"cur-qash": "f77e",
    	"cur-qash-s": "f77d",
    	"cur-rub": "f7fc",
    	"cur-rur": "f7fc",
    	"cur-rub-s": "f7fb",
    	"cur-rur-s": "f7fb",
    	"sym-steem": "f814",
    	"sym-steem-s": "f813",
    	"sym-xsc": "f818",
    	"sym-xsc-s": "f817",
    	"cur-sgd": "f834",
    	"cur-sgd-s": "f833",
    	"sym-storj": "f84a",
    	"sym-storj-s": "f849",
    	"sym-tel": "f8ce",
    	"cur-trx": "f917",
    	"cur-trx-s": "f916",
    	"cur-tusd": "f927",
    	"cur-tusd-s": "f926",
    	"cur-usd": "f947",
    	"cur-usd-s": "f946",
    	"cur-usdc": "f949",
    	"cur-usdc-s": "f948",
    	"sym-vet": "f967",
    	"sym-vet-s": "f966",
    	"sym-waxp": "f999",
    	"sym-waxp-s": "f998",
    	"cur-xlm": "f9d9",
    	"cur-xlm-s": "f9d8",
    	"cur-xmr": "f9dd",
    	"cur-xmr-s": "f9dc",
    	"cur-xrp": "f9f1",
    	"cur-xrp-s": "f9f0",
    	"cur-zar": "fa19",
    	"cur-zar-s": "fa18",
    	"exc-binance-us": "f108",
    	"exc-binance-us-s": "f107",
    	"exc-mexbt": "f11e",
    	"exc-mexbt-s": "f11d",
    	"exc-coinbase-pro": "f12c",
    	"exc-gdax": "f12c",
    	"exc-coinbase-pro-s": "f12b",
    	"exc-gdax-s": "f12b",
    	"exc-quadriga": "f156",
    	"exc-quadriga-s": "f155",
    	"cur-crc": "f335",
    	"cur-crc-s": "f334",
    	"cur-lak": "f5aa",
    	"cur-lak-s": "f5a9",
    	"cur-sek": "f824",
    	"cur-sek-s": "f823",
    	"cur-thb": "f8dd",
    	"cur-thb-s": "f8dc",
    	"cur-try": "f919",
    	"cur-try-s": "f918",
    	"cur-uah": "f92d",
    	"cur-uah-s": "f92c",
    	"exc-ftx": "f466",
    	"exc-ftx-s": "f465",
    	"exc-ftx-us": "f466",
    	"exc-ftx-us-s": "f465",
    	"sym-cgld": "f2e1",
    	"sym-cgld-s": "f2e0",
    	"exc-uniswap-v2": "f93f",
    	"exc-uniswap-v2-s": "f93e",
    	"sym-kshib": "f83a",
    	"sym-kshib-s": "f839",
    	"sym-easy-s": "f3ce",
    	"sym-srare": "f7a8",
    	"sym-srare-s": "f7a7",
    	"sym-ape.2": "f1da",
    	"sym-ape.2-s": "f1d9"
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
