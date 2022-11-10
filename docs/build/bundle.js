
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

    var ustc = "fa4c";
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
    	"sym-crust-s": "f342",
    	"sym-crust": "f343",
    	"sym-crv-s": "f344",
    	"sym-crv": "f345",
    	"sym-crw-s": "f346",
    	"sym-crw": "f347",
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
    	"sym-goo-s": "f4bd",
    	"sym-goo": "f4be",
    	"sym-got-s": "f4bf",
    	"sym-got": "f4c0",
    	"sym-grc-s": "f4c1",
    	"sym-grc": "f4c2",
    	"sym-grin-s": "f4c3",
    	"sym-grin": "f4c4",
    	"sym-grs-s": "f4c5",
    	"sym-grs": "f4c6",
    	"sym-grt-s": "f4c7",
    	"sym-grt": "f4c8",
    	"sym-gsc-s": "f4c9",
    	"sym-gsc": "f4ca",
    	"sym-gst-s": "f4cb",
    	"sym-gst": "f4cc",
    	"sym-gt-s": "f4cd",
    	"sym-gt": "f4ce",
    	"sym-gtc-s": "f4cf",
    	"sym-gtc": "f4d0",
    	"sym-gtc2-s": "f4d1",
    	"sym-gtc2": "f4d2",
    	"sym-gto-s": "f4d3",
    	"sym-gto": "f4d4",
    	"sym-gup-s": "f4d5",
    	"sym-gup": "f4d6",
    	"sym-gusd-s": "f4d7",
    	"sym-gusd": "f4d8",
    	"sym-gvt-s": "f4d9",
    	"sym-gvt": "f4da",
    	"sym-gxc-s": "f4db",
    	"sym-gxc": "f4dc",
    	"sym-gxs-s": "f4dd",
    	"sym-gxs": "f4de",
    	"sym-hard-s": "f4df",
    	"sym-hard": "f4e0",
    	"sym-hbar-s": "f4e1",
    	"sym-hbar": "f4e2",
    	"sym-hc-s": "f4e3",
    	"sym-hc": "f4e4",
    	"sym-hdx-s": "f4e5",
    	"sym-hdx": "f4e6",
    	"sym-hedg-s": "f4e7",
    	"sym-hedg": "f4e8",
    	"sym-hegic-s": "f4e9",
    	"sym-hegic": "f4ea",
    	"sym-hex-s": "f4eb",
    	"sym-hex": "f4ec",
    	"sym-hft-s": "f4ed",
    	"sym-hft": "f4ee",
    	"sym-hg-s": "f4ef",
    	"sym-hg": "f4f0",
    	"sym-hgs-s": "f4f1",
    	"sym-hgs": "f4f2",
    	"sym-hh-s": "f4f3",
    	"sym-hh": "f4f4",
    	"sym-high-s": "f4f5",
    	"sym-high": "f4f6",
    	"sym-hit-s": "f4f7",
    	"sym-hit": "f4f8",
    	"sym-hive-s": "f4f9",
    	"sym-hive": "f4fa",
    	"sym-hkd-s": "f4fb",
    	"sym-hkd": "f4fc",
    	"sym-hko-s": "f4fd",
    	"sym-hko": "f4fe",
    	"sym-hmq-s": "f4ff",
    	"sym-hmq": "f500",
    	"sym-hns-s": "f501",
    	"sym-hns": "f502",
    	"sym-ho-s": "f503",
    	"sym-ho": "f504",
    	"sym-hopr-s": "f505",
    	"sym-hopr": "f506",
    	"sym-hot-s": "f507",
    	"sym-hot": "f508",
    	"sym-hp-s": "f509",
    	"sym-hp": "f50a",
    	"sym-hpb-s": "f50b",
    	"sym-hpb": "f50c",
    	"sym-hpc-s": "f50d",
    	"sym-hpc": "f50e",
    	"sym-hpt-s": "f50f",
    	"sym-hpt": "f510",
    	"sym-hrc-s": "f511",
    	"sym-hrc": "f512",
    	"sym-hsc-s": "f513",
    	"sym-hsc": "f514",
    	"sym-hsr-s": "f515",
    	"sym-hsr": "f516",
    	"sym-hst-s": "f517",
    	"sym-hst": "f518",
    	"sym-ht-s": "f519",
    	"sym-ht": "f51a",
    	"sym-html-s": "f51b",
    	"sym-html": "f51c",
    	"sym-htt-s": "f51d",
    	"sym-htt": "f51e",
    	"sym-huc-s": "f51f",
    	"sym-huc": "f520",
    	"sym-hunt-s": "f521",
    	"sym-hunt": "f522",
    	"sym-hvn-s": "f523",
    	"sym-hvn": "f524",
    	"sym-hxro-s": "f525",
    	"sym-hxro": "f526",
    	"sym-hyc-s": "f527",
    	"sym-hyc": "f528",
    	"sym-hydra-s": "f529",
    	"sym-hydra": "f52a",
    	"sym-hydro-s": "f52b",
    	"sym-hydro": "f52c",
    	"sym-icn-s": "f52d",
    	"sym-icn": "f52e",
    	"sym-icos-s": "f52f",
    	"sym-icos": "f530",
    	"sym-icp-s": "f531",
    	"sym-icp": "f532",
    	"sym-icx-s": "f533",
    	"sym-icx": "f534",
    	"sym-idex-s": "f535",
    	"sym-idex": "f536",
    	"sym-idh-s": "f537",
    	"sym-idh": "f538",
    	"sym-idr-s": "f539",
    	"sym-idr": "f53a",
    	"sym-ift-s": "f53b",
    	"sym-ift": "f53c",
    	"sym-ignis-s": "f53d",
    	"sym-ignis": "f53e",
    	"sym-ihf-s": "f53f",
    	"sym-ihf": "f540",
    	"sym-iht-s": "f541",
    	"sym-iht": "f542",
    	"sym-ilc-s": "f543",
    	"sym-ilc": "f544",
    	"sym-ilv-s": "f545",
    	"sym-ilv": "f546",
    	"sym-imx-s": "f547",
    	"sym-imx": "f548",
    	"sym-incnt-s": "f549",
    	"sym-incnt": "f54a",
    	"sym-ind-s": "f54b",
    	"sym-ind": "f54c",
    	"sym-indi-s": "f54d",
    	"sym-indi": "f54e",
    	"sym-inj-s": "f54f",
    	"sym-inj": "f550",
    	"sym-ink-s": "f551",
    	"sym-ink": "f552",
    	"sym-inr-s": "f553",
    	"sym-inr": "f554",
    	"sym-ins-s": "f555",
    	"sym-ins": "f556",
    	"sym-int-s": "f557",
    	"sym-int": "f558",
    	"sym-intr-s": "f559",
    	"sym-intr": "f55a",
    	"sym-ioc-s": "f55b",
    	"sym-ioc": "f55c",
    	"sym-ion-s": "f55d",
    	"sym-ion": "f55e",
    	"sym-iost-s": "f55f",
    	"sym-iost": "f560",
    	"sym-iot-s": "f561",
    	"sym-iot": "f562",
    	"sym-iotx-s": "f563",
    	"sym-iotx": "f564",
    	"sym-iq-s": "f565",
    	"sym-iq": "f566",
    	"sym-iris-s": "f567",
    	"sym-iris": "f568",
    	"sym-itc-s": "f569",
    	"sym-itc": "f56a",
    	"sym-ivy-s": "f56b",
    	"sym-ivy": "f56c",
    	"sym-ixt-s": "f56d",
    	"sym-ixt": "f56e",
    	"sym-jasmy-s": "f56f",
    	"sym-jasmy": "f570",
    	"sym-jnt-s": "f571",
    	"sym-jnt": "f572",
    	"sym-joe-s": "f573",
    	"sym-joe": "f574",
    	"sym-jpeg-s": "f575",
    	"sym-jpeg": "f576",
    	"sym-jpy-s": "f577",
    	"sym-jpy": "f578",
    	"sym-jst-s": "f579",
    	"sym-jst": "f57a",
    	"sym-juno-s": "f57b",
    	"sym-juno": "f57c",
    	"sym-just-s": "f57d",
    	"sym-just": "f57e",
    	"sym-juv-s": "f57f",
    	"sym-juv": "f580",
    	"sym-kan-s": "f581",
    	"sym-kan": "f582",
    	"sym-kapex-s": "f583",
    	"sym-kapex": "f584",
    	"sym-kar-s": "f585",
    	"sym-kar": "f586",
    	"sym-kava-s": "f587",
    	"sym-kava": "f588",
    	"sym-kbc-s": "f589",
    	"sym-kbc": "f58a",
    	"sym-kcash-s": "f58b",
    	"sym-kcash": "f58c",
    	"sym-kda-s": "f58d",
    	"sym-kda": "f58e",
    	"sym-keep-s": "f58f",
    	"sym-keep": "f590",
    	"sym-key-s": "f591",
    	"sym-key": "f592",
    	"sym-kick-s": "f593",
    	"sym-kick": "f594",
    	"sym-kilt-s": "f595",
    	"sym-kilt": "f596",
    	"sym-kin-s": "f597",
    	"sym-kin": "f598",
    	"sym-kint-s": "f599",
    	"sym-kint": "f59a",
    	"sym-klay-s": "f59b",
    	"sym-klay": "f59c",
    	"sym-kma-s": "f59d",
    	"sym-kma": "f59e",
    	"sym-kmd-s": "f59f",
    	"sym-kmd": "f5a0",
    	"sym-knc-s": "f5a1",
    	"sym-knc": "f5a2",
    	"sym-kore-s": "f5a3",
    	"sym-kore": "f5a4",
    	"sym-kp3r-s": "f5a5",
    	"sym-kp3r": "f5a6",
    	"sym-krm-s": "f5a7",
    	"sym-krm": "f5a8",
    	"sym-krw-s": "f5a9",
    	"sym-krw": "f5aa",
    	"sym-ksm-s": "f5ab",
    	"sym-ksm": "f5ac",
    	"sym-ksx-s": "f5ad",
    	"sym-ksx": "f5ae",
    	"sym-kyl-s": "f5af",
    	"sym-kyl": "f5b0",
    	"sym-la-s": "f5b1",
    	"sym-la": "f5b2",
    	"sym-lak-s": "f5b3",
    	"sym-lak": "f5b4",
    	"sym-lamb-s": "f5b5",
    	"sym-lamb": "f5b6",
    	"sym-latx-s": "f5b7",
    	"sym-latx": "f5b8",
    	"sym-layr-s": "f5b9",
    	"sym-layr": "f5ba",
    	"sym-lba-s": "f5bb",
    	"sym-lba": "f5bc",
    	"sym-lbc-s": "f5bd",
    	"sym-lbc": "f5be",
    	"sym-lcc-s": "f5bf",
    	"sym-lcc": "f5c0",
    	"sym-lcx-s": "f5c1",
    	"sym-lcx": "f5c2",
    	"sym-ldo-s": "f5c3",
    	"sym-ldo": "f5c4",
    	"sym-lend-s": "f5c5",
    	"sym-lend": "f5c6",
    	"sym-leo-s": "f5c7",
    	"sym-leo": "f5c8",
    	"sym-leoc-s": "f5c9",
    	"sym-leoc": "f5ca",
    	"sym-let-s": "f5cb",
    	"sym-let": "f5cc",
    	"sym-life-s": "f5cd",
    	"sym-life": "f5ce",
    	"sym-lina-s": "f5cf",
    	"sym-lina": "f5d0",
    	"sym-link-s": "f5d1",
    	"sym-link": "f5d2",
    	"sym-lit-s": "f5d3",
    	"sym-lit": "f5d4",
    	"sym-lmc-s": "f5d5",
    	"sym-lmc": "f5d6",
    	"sym-lml-s": "f5d7",
    	"sym-lml": "f5d8",
    	"sym-lmwr-s": "f5d9",
    	"sym-lmwr": "f5da",
    	"sym-lnc-s": "f5db",
    	"sym-lnc": "f5dc",
    	"sym-lnd-s": "f5dd",
    	"sym-lnd": "f5de",
    	"sym-loc-s": "f5df",
    	"sym-loc": "f5e0",
    	"sym-loka-s": "f5e1",
    	"sym-loka": "f5e2",
    	"sym-looks-s": "f5e3",
    	"sym-looks": "f5e4",
    	"sym-loom-s": "f5e5",
    	"sym-loom": "f5e6",
    	"sym-lpt-s": "f5e7",
    	"sym-lpt": "f5e8",
    	"sym-lqty-s": "f5e9",
    	"sym-lqty": "f5ea",
    	"sym-lrc-s": "f5eb",
    	"sym-lrc": "f5ec",
    	"sym-lrn-s": "f5ed",
    	"sym-lrn": "f5ee",
    	"sym-lsk-s": "f5ef",
    	"sym-lsk": "f5f0",
    	"sym-ltc-s": "f5f1",
    	"sym-ltc": "f5f2",
    	"sym-lto-s": "f5f3",
    	"sym-lto": "f5f4",
    	"sym-lun-s": "f5f5",
    	"sym-lun": "f5f6",
    	"sym-luna-s": "f5f7",
    	"sym-luna": "f5f8",
    	"sym-luna2-s": "f5f9",
    	"sym-luna2": "f5fa",
    	"sym-lxt-s": "f5fb",
    	"sym-lxt": "f5fc",
    	"sym-lym-s": "f5fd",
    	"sym-lym": "f5fe",
    	"sym-m2k-s": "f5ff",
    	"sym-m2k": "f600",
    	"sym-ma-s": "f601",
    	"sym-ma": "f602",
    	"sym-magic-s": "f603",
    	"sym-magic": "f604",
    	"sym-maid-s": "f605",
    	"sym-maid": "f606",
    	"sym-man-s": "f607",
    	"sym-man": "f608",
    	"sym-mana-s": "f609",
    	"sym-mana": "f60a",
    	"sym-maps-s": "f60b",
    	"sym-maps": "f60c",
    	"sym-mask-s": "f60d",
    	"sym-mask": "f60e",
    	"sym-mass-s": "f60f",
    	"sym-mass": "f610",
    	"sym-math-s": "f611",
    	"sym-math": "f612",
    	"sym-matic-s": "f613",
    	"sym-matic": "f614",
    	"sym-mbl-s": "f615",
    	"sym-mbl": "f616",
    	"sym-mbt-s": "f617",
    	"sym-mbt": "f618",
    	"sym-mc-s": "f619",
    	"sym-mc": "f61a",
    	"sym-mco-s": "f61b",
    	"sym-mco": "f61c",
    	"sym-mda-s": "f61d",
    	"sym-mda": "f61e",
    	"sym-mds-s": "f61f",
    	"sym-mds": "f620",
    	"sym-mdt-s": "f621",
    	"sym-mdt": "f622",
    	"sym-mdx-s": "f623",
    	"sym-mdx": "f624",
    	"sym-med-s": "f625",
    	"sym-med": "f626",
    	"sym-mer-s": "f627",
    	"sym-mer": "f628",
    	"sym-mes-s": "f629",
    	"sym-mes": "f62a",
    	"sym-met-s": "f62b",
    	"sym-met": "f62c",
    	"sym-meta-s": "f62d",
    	"sym-meta": "f62e",
    	"sym-metis-s": "f62f",
    	"sym-metis": "f630",
    	"sym-mft-s": "f631",
    	"sym-mft": "f632",
    	"sym-mgc-s": "f633",
    	"sym-mgc": "f634",
    	"sym-mgo-s": "f635",
    	"sym-mgo": "f636",
    	"sym-mhc-s": "f637",
    	"sym-mhc": "f638",
    	"sym-mina-s": "f639",
    	"sym-mina": "f63a",
    	"sym-mir-s": "f63b",
    	"sym-mir": "f63c",
    	"sym-mith-s": "f63d",
    	"sym-mith": "f63e",
    	"sym-mitx-s": "f63f",
    	"sym-mitx": "f640",
    	"sym-mjp-s": "f641",
    	"sym-mjp": "f642",
    	"sym-mkr-s": "f643",
    	"sym-mkr": "f644",
    	"sym-mln-s": "f645",
    	"sym-mln": "f646",
    	"sym-mngo-s": "f647",
    	"sym-mngo": "f648",
    	"sym-mnx-s": "f649",
    	"sym-mnx": "f64a",
    	"sym-moac-s": "f64b",
    	"sym-moac": "f64c",
    	"sym-mob-s": "f64d",
    	"sym-mob": "f64e",
    	"sym-mobi-s": "f64f",
    	"sym-mobi": "f650",
    	"sym-moc-s": "f651",
    	"sym-moc": "f652",
    	"sym-mod-s": "f653",
    	"sym-mod": "f654",
    	"sym-mona-s": "f655",
    	"sym-mona": "f656",
    	"sym-moon-s": "f657",
    	"sym-moon": "f658",
    	"sym-morph-s": "f659",
    	"sym-morph": "f65a",
    	"sym-movr-s": "f65b",
    	"sym-movr": "f65c",
    	"sym-mpl-s": "f65d",
    	"sym-mpl": "f65e",
    	"sym-mrk-s": "f65f",
    	"sym-mrk": "f660",
    	"sym-msol-s": "f661",
    	"sym-msol": "f662",
    	"sym-msp-s": "f663",
    	"sym-msp": "f664",
    	"sym-mta-s": "f665",
    	"sym-mta": "f666",
    	"sym-mtc-s": "f667",
    	"sym-mtc": "f668",
    	"sym-mth-s": "f669",
    	"sym-mth": "f66a",
    	"sym-mtl-s": "f66b",
    	"sym-mtl": "f66c",
    	"sym-mtn-s": "f66d",
    	"sym-mtn": "f66e",
    	"sym-mtx-s": "f66f",
    	"sym-mtx": "f670",
    	"sym-mue-s": "f671",
    	"sym-mue": "f672",
    	"sym-multi-s": "f673",
    	"sym-multi": "f674",
    	"sym-mv-s": "f675",
    	"sym-mv": "f676",
    	"sym-mx-s": "f677",
    	"sym-mx": "f678",
    	"sym-mxc-s": "f679",
    	"sym-mxc": "f67a",
    	"sym-mxm-s": "f67b",
    	"sym-mxm": "f67c",
    	"sym-mxn-s": "f67d",
    	"sym-mxn": "f67e",
    	"sym-myr-s": "f67f",
    	"sym-myr": "f680",
    	"sym-n9l-s": "f681",
    	"sym-n9l": "f682",
    	"sym-nanj-s": "f683",
    	"sym-nanj": "f684",
    	"sym-nano-s": "f685",
    	"sym-nano": "f686",
    	"sym-nas-s": "f687",
    	"sym-nas": "f688",
    	"sym-naut-s": "f689",
    	"sym-naut": "f68a",
    	"sym-nav-s": "f68b",
    	"sym-nav": "f68c",
    	"sym-ncash-s": "f68d",
    	"sym-ncash": "f68e",
    	"sym-nct-s": "f68f",
    	"sym-nct": "f690",
    	"sym-near-s": "f691",
    	"sym-near": "f692",
    	"sym-nebl-s": "f693",
    	"sym-nebl": "f694",
    	"sym-nec-s": "f695",
    	"sym-nec": "f696",
    	"sym-neo-s": "f697",
    	"sym-neo": "f698",
    	"sym-neos-s": "f699",
    	"sym-neos": "f69a",
    	"sym-nest-s": "f69b",
    	"sym-nest": "f69c",
    	"sym-neu-s": "f69d",
    	"sym-neu": "f69e",
    	"sym-new-s": "f69f",
    	"sym-new": "f6a0",
    	"sym-nexo-s": "f6a1",
    	"sym-nexo": "f6a2",
    	"sym-nft-s": "f6a3",
    	"sym-nft": "f6a4",
    	"sym-ng-s": "f6a5",
    	"sym-ng": "f6a6",
    	"sym-ngc-s": "f6a7",
    	"sym-ngc": "f6a8",
    	"sym-ngn-s": "f6a9",
    	"sym-ngn": "f6aa",
    	"sym-nim-s": "f6ab",
    	"sym-nim": "f6ac",
    	"sym-niy-s": "f6ad",
    	"sym-niy": "f6ae",
    	"sym-nkd-s": "f6af",
    	"sym-nkd": "f6b0",
    	"sym-nkn-s": "f6b1",
    	"sym-nkn": "f6b2",
    	"sym-nlc2-s": "f6b3",
    	"sym-nlc2": "f6b4",
    	"sym-nlg-s": "f6b5",
    	"sym-nlg": "f6b6",
    	"sym-nmc-s": "f6b7",
    	"sym-nmc": "f6b8",
    	"sym-nmr-s": "f6b9",
    	"sym-nmr": "f6ba",
    	"sym-nn-s": "f6bb",
    	"sym-nn": "f6bc",
    	"sym-noah-s": "f6bd",
    	"sym-noah": "f6be",
    	"sym-nodl-s": "f6bf",
    	"sym-nodl": "f6c0",
    	"sym-note-s": "f6c1",
    	"sym-note": "f6c2",
    	"sym-npg-s": "f6c3",
    	"sym-npg": "f6c4",
    	"sym-nplc-s": "f6c5",
    	"sym-nplc": "f6c6",
    	"sym-npxs-s": "f6c7",
    	"sym-npxs": "f6c8",
    	"sym-nq-s": "f6c9",
    	"sym-nq": "f6ca",
    	"sym-nrg-s": "f6cb",
    	"sym-nrg": "f6cc",
    	"sym-ntk-s": "f6cd",
    	"sym-ntk": "f6ce",
    	"sym-nu-s": "f6cf",
    	"sym-nu": "f6d0",
    	"sym-nuls-s": "f6d1",
    	"sym-nuls": "f6d2",
    	"sym-nvc-s": "f6d3",
    	"sym-nvc": "f6d4",
    	"sym-nxc-s": "f6d5",
    	"sym-nxc": "f6d6",
    	"sym-nxs-s": "f6d7",
    	"sym-nxs": "f6d8",
    	"sym-nxt-s": "f6d9",
    	"sym-nxt": "f6da",
    	"sym-nym-s": "f6db",
    	"sym-nym": "f6dc",
    	"sym-o-s": "f6dd",
    	"sym-o": "f6de",
    	"sym-oak-s": "f6df",
    	"sym-oak": "f6e0",
    	"sym-oax-s": "f6e1",
    	"sym-oax": "f6e2",
    	"sym-ocean-s": "f6e3",
    	"sym-ocean": "f6e4",
    	"sym-ocn-s": "f6e5",
    	"sym-ocn": "f6e6",
    	"sym-ode-s": "f6e7",
    	"sym-ode": "f6e8",
    	"sym-ogn-s": "f6e9",
    	"sym-ogn": "f6ea",
    	"sym-ogo-s": "f6eb",
    	"sym-ogo": "f6ec",
    	"sym-ok-s": "f6ed",
    	"sym-ok": "f6ee",
    	"sym-okb-s": "f6ef",
    	"sym-okb": "f6f0",
    	"sym-om-s": "f6f1",
    	"sym-om": "f6f2",
    	"sym-omg-s": "f6f3",
    	"sym-omg": "f6f4",
    	"sym-omni-s": "f6f5",
    	"sym-omni": "f6f6",
    	"sym-one-s": "f6f7",
    	"sym-one": "f6f8",
    	"sym-ong-s": "f6f9",
    	"sym-ong": "f6fa",
    	"sym-onot-s": "f6fb",
    	"sym-onot": "f6fc",
    	"sym-ont-s": "f6fd",
    	"sym-ont": "f6fe",
    	"sym-ooki-s": "f6ff",
    	"sym-ooki": "f700",
    	"sym-orbs-s": "f701",
    	"sym-orbs": "f702",
    	"sym-orca-s": "f703",
    	"sym-orca": "f704",
    	"sym-orme-s": "f705",
    	"sym-orme": "f706",
    	"sym-orn-s": "f707",
    	"sym-orn": "f708",
    	"sym-ors-s": "f709",
    	"sym-ors": "f70a",
    	"sym-osmo-s": "f70b",
    	"sym-osmo": "f70c",
    	"sym-ost-s": "f70d",
    	"sym-ost": "f70e",
    	"sym-otn-s": "f70f",
    	"sym-otn": "f710",
    	"sym-oxt-s": "f711",
    	"sym-oxt": "f712",
    	"sym-oxy-s": "f713",
    	"sym-oxy": "f714",
    	"sym-pai-s": "f715",
    	"sym-pai": "f716",
    	"sym-pal-s": "f717",
    	"sym-pal": "f718",
    	"sym-paper-s": "f719",
    	"sym-paper": "f71a",
    	"sym-para-s": "f71b",
    	"sym-para": "f71c",
    	"sym-part-s": "f71d",
    	"sym-part": "f71e",
    	"sym-pasc-s": "f71f",
    	"sym-pasc": "f720",
    	"sym-pat-s": "f721",
    	"sym-pat": "f722",
    	"sym-pax-s": "f723",
    	"sym-pax": "f724",
    	"sym-paxg-s": "f725",
    	"sym-paxg": "f726",
    	"sym-pay-s": "f727",
    	"sym-pay": "f728",
    	"sym-pbt-s": "f729",
    	"sym-pbt": "f72a",
    	"sym-pcl-s": "f72b",
    	"sym-pcl": "f72c",
    	"sym-pcx-s": "f72d",
    	"sym-pcx": "f72e",
    	"sym-pdex-s": "f72f",
    	"sym-pdex": "f730",
    	"sym-people-s": "f731",
    	"sym-people": "f732",
    	"sym-perl-s": "f733",
    	"sym-perl": "f734",
    	"sym-perp-s": "f735",
    	"sym-perp": "f736",
    	"sym-pha-s": "f737",
    	"sym-pha": "f738",
    	"sym-phb-s": "f739",
    	"sym-phb": "f73a",
    	"sym-php-s": "f73b",
    	"sym-php": "f73c",
    	"sym-phx-s": "f73d",
    	"sym-phx": "f73e",
    	"sym-pi-s": "f73f",
    	"sym-pi": "f740",
    	"sym-pica-s": "f741",
    	"sym-pica": "f742",
    	"sym-pink-s": "f743",
    	"sym-pink": "f744",
    	"sym-pivx-s": "f745",
    	"sym-pivx": "f746",
    	"sym-pkt-s": "f747",
    	"sym-pkt": "f748",
    	"sym-pl-s": "f749",
    	"sym-pl": "f74a",
    	"sym-pla-s": "f74b",
    	"sym-pla": "f74c",
    	"sym-plbt-s": "f74d",
    	"sym-plbt": "f74e",
    	"sym-plm-s": "f74f",
    	"sym-plm": "f750",
    	"sym-pln-s": "f751",
    	"sym-pln": "f752",
    	"sym-plr-s": "f753",
    	"sym-plr": "f754",
    	"sym-ply-s": "f755",
    	"sym-ply": "f756",
    	"sym-pma-s": "f757",
    	"sym-pma": "f758",
    	"sym-png-s": "f759",
    	"sym-png": "f75a",
    	"sym-pnt-s": "f75b",
    	"sym-pnt": "f75c",
    	"sym-poa-s": "f75d",
    	"sym-poa": "f75e",
    	"sym-poe-s": "f75f",
    	"sym-poe": "f760",
    	"sym-polis-s": "f761",
    	"sym-polis": "f762",
    	"sym-pols-s": "f763",
    	"sym-pols": "f764",
    	"sym-poly-s": "f765",
    	"sym-poly": "f766",
    	"sym-pond-s": "f767",
    	"sym-pond": "f768",
    	"sym-pot-s": "f769",
    	"sym-pot": "f76a",
    	"sym-powr-s": "f76b",
    	"sym-powr": "f76c",
    	"sym-ppc-s": "f76d",
    	"sym-ppc": "f76e",
    	"sym-ppt-s": "f76f",
    	"sym-ppt": "f770",
    	"sym-pra-s": "f771",
    	"sym-pra": "f772",
    	"sym-pre-s": "f773",
    	"sym-pre": "f774",
    	"sym-prg-s": "f775",
    	"sym-prg": "f776",
    	"sym-pro-s": "f777",
    	"sym-pro": "f778",
    	"sym-prq-s": "f779",
    	"sym-prq": "f77a",
    	"sym-pst-s": "f77b",
    	"sym-pst": "f77c",
    	"sym-pstake-s": "f77d",
    	"sym-pstake": "f77e",
    	"sym-pton-s": "f77f",
    	"sym-pton": "f780",
    	"sym-pundix-s": "f781",
    	"sym-pundix": "f782",
    	"sym-pvt-s": "f783",
    	"sym-pvt": "f784",
    	"sym-pxg-s": "f785",
    	"sym-pxg": "f786",
    	"sym-pyr-s": "f787",
    	"sym-pyr": "f788",
    	"sym-qash-s": "f789",
    	"sym-qash": "f78a",
    	"sym-qau-s": "f78b",
    	"sym-qau": "f78c",
    	"sym-qc-s": "f78d",
    	"sym-qc": "f78e",
    	"sym-qi-s": "f78f",
    	"sym-qi": "f790",
    	"sym-qi2-s": "f791",
    	"sym-qi2": "f792",
    	"sym-qkc-s": "f793",
    	"sym-qkc": "f794",
    	"sym-qlc-s": "f795",
    	"sym-qlc": "f796",
    	"sym-qnt-s": "f797",
    	"sym-qnt": "f798",
    	"sym-qntu-s": "f799",
    	"sym-qntu": "f79a",
    	"sym-qo-s": "f79b",
    	"sym-qo": "f79c",
    	"sym-qrdo-s": "f79d",
    	"sym-qrdo": "f79e",
    	"sym-qrl-s": "f79f",
    	"sym-qrl": "f7a0",
    	"sym-qsp-s": "f7a1",
    	"sym-qsp": "f7a2",
    	"sym-qtum-s": "f7a3",
    	"sym-qtum": "f7a4",
    	"sym-quick-s": "f7a5",
    	"sym-quick": "f7a6",
    	"sym-qun-s": "f7a7",
    	"sym-qun": "f7a8",
    	"sym-r-s": "f7a9",
    	"sym-r": "f7aa",
    	"sym-rad-s": "f7ab",
    	"sym-rad": "f7ac",
    	"sym-radar-s": "f7ad",
    	"sym-radar": "f7ae",
    	"sym-rads-s": "f7af",
    	"sym-rads": "f7b0",
    	"sym-ramp-s": "f7b1",
    	"sym-ramp": "f7b2",
    	"sym-rare-s": "f7b3",
    	"sym-rare": "f7b4",
    	"sym-rari-s": "f7b5",
    	"sym-rari": "f7b6",
    	"sym-rating-s": "f7b7",
    	"sym-rating": "f7b8",
    	"sym-ray-s": "f7b9",
    	"sym-ray": "f7ba",
    	"sym-rb-s": "f7bb",
    	"sym-rb": "f7bc",
    	"sym-rbc-s": "f7bd",
    	"sym-rbc": "f7be",
    	"sym-rblx-s": "f7bf",
    	"sym-rblx": "f7c0",
    	"sym-rbn-s": "f7c1",
    	"sym-rbn": "f7c2",
    	"sym-rbtc-s": "f7c3",
    	"sym-rbtc": "f7c4",
    	"sym-rby-s": "f7c5",
    	"sym-rby": "f7c6",
    	"sym-rcn-s": "f7c7",
    	"sym-rcn": "f7c8",
    	"sym-rdd-s": "f7c9",
    	"sym-rdd": "f7ca",
    	"sym-rdn-s": "f7cb",
    	"sym-rdn": "f7cc",
    	"sym-real-s": "f7cd",
    	"sym-real": "f7ce",
    	"sym-reef-s": "f7cf",
    	"sym-reef": "f7d0",
    	"sym-rem-s": "f7d1",
    	"sym-rem": "f7d2",
    	"sym-ren-s": "f7d3",
    	"sym-ren": "f7d4",
    	"sym-rep-s": "f7d5",
    	"sym-rep": "f7d6",
    	"sym-repv2-s": "f7d7",
    	"sym-repv2": "f7d8",
    	"sym-req-s": "f7d9",
    	"sym-req": "f7da",
    	"sym-rev-s": "f7db",
    	"sym-rev": "f7dc",
    	"sym-revv-s": "f7dd",
    	"sym-revv": "f7de",
    	"sym-rfox-s": "f7df",
    	"sym-rfox": "f7e0",
    	"sym-rfr-s": "f7e1",
    	"sym-rfr": "f7e2",
    	"sym-ric-s": "f7e3",
    	"sym-ric": "f7e4",
    	"sym-rif-s": "f7e5",
    	"sym-rif": "f7e6",
    	"sym-ring-s": "f7e7",
    	"sym-ring": "f7e8",
    	"sym-rlc-s": "f7e9",
    	"sym-rlc": "f7ea",
    	"sym-rly-s": "f7eb",
    	"sym-rly": "f7ec",
    	"sym-rmrk-s": "f7ed",
    	"sym-rmrk": "f7ee",
    	"sym-rndr-s": "f7ef",
    	"sym-rndr": "f7f0",
    	"sym-rntb-s": "f7f1",
    	"sym-rntb": "f7f2",
    	"sym-ron-s": "f7f3",
    	"sym-ron": "f7f4",
    	"sym-rook-s": "f7f5",
    	"sym-rook": "f7f6",
    	"sym-rose-s": "f7f7",
    	"sym-rose": "f7f8",
    	"sym-rox-s": "f7f9",
    	"sym-rox": "f7fa",
    	"sym-rp-s": "f7fb",
    	"sym-rp": "f7fc",
    	"sym-rpl-s": "f7fd",
    	"sym-rpl": "f7fe",
    	"sym-rpx-s": "f7ff",
    	"sym-rpx": "f800",
    	"sym-rsr-s": "f801",
    	"sym-rsr": "f802",
    	"sym-rsv-s": "f803",
    	"sym-rsv": "f804",
    	"sym-rty-s": "f805",
    	"sym-rty": "f806",
    	"sym-rub-s": "f807",
    	"sym-rub": "f808",
    	"sym-ruff-s": "f809",
    	"sym-ruff": "f80a",
    	"sym-rune-s": "f80b",
    	"sym-rune": "f80c",
    	"sym-rvn-s": "f80d",
    	"sym-rvn": "f80e",
    	"sym-rvr-s": "f80f",
    	"sym-rvr": "f810",
    	"sym-rvt-s": "f811",
    	"sym-rvt": "f812",
    	"sym-sai-s": "f813",
    	"sym-sai": "f814",
    	"sym-salt-s": "f815",
    	"sym-salt": "f816",
    	"sym-samo-s": "f817",
    	"sym-samo": "f818",
    	"sym-san-s": "f819",
    	"sym-san": "f81a",
    	"sym-sand-s": "f81b",
    	"sym-sand": "f81c",
    	"sym-sats-s": "f81d",
    	"sym-sats": "f81e",
    	"sym-sbd-s": "f81f",
    	"sym-sbd": "f820",
    	"sym-sbr-s": "f821",
    	"sym-sbr": "f822",
    	"sym-sc-s": "f823",
    	"sym-sc": "f824",
    	"sym-scc-s": "f825",
    	"sym-scc": "f826",
    	"sym-scrt-s": "f827",
    	"sym-scrt": "f828",
    	"sym-sdc-s": "f829",
    	"sym-sdc": "f82a",
    	"sym-sdn-s": "f82b",
    	"sym-sdn": "f82c",
    	"sym-seele-s": "f82d",
    	"sym-seele": "f82e",
    	"sym-sek-s": "f82f",
    	"sym-sek": "f830",
    	"sym-sen-s": "f831",
    	"sym-sen": "f832",
    	"sym-sent-s": "f833",
    	"sym-sent": "f834",
    	"sym-sero-s": "f835",
    	"sym-sero": "f836",
    	"sym-sexc-s": "f837",
    	"sym-sexc": "f838",
    	"sym-sfp-s": "f839",
    	"sym-sfp": "f83a",
    	"sym-sgb-s": "f83b",
    	"sym-sgb": "f83c",
    	"sym-sgc-s": "f83d",
    	"sym-sgc": "f83e",
    	"sym-sgd-s": "f83f",
    	"sym-sgd": "f840",
    	"sym-sgn-s": "f841",
    	"sym-sgn": "f842",
    	"sym-sgu-s": "f843",
    	"sym-sgu": "f844",
    	"sym-shib-s": "f845",
    	"sym-shib": "f846",
    	"sym-shift-s": "f847",
    	"sym-shift": "f848",
    	"sym-ship-s": "f849",
    	"sym-ship": "f84a",
    	"sym-shping-s": "f84b",
    	"sym-shping": "f84c",
    	"sym-si-s": "f84d",
    	"sym-si": "f84e",
    	"sym-sib-s": "f84f",
    	"sym-sib": "f850",
    	"sym-sil-s": "f851",
    	"sym-sil": "f852",
    	"sym-six-s": "f853",
    	"sym-six": "f854",
    	"sym-sjcx-s": "f855",
    	"sym-sjcx": "f856",
    	"sym-skl-s": "f857",
    	"sym-skl": "f858",
    	"sym-skm-s": "f859",
    	"sym-skm": "f85a",
    	"sym-sku-s": "f85b",
    	"sym-sku": "f85c",
    	"sym-sky-s": "f85d",
    	"sym-sky": "f85e",
    	"sym-slp-s": "f85f",
    	"sym-slp": "f860",
    	"sym-slr-s": "f861",
    	"sym-slr": "f862",
    	"sym-sls-s": "f863",
    	"sym-sls": "f864",
    	"sym-slt-s": "f865",
    	"sym-slt": "f866",
    	"sym-slv-s": "f867",
    	"sym-slv": "f868",
    	"sym-smart-s": "f869",
    	"sym-smart": "f86a",
    	"sym-smn-s": "f86b",
    	"sym-smn": "f86c",
    	"sym-smt-s": "f86d",
    	"sym-smt": "f86e",
    	"sym-snc-s": "f86f",
    	"sym-snc": "f870",
    	"sym-snet-s": "f871",
    	"sym-snet": "f872",
    	"sym-sngls-s": "f873",
    	"sym-sngls": "f874",
    	"sym-snm-s": "f875",
    	"sym-snm": "f876",
    	"sym-snt-s": "f877",
    	"sym-snt": "f878",
    	"sym-snx-s": "f879",
    	"sym-snx": "f87a",
    	"sym-soc-s": "f87b",
    	"sym-soc": "f87c",
    	"sym-socks-s": "f87d",
    	"sym-socks": "f87e",
    	"sym-sol-s": "f87f",
    	"sym-sol": "f880",
    	"sym-solid-s": "f881",
    	"sym-solid": "f882",
    	"sym-solo-s": "f883",
    	"sym-solo": "f884",
    	"sym-solve-s": "f885",
    	"sym-solve": "f886",
    	"sym-sos-s": "f887",
    	"sym-sos": "f888",
    	"sym-soul-s": "f889",
    	"sym-soul": "f88a",
    	"sym-sp-s": "f88b",
    	"sym-sp": "f88c",
    	"sym-sparta-s": "f88d",
    	"sym-sparta": "f88e",
    	"sym-spc-s": "f88f",
    	"sym-spc": "f890",
    	"sym-spd-s": "f891",
    	"sym-spd": "f892",
    	"sym-spell-s": "f893",
    	"sym-spell": "f894",
    	"sym-sphr-s": "f895",
    	"sym-sphr": "f896",
    	"sym-sphtx-s": "f897",
    	"sym-sphtx": "f898",
    	"sym-spnd-s": "f899",
    	"sym-spnd": "f89a",
    	"sym-spnk-s": "f89b",
    	"sym-spnk": "f89c",
    	"sym-srm-s": "f89d",
    	"sym-srm": "f89e",
    	"sym-srn-s": "f89f",
    	"sym-srn": "f8a0",
    	"sym-ssp-s": "f8a1",
    	"sym-ssp": "f8a2",
    	"sym-ssv-s": "f8a3",
    	"sym-ssv": "f8a4",
    	"sym-stacs-s": "f8a5",
    	"sym-stacs": "f8a6",
    	"sym-step-s": "f8a7",
    	"sym-step": "f8a8",
    	"sym-stg-s": "f8a9",
    	"sym-stg": "f8aa",
    	"sym-stmx-s": "f8ab",
    	"sym-stmx": "f8ac",
    	"sym-storm-s": "f8ad",
    	"sym-storm": "f8ae",
    	"sym-stpt-s": "f8af",
    	"sym-stpt": "f8b0",
    	"sym-stq-s": "f8b1",
    	"sym-stq": "f8b2",
    	"sym-str-s": "f8b3",
    	"sym-str": "f8b4",
    	"sym-strat-s": "f8b5",
    	"sym-strat": "f8b6",
    	"sym-strax-s": "f8b7",
    	"sym-strax": "f8b8",
    	"sym-strk-s": "f8b9",
    	"sym-strk": "f8ba",
    	"sym-strong-s": "f8bb",
    	"sym-strong": "f8bc",
    	"sym-stx-s": "f8bd",
    	"sym-stx": "f8be",
    	"sym-sub-s": "f8bf",
    	"sym-sub": "f8c0",
    	"sym-sui-s": "f8c1",
    	"sym-sui": "f8c2",
    	"sym-sun-s": "f8c3",
    	"sym-sun": "f8c4",
    	"sym-super-s": "f8c5",
    	"sym-super": "f8c6",
    	"sym-susd-s": "f8c7",
    	"sym-susd": "f8c8",
    	"sym-sushi-s": "f8c9",
    	"sym-sushi": "f8ca",
    	"sym-swftc-s": "f8cb",
    	"sym-swftc": "f8cc",
    	"sym-swm-s": "f8cd",
    	"sym-swm": "f8ce",
    	"sym-swrv-s": "f8cf",
    	"sym-swrv": "f8d0",
    	"sym-swt-s": "f8d1",
    	"sym-swt": "f8d2",
    	"sym-swth-s": "f8d3",
    	"sym-swth": "f8d4",
    	"sym-sxp-s": "f8d5",
    	"sym-sxp": "f8d6",
    	"sym-syn-s": "f8d7",
    	"sym-syn": "f8d8",
    	"sym-sys-s": "f8d9",
    	"sym-sys": "f8da",
    	"sym-t-s": "f8db",
    	"sym-t": "f8dc",
    	"sym-taas-s": "f8dd",
    	"sym-taas": "f8de",
    	"sym-tau-s": "f8df",
    	"sym-tau": "f8e0",
    	"sym-tbtc-s": "f8e1",
    	"sym-tbtc": "f8e2",
    	"sym-tct-s": "f8e3",
    	"sym-tct": "f8e4",
    	"sym-teer-s": "f8e5",
    	"sym-teer": "f8e6",
    	"sym-tel-s": "f8e7",
    	"sym-temco-s": "f8e8",
    	"sym-temco": "f8e9",
    	"sym-tfuel-s": "f8ea",
    	"sym-tfuel": "f8eb",
    	"sym-thb-s": "f8ec",
    	"sym-thb": "f8ed",
    	"sym-thc-s": "f8ee",
    	"sym-thc": "f8ef",
    	"sym-theta-s": "f8f0",
    	"sym-theta": "f8f1",
    	"sym-thx-s": "f8f2",
    	"sym-thx": "f8f3",
    	"sym-time-s": "f8f4",
    	"sym-time": "f8f5",
    	"sym-tio-s": "f8f6",
    	"sym-tio": "f8f7",
    	"sym-tix-s": "f8f8",
    	"sym-tix": "f8f9",
    	"sym-tkn-s": "f8fa",
    	"sym-tkn": "f8fb",
    	"sym-tky-s": "f8fc",
    	"sym-tky": "f8fd",
    	"sym-tlm-s": "f8fe",
    	"sym-tlm": "f8ff",
    	"sym-tnb-s": "f900",
    	"sym-tnb": "f901",
    	"sym-tnc-s": "f902",
    	"sym-tnc": "f903",
    	"sym-tnt-s": "f904",
    	"sym-tnt": "f905",
    	"sym-toke-s": "f906",
    	"sym-toke": "f907",
    	"sym-tomb-s": "f908",
    	"sym-tomb": "f909",
    	"sym-tomo-s": "f90a",
    	"sym-tomo": "f90b",
    	"sym-top-s": "f90c",
    	"sym-top": "f90d",
    	"sym-torn-s": "f90e",
    	"sym-torn": "f90f",
    	"sym-tower-s": "f910",
    	"sym-tower": "f911",
    	"sym-tpay-s": "f912",
    	"sym-tpay": "f913",
    	"sym-trac-s": "f914",
    	"sym-trac": "f915",
    	"sym-trb-s": "f916",
    	"sym-trb": "f917",
    	"sym-tribe-s": "f918",
    	"sym-tribe": "f919",
    	"sym-trig-s": "f91a",
    	"sym-trig": "f91b",
    	"sym-trio-s": "f91c",
    	"sym-trio": "f91d",
    	"sym-troy-s": "f91e",
    	"sym-troy": "f91f",
    	"sym-trst-s": "f920",
    	"sym-trst": "f921",
    	"sym-tru-s": "f922",
    	"sym-tru": "f923",
    	"sym-true-s": "f924",
    	"sym-true": "f925",
    	"sym-trx-s": "f926",
    	"sym-trx": "f927",
    	"sym-try-s": "f928",
    	"sym-try": "f929",
    	"sym-tryb-s": "f92a",
    	"sym-tryb": "f92b",
    	"sym-tt-s": "f92c",
    	"sym-tt": "f92d",
    	"sym-ttc-s": "f92e",
    	"sym-ttc": "f92f",
    	"sym-ttt-s": "f930",
    	"sym-ttt": "f931",
    	"sym-ttu-s": "f932",
    	"sym-ttu": "f933",
    	"sym-tube-s": "f934",
    	"sym-tube": "f935",
    	"sym-tusd-s": "f936",
    	"sym-tusd": "f937",
    	"sym-tvk-s": "f938",
    	"sym-tvk": "f939",
    	"sym-twt-s": "f93a",
    	"sym-twt": "f93b",
    	"sym-uah-s": "f93c",
    	"sym-uah": "f93d",
    	"sym-ubq-s": "f93e",
    	"sym-ubq": "f93f",
    	"sym-ubt-s": "f940",
    	"sym-ubt": "f941",
    	"sym-uft-s": "f942",
    	"sym-uft": "f943",
    	"sym-ugas-s": "f944",
    	"sym-ugas": "f945",
    	"sym-uip-s": "f946",
    	"sym-uip": "f947",
    	"sym-ukg-s": "f948",
    	"sym-ukg": "f949",
    	"sym-uma-s": "f94a",
    	"sym-uma": "f94b",
    	"sym-umami-s": "f94c",
    	"sym-umami": "f94d",
    	"sym-unfi-s": "f94e",
    	"sym-unfi": "f94f",
    	"sym-uni-s": "f950",
    	"sym-uni": "f951",
    	"sym-unq-s": "f952",
    	"sym-unq": "f953",
    	"sym-up-s": "f954",
    	"sym-up": "f955",
    	"sym-upp-s": "f956",
    	"sym-upp": "f957",
    	"sym-usd-s": "f958",
    	"sym-usd": "f959",
    	"sym-usdc-s": "f95a",
    	"sym-usdc": "f95b",
    	"sym-usds-s": "f95c",
    	"sym-usds": "f95d",
    	"sym-usk-s": "f95e",
    	"sym-usk": "f95f",
    	"sym-ust-s": "f960",
    	"sym-ust": "f961",
    	"sym-utk-s": "f962",
    	"sym-utk": "f963",
    	"sym-utnp-s": "f964",
    	"sym-utnp": "f965",
    	"sym-utt-s": "f966",
    	"sym-utt": "f967",
    	"sym-uuu-s": "f968",
    	"sym-uuu": "f969",
    	"sym-ux-s": "f96a",
    	"sym-ux": "f96b",
    	"sym-vader-s": "f96c",
    	"sym-vader": "f96d",
    	"sym-vai-s": "f96e",
    	"sym-vai": "f96f",
    	"sym-vbk-s": "f970",
    	"sym-vbk": "f971",
    	"sym-vdx-s": "f972",
    	"sym-vdx": "f973",
    	"sym-vee-s": "f974",
    	"sym-vee": "f975",
    	"sym-vemp-s": "f976",
    	"sym-vemp": "f977",
    	"sym-ven-s": "f978",
    	"sym-ven": "f979",
    	"sym-veo-s": "f97a",
    	"sym-veo": "f97b",
    	"sym-veri-s": "f97c",
    	"sym-veri": "f97d",
    	"sym-vex-s": "f97e",
    	"sym-vex": "f97f",
    	"sym-vgx-s": "f980",
    	"sym-vgx": "f981",
    	"sym-via-s": "f982",
    	"sym-via": "f983",
    	"sym-vib-s": "f984",
    	"sym-vib": "f985",
    	"sym-vibe-s": "f986",
    	"sym-vibe": "f987",
    	"sym-vid-s": "f988",
    	"sym-vid": "f989",
    	"sym-vidt-s": "f98a",
    	"sym-vidt": "f98b",
    	"sym-vidy-s": "f98c",
    	"sym-vidy": "f98d",
    	"sym-vitae-s": "f98e",
    	"sym-vitae": "f98f",
    	"sym-vite-s": "f990",
    	"sym-vite": "f991",
    	"sym-vlx-s": "f992",
    	"sym-vlx": "f993",
    	"sym-vox-s": "f994",
    	"sym-vox": "f995",
    	"sym-voxel-s": "f996",
    	"sym-voxel": "f997",
    	"sym-vra-s": "f998",
    	"sym-vra": "f999",
    	"sym-vrc-s": "f99a",
    	"sym-vrc": "f99b",
    	"sym-vrm-s": "f99c",
    	"sym-vrm": "f99d",
    	"sym-vsys-s": "f99e",
    	"sym-vsys": "f99f",
    	"sym-vtc-s": "f9a0",
    	"sym-vtc": "f9a1",
    	"sym-vtho-s": "f9a2",
    	"sym-vtho": "f9a3",
    	"sym-wabi-s": "f9a4",
    	"sym-wabi": "f9a5",
    	"sym-wan-s": "f9a6",
    	"sym-wan": "f9a7",
    	"sym-waves-s": "f9a8",
    	"sym-waves": "f9a9",
    	"sym-wax-s": "f9aa",
    	"sym-wax": "f9ab",
    	"sym-wbtc-s": "f9ac",
    	"sym-wbtc": "f9ad",
    	"sym-wet-s": "f9ae",
    	"sym-wet": "f9af",
    	"sym-weth-s": "f9b0",
    	"sym-weth": "f9b1",
    	"sym-wib-s": "f9b2",
    	"sym-wib": "f9b3",
    	"sym-wicc-s": "f9b4",
    	"sym-wicc": "f9b5",
    	"sym-win-s": "f9b6",
    	"sym-win": "f9b7",
    	"sym-wing-s": "f9b8",
    	"sym-wing": "f9b9",
    	"sym-wings-s": "f9ba",
    	"sym-wings": "f9bb",
    	"sym-wnxm-s": "f9bc",
    	"sym-wnxm": "f9bd",
    	"sym-woo-s": "f9be",
    	"sym-woo": "f9bf",
    	"sym-wpr-s": "f9c0",
    	"sym-wpr": "f9c1",
    	"sym-wrx-s": "f9c2",
    	"sym-wrx": "f9c3",
    	"sym-wtc-s": "f9c4",
    	"sym-wtc": "f9c5",
    	"sym-wtt-s": "f9c6",
    	"sym-wtt": "f9c7",
    	"sym-wwb-s": "f9c8",
    	"sym-wwb": "f9c9",
    	"sym-wxt-s": "f9ca",
    	"sym-wxt": "f9cb",
    	"sym-xas-s": "f9cc",
    	"sym-xas": "f9cd",
    	"sym-xaur-s": "f9ce",
    	"sym-xaur": "f9cf",
    	"sym-xaut-s": "f9d0",
    	"sym-xaut": "f9d1",
    	"sym-xava-s": "f9d2",
    	"sym-xava": "f9d3",
    	"sym-xbc-s": "f9d4",
    	"sym-xbc": "f9d5",
    	"sym-xcn-s": "f9d6",
    	"sym-xcn": "f9d7",
    	"sym-xcon-s": "f9d8",
    	"sym-xcon": "f9d9",
    	"sym-xcp-s": "f9da",
    	"sym-xcp": "f9db",
    	"sym-xdefi-s": "f9dc",
    	"sym-xdefi": "f9dd",
    	"sym-xdn-s": "f9de",
    	"sym-xdn": "f9df",
    	"sym-xel-s": "f9e0",
    	"sym-xel": "f9e1",
    	"sym-xem-s": "f9e2",
    	"sym-xem": "f9e3",
    	"sym-xes-s": "f9e4",
    	"sym-xes": "f9e5",
    	"sym-xhv-s": "f9e6",
    	"sym-xhv": "f9e7",
    	"sym-xin-s": "f9e8",
    	"sym-xin": "f9e9",
    	"sym-xlm-s": "f9ea",
    	"sym-xlm": "f9eb",
    	"sym-xmc-s": "f9ec",
    	"sym-xmc": "f9ed",
    	"sym-xmr-s": "f9ee",
    	"sym-xmr": "f9ef",
    	"sym-xmx-s": "f9f0",
    	"sym-xmx": "f9f1",
    	"sym-xmy-s": "f9f2",
    	"sym-xmy": "f9f3",
    	"sym-xnk-s": "f9f4",
    	"sym-xnk": "f9f5",
    	"sym-xns-s": "f9f6",
    	"sym-xns": "f9f7",
    	"sym-xor-s": "f9f8",
    	"sym-xor": "f9f9",
    	"sym-xos-s": "f9fa",
    	"sym-xos": "f9fb",
    	"sym-xpm-s": "f9fc",
    	"sym-xpm": "f9fd",
    	"sym-xpr-s": "f9fe",
    	"sym-xpr": "f9ff",
    	"sym-xrc-s": "fa00",
    	"sym-xrc": "fa01",
    	"sym-xrp-s": "fa02",
    	"sym-xrp": "fa03",
    	"sym-xrpx-s": "fa04",
    	"sym-xrpx": "fa05",
    	"sym-xrt-s": "fa06",
    	"sym-xrt": "fa07",
    	"sym-xst-s": "fa08",
    	"sym-xst": "fa09",
    	"sym-xtp-s": "fa0a",
    	"sym-xtp": "fa0b",
    	"sym-xtz-s": "fa0c",
    	"sym-xtz": "fa0d",
    	"sym-xtzdown-s": "fa0e",
    	"sym-xtzdown": "fa0f",
    	"sym-xvc-s": "fa10",
    	"sym-xvc": "fa11",
    	"sym-xvg-s": "fa12",
    	"sym-xvg": "fa13",
    	"sym-xvs-s": "fa14",
    	"sym-xvs": "fa15",
    	"sym-xwc-s": "fa16",
    	"sym-xwc": "fa17",
    	"sym-xyo-s": "fa18",
    	"sym-xyo": "fa19",
    	"sym-xzc-s": "fa1a",
    	"sym-xzc": "fa1b",
    	"sym-yam-s": "fa1c",
    	"sym-yam": "fa1d",
    	"sym-yee-s": "fa1e",
    	"sym-yee": "fa1f",
    	"sym-yeed-s": "fa20",
    	"sym-yeed": "fa21",
    	"sym-yfi-s": "fa22",
    	"sym-yfi": "fa23",
    	"sym-yfii-s": "fa24",
    	"sym-yfii": "fa25",
    	"sym-ygg-s": "fa26",
    	"sym-ygg": "fa27",
    	"sym-yoyow-s": "fa28",
    	"sym-yoyow": "fa29",
    	"sym-zar-s": "fa2a",
    	"sym-zar": "fa2b",
    	"sym-zcl-s": "fa2c",
    	"sym-zcl": "fa2d",
    	"sym-zcn-s": "fa2e",
    	"sym-zcn": "fa2f",
    	"sym-zco-s": "fa30",
    	"sym-zco": "fa31",
    	"sym-zec-s": "fa32",
    	"sym-zec": "fa33",
    	"sym-zen-s": "fa34",
    	"sym-zen": "fa35",
    	"sym-zil-s": "fa36",
    	"sym-zil": "fa37",
    	"sym-zks-s": "fa38",
    	"sym-zks": "fa39",
    	"sym-zla-s": "fa3a",
    	"sym-zla": "fa3b",
    	"sym-zlk": "fa3c",
    	"sym-zondo-s": "fa3d",
    	"sym-zondo": "fa3e",
    	"sym-zpr-s": "fa3f",
    	"sym-zpr": "fa40",
    	"sym-zpt-s": "fa41",
    	"sym-zpt": "fa42",
    	"sym-zrc-s": "fa43",
    	"sym-zrc": "fa44",
    	"sym-zrx-s": "fa45",
    	"sym-zrx": "fa46",
    	"sym-zsc-s": "fa47",
    	"sym-zsc": "fa48",
    	"sym-ztg-s": "fa49",
    	"sym-ztg": "fa4a",
    	"ustc-s": "fa4b",
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
    	"exc-gemini": "f4d8",
    	"cur-gusd": "f4d8",
    	"exc-gemini-s": "f4d7",
    	"cur-gusd-s": "f4d7",
    	"cur-hkd": "f4fc",
    	"cur-hkd-s": "f4fb",
    	"sym-husd": "f51a",
    	"exc-huobi": "f51a",
    	"cur-ht": "f51a",
    	"sym-husd-s": "f519",
    	"exc-huobi-s": "f519",
    	"cur-ht-s": "f519",
    	"cur-idr": "f53a",
    	"cur-idr-s": "f539",
    	"sym-iota": "f562",
    	"sym-iota-s": "f561",
    	"cur-inr": "f554",
    	"cur-inr-s": "f553",
    	"cur-jpy": "f578",
    	"cur-jpy-s": "f577",
    	"cur-krw": "f5aa",
    	"cur-krw-s": "f5a9",
    	"sym-medx": "f626",
    	"sym-medx-s": "f625",
    	"cur-mxn": "f67e",
    	"cur-mxn-s": "f67d",
    	"cur-myr": "f680",
    	"cur-myr-s": "f67f",
    	"cur-ngn": "f6aa",
    	"cur-ngn-s": "f6a9",
    	"cur-pax": "f724",
    	"cur-pax-s": "f723",
    	"cur-php": "f73c",
    	"cur-php-s": "f73b",
    	"cur-pln": "f752",
    	"cur-pln-s": "f751",
    	"cur-qash": "f78a",
    	"cur-qash-s": "f789",
    	"cur-rub": "f808",
    	"cur-rur": "f808",
    	"cur-rub-s": "f807",
    	"cur-rur-s": "f807",
    	"sym-steem": "f820",
    	"sym-steem-s": "f81f",
    	"sym-xsc": "f824",
    	"sym-xsc-s": "f823",
    	"cur-sgd": "f840",
    	"cur-sgd-s": "f83f",
    	"sym-storj": "f856",
    	"sym-storj-s": "f855",
    	"sym-tel": "f8de",
    	"cur-trx": "f927",
    	"cur-trx-s": "f926",
    	"cur-tusd": "f937",
    	"cur-tusd-s": "f936",
    	"cur-usd": "f959",
    	"cur-usd-s": "f958",
    	"cur-usdc": "f95b",
    	"cur-usdc-s": "f95a",
    	"sym-vet": "f979",
    	"sym-vet-s": "f978",
    	"sym-waxp": "f9ab",
    	"sym-waxp-s": "f9aa",
    	"cur-xlm": "f9eb",
    	"cur-xlm-s": "f9ea",
    	"cur-xmr": "f9ef",
    	"cur-xmr-s": "f9ee",
    	"cur-xrp": "fa03",
    	"cur-xrp-s": "fa02",
    	"cur-zar": "fa2b",
    	"cur-zar-s": "fa2a",
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
    	"cur-lak": "f5b4",
    	"cur-lak-s": "f5b3",
    	"cur-sek": "f830",
    	"cur-sek-s": "f82f",
    	"cur-thb": "f8ed",
    	"cur-thb-s": "f8ec",
    	"cur-try": "f929",
    	"cur-try-s": "f928",
    	"cur-uah": "f93d",
    	"cur-uah-s": "f93c",
    	"exc-ftx": "f46c",
    	"exc-ftx-s": "f46b",
    	"exc-ftx-us": "f46c",
    	"exc-ftx-us-s": "f46b",
    	"sym-cgld": "f2e1",
    	"sym-cgld-s": "f2e0",
    	"exc-uniswap-v2": "f951",
    	"exc-uniswap-v2-s": "f950",
    	"sym-kshib": "f846",
    	"sym-kshib-s": "f845",
    	"sym-easy-s": "f3d0",
    	"sym-srare": "f7b4",
    	"sym-srare-s": "f7b3",
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
    var aac = "Double-A Chain";
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
    var amlt = "AMLT Network";
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
    var axpr = "Moola";
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
    var bnc = "Bifrost Native Coin";
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
    var btm = "Bytom";
    var btn = "BitNewChain";
    var bto = "Bottos";
    var btrst = "Braintrust";
    var bts = "BitShares";
    var btt = "BitTorrent";
    var btu = "BTU Protocol";
    var btx = "Bitcore";
    var burger = "BurgerCities";
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
    var cennz = "CENNZnet";
    var cfg = "Centrifuge";
    var cfi = "CyberFi";
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
    var cova = "Cova Unity";
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
    var cvnt = "Conscious Value Network";
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
    var floki = "Floki";
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
    var fun = "FUNToken";
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
    var gld = "SPDR Gold Shares";
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
    var goo = "";
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
    var hvn = "Hiveterminal";
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
    var ins = "iNFTspace";
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
    var lba = "Libra Credit";
    var lbc = "LBRY Credits";
    var lcc = "Litecoin Cash";
    var lcx = "LCX";
    var ldo = "Lido DAO Token";
    var lend = "Aave";
    var leo = "LEO Token";
    var leoc = "LEOcoin";
    var life = "Life Crypto";
    var lina = "Linear";
    var link = "ChainLink";
    var lit = "Litentry";
    var lmc = "LoMoCoin";
    var lml = "Link Machine Learning";
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
    var mco = "MCO";
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
    var mft = "Hifi Finance";
    var mgc = "E-micro Gold Futures";
    var mgo = "MobileGo";
    var mhc = "#MetaHash";
    var mina = "Mina";
    var mir = "Mirror Protocol";
    var mith = "Mithril";
    var mitx = "Morpheus Labs";
    var mjp = "Aluminum Japan Premium (Platts) Futures";
    var mkr = "Maker";
    var mln = "Enzyme";
    var mngo = "Mango Markets";
    var mnx = "MinexCoin";
    var moac = "MOAC";
    var mob = "MobileCoin";
    var mobi = "Mobius";
    var moc = "Moss Coin";
    var mod = "Modefi";
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
    var nodl = "Nodle Network";
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
    var perl = "PERL.eco";
    var perp = "Perpetual Protocol";
    var pha = "Phala.Network";
    var phb = "Phoenix Global";
    var php = "Philippine Peso";
    var phx = "Phoenix";
    var pi = "Plian";
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
    var pstake = "pSTAKE Finance";
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
    var rbtc = "Rootstock RSK";
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
    var san = "Santiment Network";
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
    var swm = "Swarm Network";
    var swrv = "Swerve";
    var swt = "Swarm City";
    var swth = "Switcheo";
    var sxp = "Swipe";
    var syn = "Synapse";
    var sys = "Syscoin";
    var t = "Threshold Network";
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
    var tt = "ThunderCore";
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
    var vid = "Vivid Labs";
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
    var xdefi = "Xdefi Wallet";
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
    var eth2 = "Ethereum 2.0";
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
    	goo: goo,
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
    	"new": "Newton Project",
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
