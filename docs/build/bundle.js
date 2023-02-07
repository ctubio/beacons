
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

    var ustc = "fa52";
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
    	"sym-arb-s": "f1e5",
    	"sym-arb": "f1e6",
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
    	"sym-blur-s": "f274",
    	"sym-blur": "f275",
    	"sym-blz-s": "f276",
    	"sym-blz": "f277",
    	"sym-bmc-s": "f278",
    	"sym-bmc": "f279",
    	"sym-bnb-s": "f27a",
    	"sym-bnb": "f27b",
    	"sym-bnc-s": "f27c",
    	"sym-bnc": "f27d",
    	"sym-bnk-s": "f27e",
    	"sym-bnk": "f27f",
    	"sym-bnt-s": "f280",
    	"sym-bnt": "f281",
    	"sym-bo-s": "f282",
    	"sym-bo": "f283",
    	"sym-boba-s": "f284",
    	"sym-boba": "f285",
    	"sym-bond-s": "f286",
    	"sym-bond": "f287",
    	"sym-boo-s": "f288",
    	"sym-boo": "f289",
    	"sym-bor-s": "f28a",
    	"sym-bor": "f28b",
    	"sym-bora-s": "f28c",
    	"sym-bora": "f28d",
    	"sym-bos-s": "f28e",
    	"sym-bos": "f28f",
    	"sym-box-s": "f290",
    	"sym-box": "f291",
    	"sym-brd-s": "f292",
    	"sym-brd": "f293",
    	"sym-breed-s": "f294",
    	"sym-breed": "f295",
    	"sym-brg-s": "f296",
    	"sym-brg": "f297",
    	"sym-brick-s": "f298",
    	"sym-brick": "f299",
    	"sym-bsd-s": "f29a",
    	"sym-bsd": "f29b",
    	"sym-bsv-s": "f29c",
    	"sym-bsv": "f29d",
    	"sym-bsx-s": "f29e",
    	"sym-bsx": "f29f",
    	"sym-bt1-s": "f2a0",
    	"sym-bt1": "f2a1",
    	"sym-bt2-s": "f2a2",
    	"sym-bt2": "f2a3",
    	"sym-btc-s": "f2a4",
    	"sym-btc": "f2a5",
    	"sym-btcd-s": "f2a6",
    	"sym-btcd": "f2a7",
    	"sym-btcfx-s": "f2a8",
    	"sym-btcfx": "f2a9",
    	"sym-btcp-s": "f2aa",
    	"sym-btcp": "f2ab",
    	"sym-btg-s": "f2ac",
    	"sym-btg": "f2ad",
    	"sym-btm-s": "f2ae",
    	"sym-btm": "f2af",
    	"sym-btn-s": "f2b0",
    	"sym-btn": "f2b1",
    	"sym-bto-s": "f2b2",
    	"sym-bto": "f2b3",
    	"sym-btrst-s": "f2b4",
    	"sym-btrst": "f2b5",
    	"sym-bts-s": "f2b6",
    	"sym-bts": "f2b7",
    	"sym-btt-s": "f2b8",
    	"sym-btt": "f2b9",
    	"sym-btu-s": "f2ba",
    	"sym-btu": "f2bb",
    	"sym-btx-s": "f2bc",
    	"sym-btx": "f2bd",
    	"sym-burger-s": "f2be",
    	"sym-burger": "f2bf",
    	"sym-burst-s": "f2c0",
    	"sym-burst": "f2c1",
    	"sym-bus-s": "f2c2",
    	"sym-bus": "f2c3",
    	"sym-busd-s": "f2c4",
    	"sym-busd": "f2c5",
    	"sym-bwx-s": "f2c6",
    	"sym-bwx": "f2c7",
    	"sym-bz-s": "f2c8",
    	"sym-bz": "f2c9",
    	"sym-bzrx-s": "f2ca",
    	"sym-bzrx": "f2cb",
    	"sym-c-s": "f2cc",
    	"sym-c": "f2cd",
    	"sym-c20-s": "f2ce",
    	"sym-c20": "f2cf",
    	"sym-c98-s": "f2d0",
    	"sym-c98": "f2d1",
    	"sym-cad-s": "f2d2",
    	"sym-cad": "f2d3",
    	"sym-cake-s": "f2d4",
    	"sym-cake": "f2d5",
    	"sym-cas-s": "f2d6",
    	"sym-cas": "f2d7",
    	"sym-cat-s": "f2d8",
    	"sym-cat": "f2d9",
    	"sym-cbc-s": "f2da",
    	"sym-cbc": "f2db",
    	"sym-cbt-s": "f2dc",
    	"sym-cbt": "f2dd",
    	"sym-cdt-s": "f2de",
    	"sym-cdt": "f2df",
    	"sym-cel-s": "f2e0",
    	"sym-cel": "f2e1",
    	"sym-celo-s": "f2e2",
    	"sym-celo": "f2e3",
    	"sym-celr-s": "f2e4",
    	"sym-celr": "f2e5",
    	"sym-cennz-s": "f2e6",
    	"sym-cennz": "f2e7",
    	"sym-cfg-s": "f2e8",
    	"sym-cfg": "f2e9",
    	"sym-cfi-s": "f2ea",
    	"sym-cfi": "f2eb",
    	"sym-cfx-s": "f2ec",
    	"sym-cfx": "f2ed",
    	"sym-cgt-s": "f2ee",
    	"sym-cgt": "f2ef",
    	"sym-chat-s": "f2f0",
    	"sym-chat": "f2f1",
    	"sym-chf-s": "f2f2",
    	"sym-chf": "f2f3",
    	"sym-chp-s": "f2f4",
    	"sym-chp": "f2f5",
    	"sym-chr-s": "f2f6",
    	"sym-chr": "f2f7",
    	"sym-chsb-s": "f2f8",
    	"sym-chsb": "f2f9",
    	"sym-chx-s": "f2fa",
    	"sym-chx": "f2fb",
    	"sym-chz-s": "f2fc",
    	"sym-chz": "f2fd",
    	"sym-ckb-s": "f2fe",
    	"sym-ckb": "f2ff",
    	"sym-cl-s": "f300",
    	"sym-cl": "f301",
    	"sym-clam-s": "f302",
    	"sym-clam": "f303",
    	"sym-cln-s": "f304",
    	"sym-cln": "f305",
    	"sym-clo-s": "f306",
    	"sym-clo": "f307",
    	"sym-cloak-s": "f308",
    	"sym-cloak": "f309",
    	"sym-clv-s": "f30a",
    	"sym-clv": "f30b",
    	"sym-cmct-s": "f30c",
    	"sym-cmct": "f30d",
    	"sym-cmt-s": "f30e",
    	"sym-cmt": "f30f",
    	"sym-cnd-s": "f310",
    	"sym-cnd": "f311",
    	"sym-cnn-s": "f312",
    	"sym-cnn": "f313",
    	"sym-cnx-s": "f314",
    	"sym-cnx": "f315",
    	"sym-cny-s": "f316",
    	"sym-cny": "f317",
    	"sym-cob-s": "f318",
    	"sym-cob": "f319",
    	"sym-cocos-s": "f31a",
    	"sym-cocos": "f31b",
    	"sym-comp-s": "f31c",
    	"sym-comp": "f31d",
    	"sym-cope-s": "f31e",
    	"sym-cope": "f31f",
    	"sym-cos-s": "f320",
    	"sym-cos": "f321",
    	"sym-cosm-s": "f322",
    	"sym-cosm": "f323",
    	"sym-coss-s": "f324",
    	"sym-coss": "f325",
    	"sym-coti-s": "f326",
    	"sym-coti": "f327",
    	"sym-cov-s": "f328",
    	"sym-cov": "f329",
    	"sym-cova-s": "f32a",
    	"sym-cova": "f32b",
    	"sym-cpt-s": "f32c",
    	"sym-cpt": "f32d",
    	"sym-cpx-s": "f32e",
    	"sym-cpx": "f32f",
    	"sym-cqt-s": "f330",
    	"sym-cqt": "f331",
    	"sym-cra-s": "f332",
    	"sym-cra": "f333",
    	"sym-crab-s": "f334",
    	"sym-crab": "f335",
    	"sym-crc-s": "f336",
    	"sym-crc": "f337",
    	"sym-cre-s": "f338",
    	"sym-cre": "f339",
    	"sym-cream-s": "f33a",
    	"sym-cream": "f33b",
    	"sym-cring-s": "f33c",
    	"sym-cring": "f33d",
    	"sym-cro-s": "f33e",
    	"sym-cro": "f33f",
    	"sym-crpt-s": "f340",
    	"sym-crpt": "f341",
    	"sym-cru-s": "f342",
    	"sym-cru": "f343",
    	"sym-crust-s": "f344",
    	"sym-crust": "f345",
    	"sym-crv-s": "f346",
    	"sym-crv": "f347",
    	"sym-crw-s": "f348",
    	"sym-crw": "f349",
    	"sym-csm-s": "f34a",
    	"sym-csm": "f34b",
    	"sym-csx-s": "f34c",
    	"sym-csx": "f34d",
    	"sym-ctc-s": "f34e",
    	"sym-ctc": "f34f",
    	"sym-ctk-s": "f350",
    	"sym-ctk": "f351",
    	"sym-ctsi-s": "f352",
    	"sym-ctsi": "f353",
    	"sym-ctxc-s": "f354",
    	"sym-ctxc": "f355",
    	"sym-cult-s": "f356",
    	"sym-cult": "f357",
    	"sym-cur-s": "f358",
    	"sym-cur": "f359",
    	"sym-cvc-s": "f35a",
    	"sym-cvc": "f35b",
    	"sym-cvcoin-s": "f35c",
    	"sym-cvcoin": "f35d",
    	"sym-cvnt-s": "f35e",
    	"sym-cvnt": "f35f",
    	"sym-cvp-s": "f360",
    	"sym-cvp": "f361",
    	"sym-cvt-s": "f362",
    	"sym-cvt": "f363",
    	"sym-cvx-s": "f364",
    	"sym-cvx": "f365",
    	"sym-cw-s": "f366",
    	"sym-cw": "f367",
    	"sym-cyc-s": "f368",
    	"sym-cyc": "f369",
    	"sym-dac-s": "f36a",
    	"sym-dac": "f36b",
    	"sym-dacs-s": "f36c",
    	"sym-dacs": "f36d",
    	"sym-dadi-s": "f36e",
    	"sym-dadi": "f36f",
    	"sym-dag-s": "f370",
    	"sym-dag": "f371",
    	"sym-dai-s": "f372",
    	"sym-dai": "f373",
    	"sym-dao-s": "f374",
    	"sym-dao": "f375",
    	"sym-dar-s": "f376",
    	"sym-dar": "f377",
    	"sym-dash-s": "f378",
    	"sym-dash": "f379",
    	"sym-dat-s": "f37a",
    	"sym-dat": "f37b",
    	"sym-data-s": "f37c",
    	"sym-data": "f37d",
    	"sym-datx-s": "f37e",
    	"sym-datx": "f37f",
    	"sym-dbc-s": "f380",
    	"sym-dbc": "f381",
    	"sym-dbet-s": "f382",
    	"sym-dbet": "f383",
    	"sym-dbix-s": "f384",
    	"sym-dbix": "f385",
    	"sym-dcn-s": "f386",
    	"sym-dcn": "f387",
    	"sym-dcr-s": "f388",
    	"sym-dcr": "f389",
    	"sym-dct-s": "f38a",
    	"sym-dct": "f38b",
    	"sym-ddd-s": "f38c",
    	"sym-ddd": "f38d",
    	"sym-dego-s": "f38e",
    	"sym-dego": "f38f",
    	"sym-dent-s": "f390",
    	"sym-dent": "f391",
    	"sym-dext-s": "f392",
    	"sym-dext": "f393",
    	"sym-dgb-s": "f394",
    	"sym-dgb": "f395",
    	"sym-dgd-s": "f396",
    	"sym-dgd": "f397",
    	"sym-dgtx-s": "f398",
    	"sym-dgtx": "f399",
    	"sym-dgx-s": "f39a",
    	"sym-dgx": "f39b",
    	"sym-dhx-s": "f39c",
    	"sym-dhx": "f39d",
    	"sym-dia-s": "f39e",
    	"sym-dia": "f39f",
    	"sym-dice-s": "f3a0",
    	"sym-dice": "f3a1",
    	"sym-dim-s": "f3a2",
    	"sym-dim": "f3a3",
    	"sym-dlt-s": "f3a4",
    	"sym-dlt": "f3a5",
    	"sym-dmd-s": "f3a6",
    	"sym-dmd": "f3a7",
    	"sym-dmt-s": "f3a8",
    	"sym-dmt": "f3a9",
    	"sym-dnt-s": "f3aa",
    	"sym-dnt": "f3ab",
    	"sym-dock-s": "f3ac",
    	"sym-dock": "f3ad",
    	"sym-dodo-s": "f3ae",
    	"sym-dodo": "f3af",
    	"sym-doge-s": "f3b0",
    	"sym-doge": "f3b1",
    	"sym-dose-s": "f3b2",
    	"sym-dose": "f3b3",
    	"sym-dot-s": "f3b4",
    	"sym-dot": "f3b5",
    	"sym-dpx-s": "f3b6",
    	"sym-dpx": "f3b7",
    	"sym-dpy-s": "f3b8",
    	"sym-dpy": "f3b9",
    	"sym-dream-s": "f3ba",
    	"sym-dream": "f3bb",
    	"sym-drep-s": "f3bc",
    	"sym-drep": "f3bd",
    	"sym-drg-s": "f3be",
    	"sym-drg": "f3bf",
    	"sym-drgn-s": "f3c0",
    	"sym-drgn": "f3c1",
    	"sym-drt-s": "f3c2",
    	"sym-drt": "f3c3",
    	"sym-dta-s": "f3c4",
    	"sym-dta": "f3c5",
    	"sym-dtb-s": "f3c6",
    	"sym-dtb": "f3c7",
    	"sym-dtr-s": "f3c8",
    	"sym-dtr": "f3c9",
    	"sym-dusk-s": "f3ca",
    	"sym-dusk": "f3cb",
    	"sym-dx-s": "f3cc",
    	"sym-dx": "f3cd",
    	"sym-dydx-s": "f3ce",
    	"sym-dydx": "f3cf",
    	"sym-dyn-s": "f3d0",
    	"sym-dyn": "f3d1",
    	"sym-easy": "f3d2",
    	"sym-ecom-s": "f3d3",
    	"sym-ecom": "f3d4",
    	"sym-edc-s": "f3d5",
    	"sym-edc": "f3d6",
    	"sym-edg-s": "f3d7",
    	"sym-edg": "f3d8",
    	"sym-edo-s": "f3d9",
    	"sym-edo": "f3da",
    	"sym-edp-s": "f3db",
    	"sym-edp": "f3dc",
    	"sym-edr-s": "f3dd",
    	"sym-edr": "f3de",
    	"sym-efi-s": "f3df",
    	"sym-efi": "f3e0",
    	"sym-egld-s": "f3e1",
    	"sym-egld": "f3e2",
    	"sym-egt-s": "f3e3",
    	"sym-egt": "f3e4",
    	"sym-ehr-s": "f3e5",
    	"sym-ehr": "f3e6",
    	"sym-eko-s": "f3e7",
    	"sym-eko": "f3e8",
    	"sym-ekt-s": "f3e9",
    	"sym-ekt": "f3ea",
    	"sym-ela-s": "f3eb",
    	"sym-ela": "f3ec",
    	"sym-elec-s": "f3ed",
    	"sym-elec": "f3ee",
    	"sym-elf-s": "f3ef",
    	"sym-elf": "f3f0",
    	"sym-em-s": "f3f1",
    	"sym-em": "f3f2",
    	"sym-emc-s": "f3f3",
    	"sym-emc": "f3f4",
    	"sym-emc2-s": "f3f5",
    	"sym-emc2": "f3f6",
    	"sym-eng-s": "f3f7",
    	"sym-eng": "f3f8",
    	"sym-enj-s": "f3f9",
    	"sym-enj": "f3fa",
    	"sym-ens-s": "f3fb",
    	"sym-ens": "f3fc",
    	"sym-eos-s": "f3fd",
    	"sym-eos": "f3fe",
    	"sym-eosdac-s": "f3ff",
    	"sym-eosdac": "f400",
    	"sym-eq-s": "f401",
    	"sym-eq": "f402",
    	"sym-erd-s": "f403",
    	"sym-erd": "f404",
    	"sym-ern-s": "f405",
    	"sym-ern": "f406",
    	"sym-es": "f407",
    	"sym-es-s": "f408",
    	"sym-esd-s": "f409",
    	"sym-esd": "f40a",
    	"sym-etc-s": "f40b",
    	"sym-etc": "f40c",
    	"sym-eth-s": "f40d",
    	"sym-eth": "f40e",
    	"sym-ethup-s": "f40f",
    	"sym-ethup": "f410",
    	"sym-ethw-s": "f411",
    	"sym-ethw": "f412",
    	"sym-etn-s": "f413",
    	"sym-etn": "f414",
    	"sym-etp-s": "f415",
    	"sym-etp": "f416",
    	"sym-eul-s": "f417",
    	"sym-eul": "f418",
    	"sym-eur-s": "f419",
    	"sym-eur": "f41a",
    	"sym-euroc-s": "f41b",
    	"sym-euroc": "f41c",
    	"sym-eurs-s": "f41d",
    	"sym-eurs": "f41e",
    	"sym-eurt-s": "f41f",
    	"sym-eurt": "f420",
    	"sym-evn-s": "f421",
    	"sym-evn": "f422",
    	"sym-evx-s": "f423",
    	"sym-evx": "f424",
    	"sym-ewt-s": "f425",
    	"sym-ewt": "f426",
    	"sym-exp-s": "f427",
    	"sym-exp": "f428",
    	"sym-exrd-s": "f429",
    	"sym-exrd": "f42a",
    	"sym-exy-s": "f42b",
    	"sym-exy": "f42c",
    	"sym-ez-s": "f42d",
    	"sym-ez": "f42e",
    	"sym-fair-s": "f42f",
    	"sym-fair": "f430",
    	"sym-farm-s": "f431",
    	"sym-farm": "f432",
    	"sym-fct-s": "f433",
    	"sym-fct": "f434",
    	"sym-fdz-s": "f435",
    	"sym-fdz": "f436",
    	"sym-fee-s": "f437",
    	"sym-fee": "f438",
    	"sym-fet-s": "f439",
    	"sym-fet": "f43a",
    	"sym-fida-s": "f43b",
    	"sym-fida": "f43c",
    	"sym-fil-s": "f43d",
    	"sym-fil": "f43e",
    	"sym-fio-s": "f43f",
    	"sym-fio": "f440",
    	"sym-firo-s": "f441",
    	"sym-firo": "f442",
    	"sym-fis-s": "f443",
    	"sym-fis": "f444",
    	"sym-fldc-s": "f445",
    	"sym-fldc": "f446",
    	"sym-flo-s": "f447",
    	"sym-flo": "f448",
    	"sym-floki-s": "f449",
    	"sym-floki": "f44a",
    	"sym-flow-s": "f44b",
    	"sym-flow": "f44c",
    	"sym-flr-s": "f44d",
    	"sym-flr": "f44e",
    	"sym-flux-s": "f44f",
    	"sym-flux": "f450",
    	"sym-fluz-s": "f451",
    	"sym-fluz": "f452",
    	"sym-fnb-s": "f453",
    	"sym-fnb": "f454",
    	"sym-foam-s": "f455",
    	"sym-foam": "f456",
    	"sym-for-s": "f457",
    	"sym-for": "f458",
    	"sym-forth-s": "f459",
    	"sym-forth": "f45a",
    	"sym-fota-s": "f45b",
    	"sym-fota": "f45c",
    	"sym-fox-s": "f45d",
    	"sym-fox": "f45e",
    	"sym-fpis-s": "f45f",
    	"sym-fpis": "f460",
    	"sym-frax-s": "f461",
    	"sym-frax": "f462",
    	"sym-front-s": "f463",
    	"sym-front": "f464",
    	"sym-fsn-s": "f465",
    	"sym-fsn": "f466",
    	"sym-ftc-s": "f467",
    	"sym-ftc": "f468",
    	"sym-fti-s": "f469",
    	"sym-fti": "f46a",
    	"sym-ftm-s": "f46b",
    	"sym-ftm": "f46c",
    	"sym-ftt-s": "f46d",
    	"sym-ftt": "f46e",
    	"sym-ftx-s": "f46f",
    	"sym-ftx": "f470",
    	"sym-fuel-s": "f471",
    	"sym-fuel": "f472",
    	"sym-fun-s": "f473",
    	"sym-fun": "f474",
    	"sym-fx-s": "f475",
    	"sym-fx": "f476",
    	"sym-fxc-s": "f477",
    	"sym-fxc": "f478",
    	"sym-fxs-s": "f479",
    	"sym-fxs": "f47a",
    	"sym-fxt-s": "f47b",
    	"sym-fxt": "f47c",
    	"sym-gal-s": "f47d",
    	"sym-gal": "f47e",
    	"sym-gala-s": "f47f",
    	"sym-gala": "f480",
    	"sym-game-s": "f481",
    	"sym-game": "f482",
    	"sym-gamee-s": "f483",
    	"sym-gamee": "f484",
    	"sym-gard-s": "f485",
    	"sym-gard": "f486",
    	"sym-gari-s": "f487",
    	"sym-gari": "f488",
    	"sym-gas-s": "f489",
    	"sym-gas": "f48a",
    	"sym-gbc-s": "f48b",
    	"sym-gbc": "f48c",
    	"sym-gbp-s": "f48d",
    	"sym-gbp": "f48e",
    	"sym-gbx-s": "f48f",
    	"sym-gbx": "f490",
    	"sym-gbyte-s": "f491",
    	"sym-gbyte": "f492",
    	"sym-gc-s": "f493",
    	"sym-gc": "f494",
    	"sym-gcc-s": "f495",
    	"sym-gcc": "f496",
    	"sym-ge-s": "f497",
    	"sym-ge": "f498",
    	"sym-geist-s": "f499",
    	"sym-geist": "f49a",
    	"sym-gen-s": "f49b",
    	"sym-gen": "f49c",
    	"sym-gene-s": "f49d",
    	"sym-gene": "f49e",
    	"sym-gens-s": "f49f",
    	"sym-gens": "f4a0",
    	"sym-get-s": "f4a1",
    	"sym-get": "f4a2",
    	"sym-ghst-s": "f4a3",
    	"sym-ghst": "f4a4",
    	"sym-glc-s": "f4a5",
    	"sym-glc": "f4a6",
    	"sym-gld-s": "f4a7",
    	"sym-gld": "f4a8",
    	"sym-glm-s": "f4a9",
    	"sym-glm": "f4aa",
    	"sym-glmr-s": "f4ab",
    	"sym-glmr": "f4ac",
    	"sym-gmat-s": "f4ad",
    	"sym-gmat": "f4ae",
    	"sym-gmt-s": "f4af",
    	"sym-gmt": "f4b0",
    	"sym-gmt2-s": "f4b1",
    	"sym-gmt2": "f4b2",
    	"sym-gmx-s": "f4b3",
    	"sym-gmx": "f4b4",
    	"sym-gno-s": "f4b5",
    	"sym-gno": "f4b6",
    	"sym-gnt-s": "f4b7",
    	"sym-gnt": "f4b8",
    	"sym-gnx-s": "f4b9",
    	"sym-gnx": "f4ba",
    	"sym-go-s": "f4bb",
    	"sym-go": "f4bc",
    	"sym-gods-s": "f4bd",
    	"sym-gods": "f4be",
    	"sym-goo-s": "f4bf",
    	"sym-goo": "f4c0",
    	"sym-got-s": "f4c1",
    	"sym-got": "f4c2",
    	"sym-grc-s": "f4c3",
    	"sym-grc": "f4c4",
    	"sym-grin-s": "f4c5",
    	"sym-grin": "f4c6",
    	"sym-grs-s": "f4c7",
    	"sym-grs": "f4c8",
    	"sym-grt-s": "f4c9",
    	"sym-grt": "f4ca",
    	"sym-gsc-s": "f4cb",
    	"sym-gsc": "f4cc",
    	"sym-gst-s": "f4cd",
    	"sym-gst": "f4ce",
    	"sym-gt-s": "f4cf",
    	"sym-gt": "f4d0",
    	"sym-gtc-s": "f4d1",
    	"sym-gtc": "f4d2",
    	"sym-gtc2-s": "f4d3",
    	"sym-gtc2": "f4d4",
    	"sym-gto-s": "f4d5",
    	"sym-gto": "f4d6",
    	"sym-gup-s": "f4d7",
    	"sym-gup": "f4d8",
    	"sym-gusd-s": "f4d9",
    	"sym-gusd": "f4da",
    	"sym-gvt-s": "f4db",
    	"sym-gvt": "f4dc",
    	"sym-gxc-s": "f4dd",
    	"sym-gxc": "f4de",
    	"sym-gxs-s": "f4df",
    	"sym-gxs": "f4e0",
    	"sym-hard-s": "f4e1",
    	"sym-hard": "f4e2",
    	"sym-hbar-s": "f4e3",
    	"sym-hbar": "f4e4",
    	"sym-hc-s": "f4e5",
    	"sym-hc": "f4e6",
    	"sym-hdx-s": "f4e7",
    	"sym-hdx": "f4e8",
    	"sym-hedg-s": "f4e9",
    	"sym-hedg": "f4ea",
    	"sym-hegic-s": "f4eb",
    	"sym-hegic": "f4ec",
    	"sym-hex-s": "f4ed",
    	"sym-hex": "f4ee",
    	"sym-hft-s": "f4ef",
    	"sym-hft": "f4f0",
    	"sym-hg-s": "f4f1",
    	"sym-hg": "f4f2",
    	"sym-hgs-s": "f4f3",
    	"sym-hgs": "f4f4",
    	"sym-hh-s": "f4f5",
    	"sym-hh": "f4f6",
    	"sym-high-s": "f4f7",
    	"sym-high": "f4f8",
    	"sym-hit-s": "f4f9",
    	"sym-hit": "f4fa",
    	"sym-hive-s": "f4fb",
    	"sym-hive": "f4fc",
    	"sym-hkd-s": "f4fd",
    	"sym-hkd": "f4fe",
    	"sym-hko-s": "f4ff",
    	"sym-hko": "f500",
    	"sym-hmq-s": "f501",
    	"sym-hmq": "f502",
    	"sym-hns-s": "f503",
    	"sym-hns": "f504",
    	"sym-ho-s": "f505",
    	"sym-ho": "f506",
    	"sym-hopr-s": "f507",
    	"sym-hopr": "f508",
    	"sym-hot-s": "f509",
    	"sym-hot": "f50a",
    	"sym-hp-s": "f50b",
    	"sym-hp": "f50c",
    	"sym-hpb-s": "f50d",
    	"sym-hpb": "f50e",
    	"sym-hpc-s": "f50f",
    	"sym-hpc": "f510",
    	"sym-hpt-s": "f511",
    	"sym-hpt": "f512",
    	"sym-hrc-s": "f513",
    	"sym-hrc": "f514",
    	"sym-hsc-s": "f515",
    	"sym-hsc": "f516",
    	"sym-hsr-s": "f517",
    	"sym-hsr": "f518",
    	"sym-hst-s": "f519",
    	"sym-hst": "f51a",
    	"sym-ht-s": "f51b",
    	"sym-ht": "f51c",
    	"sym-html-s": "f51d",
    	"sym-html": "f51e",
    	"sym-htt-s": "f51f",
    	"sym-htt": "f520",
    	"sym-huc-s": "f521",
    	"sym-huc": "f522",
    	"sym-hunt-s": "f523",
    	"sym-hunt": "f524",
    	"sym-hvn-s": "f525",
    	"sym-hvn": "f526",
    	"sym-hxro-s": "f527",
    	"sym-hxro": "f528",
    	"sym-hyc-s": "f529",
    	"sym-hyc": "f52a",
    	"sym-hydra-s": "f52b",
    	"sym-hydra": "f52c",
    	"sym-hydro-s": "f52d",
    	"sym-hydro": "f52e",
    	"sym-icn-s": "f52f",
    	"sym-icn": "f530",
    	"sym-icos-s": "f531",
    	"sym-icos": "f532",
    	"sym-icp-s": "f533",
    	"sym-icp": "f534",
    	"sym-icx-s": "f535",
    	"sym-icx": "f536",
    	"sym-idex-s": "f537",
    	"sym-idex": "f538",
    	"sym-idh-s": "f539",
    	"sym-idh": "f53a",
    	"sym-idr-s": "f53b",
    	"sym-idr": "f53c",
    	"sym-ift-s": "f53d",
    	"sym-ift": "f53e",
    	"sym-ignis-s": "f53f",
    	"sym-ignis": "f540",
    	"sym-ihf-s": "f541",
    	"sym-ihf": "f542",
    	"sym-iht-s": "f543",
    	"sym-iht": "f544",
    	"sym-ilc-s": "f545",
    	"sym-ilc": "f546",
    	"sym-ilv-s": "f547",
    	"sym-ilv": "f548",
    	"sym-imx-s": "f549",
    	"sym-imx": "f54a",
    	"sym-incnt-s": "f54b",
    	"sym-incnt": "f54c",
    	"sym-ind-s": "f54d",
    	"sym-ind": "f54e",
    	"sym-indi-s": "f54f",
    	"sym-indi": "f550",
    	"sym-inj-s": "f551",
    	"sym-inj": "f552",
    	"sym-ink-s": "f553",
    	"sym-ink": "f554",
    	"sym-inr-s": "f555",
    	"sym-inr": "f556",
    	"sym-ins-s": "f557",
    	"sym-ins": "f558",
    	"sym-int-s": "f559",
    	"sym-int": "f55a",
    	"sym-intr-s": "f55b",
    	"sym-intr": "f55c",
    	"sym-ioc-s": "f55d",
    	"sym-ioc": "f55e",
    	"sym-ion-s": "f55f",
    	"sym-ion": "f560",
    	"sym-iost-s": "f561",
    	"sym-iost": "f562",
    	"sym-iot-s": "f563",
    	"sym-iot": "f564",
    	"sym-iotx-s": "f565",
    	"sym-iotx": "f566",
    	"sym-iq-s": "f567",
    	"sym-iq": "f568",
    	"sym-iris-s": "f569",
    	"sym-iris": "f56a",
    	"sym-itc-s": "f56b",
    	"sym-itc": "f56c",
    	"sym-ivy-s": "f56d",
    	"sym-ivy": "f56e",
    	"sym-ixt-s": "f56f",
    	"sym-ixt": "f570",
    	"sym-jasmy-s": "f571",
    	"sym-jasmy": "f572",
    	"sym-jnt-s": "f573",
    	"sym-jnt": "f574",
    	"sym-joe-s": "f575",
    	"sym-joe": "f576",
    	"sym-jpeg-s": "f577",
    	"sym-jpeg": "f578",
    	"sym-jpy-s": "f579",
    	"sym-jpy": "f57a",
    	"sym-jst-s": "f57b",
    	"sym-jst": "f57c",
    	"sym-juno-s": "f57d",
    	"sym-juno": "f57e",
    	"sym-just-s": "f57f",
    	"sym-just": "f580",
    	"sym-juv-s": "f581",
    	"sym-juv": "f582",
    	"sym-kan-s": "f583",
    	"sym-kan": "f584",
    	"sym-kapex-s": "f585",
    	"sym-kapex": "f586",
    	"sym-kar-s": "f587",
    	"sym-kar": "f588",
    	"sym-kava-s": "f589",
    	"sym-kava": "f58a",
    	"sym-kbc-s": "f58b",
    	"sym-kbc": "f58c",
    	"sym-kcash-s": "f58d",
    	"sym-kcash": "f58e",
    	"sym-kda-s": "f58f",
    	"sym-kda": "f590",
    	"sym-keep-s": "f591",
    	"sym-keep": "f592",
    	"sym-key-s": "f593",
    	"sym-key": "f594",
    	"sym-kick-s": "f595",
    	"sym-kick": "f596",
    	"sym-kilt-s": "f597",
    	"sym-kilt": "f598",
    	"sym-kin-s": "f599",
    	"sym-kin": "f59a",
    	"sym-kint-s": "f59b",
    	"sym-kint": "f59c",
    	"sym-klay-s": "f59d",
    	"sym-klay": "f59e",
    	"sym-kma-s": "f59f",
    	"sym-kma": "f5a0",
    	"sym-kmd-s": "f5a1",
    	"sym-kmd": "f5a2",
    	"sym-knc-s": "f5a3",
    	"sym-knc": "f5a4",
    	"sym-kore-s": "f5a5",
    	"sym-kore": "f5a6",
    	"sym-kp3r-s": "f5a7",
    	"sym-kp3r": "f5a8",
    	"sym-krm-s": "f5a9",
    	"sym-krm": "f5aa",
    	"sym-krw-s": "f5ab",
    	"sym-krw": "f5ac",
    	"sym-ksm-s": "f5ad",
    	"sym-ksm": "f5ae",
    	"sym-ksx-s": "f5af",
    	"sym-ksx": "f5b0",
    	"sym-kyl-s": "f5b1",
    	"sym-kyl": "f5b2",
    	"sym-la-s": "f5b3",
    	"sym-la": "f5b4",
    	"sym-lak-s": "f5b5",
    	"sym-lak": "f5b6",
    	"sym-lamb-s": "f5b7",
    	"sym-lamb": "f5b8",
    	"sym-latx-s": "f5b9",
    	"sym-latx": "f5ba",
    	"sym-layr-s": "f5bb",
    	"sym-layr": "f5bc",
    	"sym-lba-s": "f5bd",
    	"sym-lba": "f5be",
    	"sym-lbc-s": "f5bf",
    	"sym-lbc": "f5c0",
    	"sym-lcc-s": "f5c1",
    	"sym-lcc": "f5c2",
    	"sym-lcx-s": "f5c3",
    	"sym-lcx": "f5c4",
    	"sym-ldo-s": "f5c5",
    	"sym-ldo": "f5c6",
    	"sym-lend-s": "f5c7",
    	"sym-lend": "f5c8",
    	"sym-leo-s": "f5c9",
    	"sym-leo": "f5ca",
    	"sym-leoc-s": "f5cb",
    	"sym-leoc": "f5cc",
    	"sym-let-s": "f5cd",
    	"sym-let": "f5ce",
    	"sym-life-s": "f5cf",
    	"sym-life": "f5d0",
    	"sym-lina-s": "f5d1",
    	"sym-lina": "f5d2",
    	"sym-link-s": "f5d3",
    	"sym-link": "f5d4",
    	"sym-lit-s": "f5d5",
    	"sym-lit": "f5d6",
    	"sym-lmc-s": "f5d7",
    	"sym-lmc": "f5d8",
    	"sym-lml-s": "f5d9",
    	"sym-lml": "f5da",
    	"sym-lmwr-s": "f5db",
    	"sym-lmwr": "f5dc",
    	"sym-lnc-s": "f5dd",
    	"sym-lnc": "f5de",
    	"sym-lnd-s": "f5df",
    	"sym-lnd": "f5e0",
    	"sym-loc-s": "f5e1",
    	"sym-loc": "f5e2",
    	"sym-loka-s": "f5e3",
    	"sym-loka": "f5e4",
    	"sym-looks-s": "f5e5",
    	"sym-looks": "f5e6",
    	"sym-loom-s": "f5e7",
    	"sym-loom": "f5e8",
    	"sym-lpt-s": "f5e9",
    	"sym-lpt": "f5ea",
    	"sym-lqty-s": "f5eb",
    	"sym-lqty": "f5ec",
    	"sym-lrc-s": "f5ed",
    	"sym-lrc": "f5ee",
    	"sym-lrn-s": "f5ef",
    	"sym-lrn": "f5f0",
    	"sym-lseth-s": "f5f1",
    	"sym-lseth": "f5f2",
    	"sym-lsk-s": "f5f3",
    	"sym-lsk": "f5f4",
    	"sym-ltc-s": "f5f5",
    	"sym-ltc": "f5f6",
    	"sym-lto-s": "f5f7",
    	"sym-lto": "f5f8",
    	"sym-lun-s": "f5f9",
    	"sym-lun": "f5fa",
    	"sym-luna-s": "f5fb",
    	"sym-luna": "f5fc",
    	"sym-luna2-s": "f5fd",
    	"sym-luna2": "f5fe",
    	"sym-lxt-s": "f5ff",
    	"sym-lxt": "f600",
    	"sym-lym-s": "f601",
    	"sym-lym": "f602",
    	"sym-m2k-s": "f603",
    	"sym-m2k": "f604",
    	"sym-ma-s": "f605",
    	"sym-ma": "f606",
    	"sym-magic-s": "f607",
    	"sym-magic": "f608",
    	"sym-maid-s": "f609",
    	"sym-maid": "f60a",
    	"sym-man-s": "f60b",
    	"sym-man": "f60c",
    	"sym-mana-s": "f60d",
    	"sym-mana": "f60e",
    	"sym-maps-s": "f60f",
    	"sym-maps": "f610",
    	"sym-mask-s": "f611",
    	"sym-mask": "f612",
    	"sym-mass-s": "f613",
    	"sym-mass": "f614",
    	"sym-math-s": "f615",
    	"sym-math": "f616",
    	"sym-matic-s": "f617",
    	"sym-matic": "f618",
    	"sym-mbl-s": "f619",
    	"sym-mbl": "f61a",
    	"sym-mbt-s": "f61b",
    	"sym-mbt": "f61c",
    	"sym-mc-s": "f61d",
    	"sym-mc": "f61e",
    	"sym-mco-s": "f61f",
    	"sym-mco": "f620",
    	"sym-mda-s": "f621",
    	"sym-mda": "f622",
    	"sym-mds-s": "f623",
    	"sym-mds": "f624",
    	"sym-mdt-s": "f625",
    	"sym-mdt": "f626",
    	"sym-mdx-s": "f627",
    	"sym-mdx": "f628",
    	"sym-med-s": "f629",
    	"sym-med": "f62a",
    	"sym-mer-s": "f62b",
    	"sym-mer": "f62c",
    	"sym-mes-s": "f62d",
    	"sym-mes": "f62e",
    	"sym-met-s": "f62f",
    	"sym-met": "f630",
    	"sym-meta-s": "f631",
    	"sym-meta": "f632",
    	"sym-metis-s": "f633",
    	"sym-metis": "f634",
    	"sym-mft-s": "f635",
    	"sym-mft": "f636",
    	"sym-mgc-s": "f637",
    	"sym-mgc": "f638",
    	"sym-mgo-s": "f639",
    	"sym-mgo": "f63a",
    	"sym-mhc-s": "f63b",
    	"sym-mhc": "f63c",
    	"sym-mina-s": "f63d",
    	"sym-mina": "f63e",
    	"sym-mir-s": "f63f",
    	"sym-mir": "f640",
    	"sym-mith-s": "f641",
    	"sym-mith": "f642",
    	"sym-mitx-s": "f643",
    	"sym-mitx": "f644",
    	"sym-mjp-s": "f645",
    	"sym-mjp": "f646",
    	"sym-mkr-s": "f647",
    	"sym-mkr": "f648",
    	"sym-mln-s": "f649",
    	"sym-mln": "f64a",
    	"sym-mngo-s": "f64b",
    	"sym-mngo": "f64c",
    	"sym-mnx-s": "f64d",
    	"sym-mnx": "f64e",
    	"sym-moac-s": "f64f",
    	"sym-moac": "f650",
    	"sym-mob-s": "f651",
    	"sym-mob": "f652",
    	"sym-mobi-s": "f653",
    	"sym-mobi": "f654",
    	"sym-moc-s": "f655",
    	"sym-moc": "f656",
    	"sym-mod-s": "f657",
    	"sym-mod": "f658",
    	"sym-mona-s": "f659",
    	"sym-mona": "f65a",
    	"sym-moon-s": "f65b",
    	"sym-moon": "f65c",
    	"sym-morph-s": "f65d",
    	"sym-morph": "f65e",
    	"sym-movr-s": "f65f",
    	"sym-movr": "f660",
    	"sym-mpl-s": "f661",
    	"sym-mpl": "f662",
    	"sym-mrk-s": "f663",
    	"sym-mrk": "f664",
    	"sym-msol-s": "f665",
    	"sym-msol": "f666",
    	"sym-msp-s": "f667",
    	"sym-msp": "f668",
    	"sym-mta-s": "f669",
    	"sym-mta": "f66a",
    	"sym-mtc-s": "f66b",
    	"sym-mtc": "f66c",
    	"sym-mth-s": "f66d",
    	"sym-mth": "f66e",
    	"sym-mtl-s": "f66f",
    	"sym-mtl": "f670",
    	"sym-mtn-s": "f671",
    	"sym-mtn": "f672",
    	"sym-mtx-s": "f673",
    	"sym-mtx": "f674",
    	"sym-mue-s": "f675",
    	"sym-mue": "f676",
    	"sym-multi-s": "f677",
    	"sym-multi": "f678",
    	"sym-mv-s": "f679",
    	"sym-mv": "f67a",
    	"sym-mx-s": "f67b",
    	"sym-mx": "f67c",
    	"sym-mxc-s": "f67d",
    	"sym-mxc": "f67e",
    	"sym-mxm-s": "f67f",
    	"sym-mxm": "f680",
    	"sym-mxn-s": "f681",
    	"sym-mxn": "f682",
    	"sym-myr-s": "f683",
    	"sym-myr": "f684",
    	"sym-n9l-s": "f685",
    	"sym-n9l": "f686",
    	"sym-nanj-s": "f687",
    	"sym-nanj": "f688",
    	"sym-nano-s": "f689",
    	"sym-nano": "f68a",
    	"sym-nas-s": "f68b",
    	"sym-nas": "f68c",
    	"sym-naut-s": "f68d",
    	"sym-naut": "f68e",
    	"sym-nav-s": "f68f",
    	"sym-nav": "f690",
    	"sym-ncash-s": "f691",
    	"sym-ncash": "f692",
    	"sym-nct-s": "f693",
    	"sym-nct": "f694",
    	"sym-near-s": "f695",
    	"sym-near": "f696",
    	"sym-nebl-s": "f697",
    	"sym-nebl": "f698",
    	"sym-nec-s": "f699",
    	"sym-nec": "f69a",
    	"sym-neo-s": "f69b",
    	"sym-neo": "f69c",
    	"sym-neos-s": "f69d",
    	"sym-neos": "f69e",
    	"sym-nest-s": "f69f",
    	"sym-nest": "f6a0",
    	"sym-neu-s": "f6a1",
    	"sym-neu": "f6a2",
    	"sym-new-s": "f6a3",
    	"sym-new": "f6a4",
    	"sym-nexo-s": "f6a5",
    	"sym-nexo": "f6a6",
    	"sym-nft-s": "f6a7",
    	"sym-nft": "f6a8",
    	"sym-ng-s": "f6a9",
    	"sym-ng": "f6aa",
    	"sym-ngc-s": "f6ab",
    	"sym-ngc": "f6ac",
    	"sym-ngn-s": "f6ad",
    	"sym-ngn": "f6ae",
    	"sym-nim-s": "f6af",
    	"sym-nim": "f6b0",
    	"sym-niy-s": "f6b1",
    	"sym-niy": "f6b2",
    	"sym-nkd-s": "f6b3",
    	"sym-nkd": "f6b4",
    	"sym-nkn-s": "f6b5",
    	"sym-nkn": "f6b6",
    	"sym-nlc2-s": "f6b7",
    	"sym-nlc2": "f6b8",
    	"sym-nlg-s": "f6b9",
    	"sym-nlg": "f6ba",
    	"sym-nmc-s": "f6bb",
    	"sym-nmc": "f6bc",
    	"sym-nmr-s": "f6bd",
    	"sym-nmr": "f6be",
    	"sym-nn-s": "f6bf",
    	"sym-nn": "f6c0",
    	"sym-noah-s": "f6c1",
    	"sym-noah": "f6c2",
    	"sym-nodl-s": "f6c3",
    	"sym-nodl": "f6c4",
    	"sym-note-s": "f6c5",
    	"sym-note": "f6c6",
    	"sym-npg-s": "f6c7",
    	"sym-npg": "f6c8",
    	"sym-nplc-s": "f6c9",
    	"sym-nplc": "f6ca",
    	"sym-npxs-s": "f6cb",
    	"sym-npxs": "f6cc",
    	"sym-nq-s": "f6cd",
    	"sym-nq": "f6ce",
    	"sym-nrg-s": "f6cf",
    	"sym-nrg": "f6d0",
    	"sym-ntk-s": "f6d1",
    	"sym-ntk": "f6d2",
    	"sym-nu-s": "f6d3",
    	"sym-nu": "f6d4",
    	"sym-nuls-s": "f6d5",
    	"sym-nuls": "f6d6",
    	"sym-nvc-s": "f6d7",
    	"sym-nvc": "f6d8",
    	"sym-nxc-s": "f6d9",
    	"sym-nxc": "f6da",
    	"sym-nxs-s": "f6db",
    	"sym-nxs": "f6dc",
    	"sym-nxt-s": "f6dd",
    	"sym-nxt": "f6de",
    	"sym-nym-s": "f6df",
    	"sym-nym": "f6e0",
    	"sym-o-s": "f6e1",
    	"sym-o": "f6e2",
    	"sym-oak-s": "f6e3",
    	"sym-oak": "f6e4",
    	"sym-oax-s": "f6e5",
    	"sym-oax": "f6e6",
    	"sym-ocean-s": "f6e7",
    	"sym-ocean": "f6e8",
    	"sym-ocn-s": "f6e9",
    	"sym-ocn": "f6ea",
    	"sym-ode-s": "f6eb",
    	"sym-ode": "f6ec",
    	"sym-ogn-s": "f6ed",
    	"sym-ogn": "f6ee",
    	"sym-ogo-s": "f6ef",
    	"sym-ogo": "f6f0",
    	"sym-ok-s": "f6f1",
    	"sym-ok": "f6f2",
    	"sym-okb-s": "f6f3",
    	"sym-okb": "f6f4",
    	"sym-om-s": "f6f5",
    	"sym-om": "f6f6",
    	"sym-omg-s": "f6f7",
    	"sym-omg": "f6f8",
    	"sym-omni-s": "f6f9",
    	"sym-omni": "f6fa",
    	"sym-one-s": "f6fb",
    	"sym-one": "f6fc",
    	"sym-ong-s": "f6fd",
    	"sym-ong": "f6fe",
    	"sym-onot-s": "f6ff",
    	"sym-onot": "f700",
    	"sym-ont-s": "f701",
    	"sym-ont": "f702",
    	"sym-ooki-s": "f703",
    	"sym-ooki": "f704",
    	"sym-op-s": "f705",
    	"sym-op": "f706",
    	"sym-orbs-s": "f707",
    	"sym-orbs": "f708",
    	"sym-orca-s": "f709",
    	"sym-orca": "f70a",
    	"sym-orme-s": "f70b",
    	"sym-orme": "f70c",
    	"sym-orn-s": "f70d",
    	"sym-orn": "f70e",
    	"sym-ors-s": "f70f",
    	"sym-ors": "f710",
    	"sym-osmo-s": "f711",
    	"sym-osmo": "f712",
    	"sym-ost-s": "f713",
    	"sym-ost": "f714",
    	"sym-otn-s": "f715",
    	"sym-otn": "f716",
    	"sym-oxt-s": "f717",
    	"sym-oxt": "f718",
    	"sym-oxy-s": "f719",
    	"sym-oxy": "f71a",
    	"sym-pai-s": "f71b",
    	"sym-pai": "f71c",
    	"sym-pal-s": "f71d",
    	"sym-pal": "f71e",
    	"sym-paper-s": "f71f",
    	"sym-paper": "f720",
    	"sym-para-s": "f721",
    	"sym-para": "f722",
    	"sym-part-s": "f723",
    	"sym-part": "f724",
    	"sym-pasc-s": "f725",
    	"sym-pasc": "f726",
    	"sym-pat-s": "f727",
    	"sym-pat": "f728",
    	"sym-pax-s": "f729",
    	"sym-pax": "f72a",
    	"sym-paxg-s": "f72b",
    	"sym-paxg": "f72c",
    	"sym-pay-s": "f72d",
    	"sym-pay": "f72e",
    	"sym-pbt-s": "f72f",
    	"sym-pbt": "f730",
    	"sym-pcl-s": "f731",
    	"sym-pcl": "f732",
    	"sym-pcx-s": "f733",
    	"sym-pcx": "f734",
    	"sym-pdex-s": "f735",
    	"sym-pdex": "f736",
    	"sym-people-s": "f737",
    	"sym-people": "f738",
    	"sym-perl-s": "f739",
    	"sym-perl": "f73a",
    	"sym-perp-s": "f73b",
    	"sym-perp": "f73c",
    	"sym-pha-s": "f73d",
    	"sym-pha": "f73e",
    	"sym-phb-s": "f73f",
    	"sym-phb": "f740",
    	"sym-php-s": "f741",
    	"sym-php": "f742",
    	"sym-phx-s": "f743",
    	"sym-phx": "f744",
    	"sym-pi-s": "f745",
    	"sym-pi": "f746",
    	"sym-pica-s": "f747",
    	"sym-pica": "f748",
    	"sym-pink-s": "f749",
    	"sym-pink": "f74a",
    	"sym-pivx-s": "f74b",
    	"sym-pivx": "f74c",
    	"sym-pkt-s": "f74d",
    	"sym-pkt": "f74e",
    	"sym-pl-s": "f74f",
    	"sym-pl": "f750",
    	"sym-pla-s": "f751",
    	"sym-pla": "f752",
    	"sym-plbt-s": "f753",
    	"sym-plbt": "f754",
    	"sym-plm-s": "f755",
    	"sym-plm": "f756",
    	"sym-pln-s": "f757",
    	"sym-pln": "f758",
    	"sym-plr-s": "f759",
    	"sym-plr": "f75a",
    	"sym-ply-s": "f75b",
    	"sym-ply": "f75c",
    	"sym-pma-s": "f75d",
    	"sym-pma": "f75e",
    	"sym-png-s": "f75f",
    	"sym-png": "f760",
    	"sym-pnt-s": "f761",
    	"sym-pnt": "f762",
    	"sym-poa-s": "f763",
    	"sym-poa": "f764",
    	"sym-poe-s": "f765",
    	"sym-poe": "f766",
    	"sym-polis-s": "f767",
    	"sym-polis": "f768",
    	"sym-pols-s": "f769",
    	"sym-pols": "f76a",
    	"sym-poly-s": "f76b",
    	"sym-poly": "f76c",
    	"sym-pond-s": "f76d",
    	"sym-pond": "f76e",
    	"sym-pot-s": "f76f",
    	"sym-pot": "f770",
    	"sym-powr-s": "f771",
    	"sym-powr": "f772",
    	"sym-ppc-s": "f773",
    	"sym-ppc": "f774",
    	"sym-ppt-s": "f775",
    	"sym-ppt": "f776",
    	"sym-pra-s": "f777",
    	"sym-pra": "f778",
    	"sym-pre-s": "f779",
    	"sym-pre": "f77a",
    	"sym-prg-s": "f77b",
    	"sym-prg": "f77c",
    	"sym-pro-s": "f77d",
    	"sym-pro": "f77e",
    	"sym-prq-s": "f77f",
    	"sym-prq": "f780",
    	"sym-pst-s": "f781",
    	"sym-pst": "f782",
    	"sym-pstake-s": "f783",
    	"sym-pstake": "f784",
    	"sym-pton-s": "f785",
    	"sym-pton": "f786",
    	"sym-pundix-s": "f787",
    	"sym-pundix": "f788",
    	"sym-pvt-s": "f789",
    	"sym-pvt": "f78a",
    	"sym-pxg-s": "f78b",
    	"sym-pxg": "f78c",
    	"sym-pyr-s": "f78d",
    	"sym-pyr": "f78e",
    	"sym-qash-s": "f78f",
    	"sym-qash": "f790",
    	"sym-qau-s": "f791",
    	"sym-qau": "f792",
    	"sym-qc-s": "f793",
    	"sym-qc": "f794",
    	"sym-qi-s": "f795",
    	"sym-qi": "f796",
    	"sym-qi2-s": "f797",
    	"sym-qi2": "f798",
    	"sym-qkc-s": "f799",
    	"sym-qkc": "f79a",
    	"sym-qlc-s": "f79b",
    	"sym-qlc": "f79c",
    	"sym-qnt-s": "f79d",
    	"sym-qnt": "f79e",
    	"sym-qntu-s": "f79f",
    	"sym-qntu": "f7a0",
    	"sym-qo-s": "f7a1",
    	"sym-qo": "f7a2",
    	"sym-qrdo-s": "f7a3",
    	"sym-qrdo": "f7a4",
    	"sym-qrl-s": "f7a5",
    	"sym-qrl": "f7a6",
    	"sym-qsp-s": "f7a7",
    	"sym-qsp": "f7a8",
    	"sym-qtum-s": "f7a9",
    	"sym-qtum": "f7aa",
    	"sym-quick-s": "f7ab",
    	"sym-quick": "f7ac",
    	"sym-qun-s": "f7ad",
    	"sym-qun": "f7ae",
    	"sym-r-s": "f7af",
    	"sym-r": "f7b0",
    	"sym-rad-s": "f7b1",
    	"sym-rad": "f7b2",
    	"sym-radar-s": "f7b3",
    	"sym-radar": "f7b4",
    	"sym-rads-s": "f7b5",
    	"sym-rads": "f7b6",
    	"sym-ramp-s": "f7b7",
    	"sym-ramp": "f7b8",
    	"sym-rare-s": "f7b9",
    	"sym-rare": "f7ba",
    	"sym-rari-s": "f7bb",
    	"sym-rari": "f7bc",
    	"sym-rating-s": "f7bd",
    	"sym-rating": "f7be",
    	"sym-ray-s": "f7bf",
    	"sym-ray": "f7c0",
    	"sym-rb-s": "f7c1",
    	"sym-rb": "f7c2",
    	"sym-rbc-s": "f7c3",
    	"sym-rbc": "f7c4",
    	"sym-rblx-s": "f7c5",
    	"sym-rblx": "f7c6",
    	"sym-rbn-s": "f7c7",
    	"sym-rbn": "f7c8",
    	"sym-rbtc-s": "f7c9",
    	"sym-rbtc": "f7ca",
    	"sym-rby-s": "f7cb",
    	"sym-rby": "f7cc",
    	"sym-rcn-s": "f7cd",
    	"sym-rcn": "f7ce",
    	"sym-rdd-s": "f7cf",
    	"sym-rdd": "f7d0",
    	"sym-rdn-s": "f7d1",
    	"sym-rdn": "f7d2",
    	"sym-real-s": "f7d3",
    	"sym-real": "f7d4",
    	"sym-reef-s": "f7d5",
    	"sym-reef": "f7d6",
    	"sym-rem-s": "f7d7",
    	"sym-rem": "f7d8",
    	"sym-ren-s": "f7d9",
    	"sym-ren": "f7da",
    	"sym-rep-s": "f7db",
    	"sym-rep": "f7dc",
    	"sym-repv2-s": "f7dd",
    	"sym-repv2": "f7de",
    	"sym-req-s": "f7df",
    	"sym-req": "f7e0",
    	"sym-rev-s": "f7e1",
    	"sym-rev": "f7e2",
    	"sym-revv-s": "f7e3",
    	"sym-revv": "f7e4",
    	"sym-rfox-s": "f7e5",
    	"sym-rfox": "f7e6",
    	"sym-rfr-s": "f7e7",
    	"sym-rfr": "f7e8",
    	"sym-ric-s": "f7e9",
    	"sym-ric": "f7ea",
    	"sym-rif-s": "f7eb",
    	"sym-rif": "f7ec",
    	"sym-ring-s": "f7ed",
    	"sym-ring": "f7ee",
    	"sym-rlc-s": "f7ef",
    	"sym-rlc": "f7f0",
    	"sym-rly-s": "f7f1",
    	"sym-rly": "f7f2",
    	"sym-rmrk-s": "f7f3",
    	"sym-rmrk": "f7f4",
    	"sym-rndr-s": "f7f5",
    	"sym-rndr": "f7f6",
    	"sym-rntb-s": "f7f7",
    	"sym-rntb": "f7f8",
    	"sym-ron-s": "f7f9",
    	"sym-ron": "f7fa",
    	"sym-rook-s": "f7fb",
    	"sym-rook": "f7fc",
    	"sym-rose-s": "f7fd",
    	"sym-rose": "f7fe",
    	"sym-rox-s": "f7ff",
    	"sym-rox": "f800",
    	"sym-rp-s": "f801",
    	"sym-rp": "f802",
    	"sym-rpl-s": "f803",
    	"sym-rpl": "f804",
    	"sym-rpx-s": "f805",
    	"sym-rpx": "f806",
    	"sym-rsr-s": "f807",
    	"sym-rsr": "f808",
    	"sym-rsv-s": "f809",
    	"sym-rsv": "f80a",
    	"sym-rty-s": "f80b",
    	"sym-rty": "f80c",
    	"sym-rub-s": "f80d",
    	"sym-rub": "f80e",
    	"sym-ruff-s": "f80f",
    	"sym-ruff": "f810",
    	"sym-rune-s": "f811",
    	"sym-rune": "f812",
    	"sym-rvn-s": "f813",
    	"sym-rvn": "f814",
    	"sym-rvr-s": "f815",
    	"sym-rvr": "f816",
    	"sym-rvt-s": "f817",
    	"sym-rvt": "f818",
    	"sym-sai-s": "f819",
    	"sym-sai": "f81a",
    	"sym-salt-s": "f81b",
    	"sym-salt": "f81c",
    	"sym-samo-s": "f81d",
    	"sym-samo": "f81e",
    	"sym-san-s": "f81f",
    	"sym-san": "f820",
    	"sym-sand-s": "f821",
    	"sym-sand": "f822",
    	"sym-sat-s": "f823",
    	"sym-sat": "f824",
    	"sym-sbd-s": "f825",
    	"sym-sbd": "f826",
    	"sym-sbr-s": "f827",
    	"sym-sbr": "f828",
    	"sym-sc-s": "f829",
    	"sym-sc": "f82a",
    	"sym-scc-s": "f82b",
    	"sym-scc": "f82c",
    	"sym-scrt-s": "f82d",
    	"sym-scrt": "f82e",
    	"sym-sdc-s": "f82f",
    	"sym-sdc": "f830",
    	"sym-sdn-s": "f831",
    	"sym-sdn": "f832",
    	"sym-seele-s": "f833",
    	"sym-seele": "f834",
    	"sym-sek-s": "f835",
    	"sym-sek": "f836",
    	"sym-sen-s": "f837",
    	"sym-sen": "f838",
    	"sym-sent-s": "f839",
    	"sym-sent": "f83a",
    	"sym-sero-s": "f83b",
    	"sym-sero": "f83c",
    	"sym-sexc-s": "f83d",
    	"sym-sexc": "f83e",
    	"sym-sfp-s": "f83f",
    	"sym-sfp": "f840",
    	"sym-sgb-s": "f841",
    	"sym-sgb": "f842",
    	"sym-sgc-s": "f843",
    	"sym-sgc": "f844",
    	"sym-sgd-s": "f845",
    	"sym-sgd": "f846",
    	"sym-sgn-s": "f847",
    	"sym-sgn": "f848",
    	"sym-sgu-s": "f849",
    	"sym-sgu": "f84a",
    	"sym-shib-s": "f84b",
    	"sym-shib": "f84c",
    	"sym-shift-s": "f84d",
    	"sym-shift": "f84e",
    	"sym-ship-s": "f84f",
    	"sym-ship": "f850",
    	"sym-shping-s": "f851",
    	"sym-shping": "f852",
    	"sym-si-s": "f853",
    	"sym-si": "f854",
    	"sym-sib-s": "f855",
    	"sym-sib": "f856",
    	"sym-sil-s": "f857",
    	"sym-sil": "f858",
    	"sym-six-s": "f859",
    	"sym-six": "f85a",
    	"sym-sjcx-s": "f85b",
    	"sym-sjcx": "f85c",
    	"sym-skl-s": "f85d",
    	"sym-skl": "f85e",
    	"sym-skm-s": "f85f",
    	"sym-skm": "f860",
    	"sym-sku-s": "f861",
    	"sym-sku": "f862",
    	"sym-sky-s": "f863",
    	"sym-sky": "f864",
    	"sym-slp-s": "f865",
    	"sym-slp": "f866",
    	"sym-slr-s": "f867",
    	"sym-slr": "f868",
    	"sym-sls-s": "f869",
    	"sym-sls": "f86a",
    	"sym-slt-s": "f86b",
    	"sym-slt": "f86c",
    	"sym-slv-s": "f86d",
    	"sym-slv": "f86e",
    	"sym-smart-s": "f86f",
    	"sym-smart": "f870",
    	"sym-smn-s": "f871",
    	"sym-smn": "f872",
    	"sym-smt-s": "f873",
    	"sym-smt": "f874",
    	"sym-snc-s": "f875",
    	"sym-snc": "f876",
    	"sym-snet-s": "f877",
    	"sym-snet": "f878",
    	"sym-sngls-s": "f879",
    	"sym-sngls": "f87a",
    	"sym-snm-s": "f87b",
    	"sym-snm": "f87c",
    	"sym-snt-s": "f87d",
    	"sym-snt": "f87e",
    	"sym-snx-s": "f87f",
    	"sym-snx": "f880",
    	"sym-soc-s": "f881",
    	"sym-soc": "f882",
    	"sym-socks-s": "f883",
    	"sym-socks": "f884",
    	"sym-sol-s": "f885",
    	"sym-sol": "f886",
    	"sym-solid-s": "f887",
    	"sym-solid": "f888",
    	"sym-solo-s": "f889",
    	"sym-solo": "f88a",
    	"sym-solve-s": "f88b",
    	"sym-solve": "f88c",
    	"sym-sos-s": "f88d",
    	"sym-sos": "f88e",
    	"sym-soul-s": "f88f",
    	"sym-soul": "f890",
    	"sym-sp-s": "f891",
    	"sym-sp": "f892",
    	"sym-sparta-s": "f893",
    	"sym-sparta": "f894",
    	"sym-spc-s": "f895",
    	"sym-spc": "f896",
    	"sym-spd-s": "f897",
    	"sym-spd": "f898",
    	"sym-spell-s": "f899",
    	"sym-spell": "f89a",
    	"sym-sphr-s": "f89b",
    	"sym-sphr": "f89c",
    	"sym-sphtx-s": "f89d",
    	"sym-sphtx": "f89e",
    	"sym-spnd-s": "f89f",
    	"sym-spnd": "f8a0",
    	"sym-spnk-s": "f8a1",
    	"sym-spnk": "f8a2",
    	"sym-srm-s": "f8a3",
    	"sym-srm": "f8a4",
    	"sym-srn-s": "f8a5",
    	"sym-srn": "f8a6",
    	"sym-ssp-s": "f8a7",
    	"sym-ssp": "f8a8",
    	"sym-ssv-s": "f8a9",
    	"sym-ssv": "f8aa",
    	"sym-stacs-s": "f8ab",
    	"sym-stacs": "f8ac",
    	"sym-step-s": "f8ad",
    	"sym-step": "f8ae",
    	"sym-stg-s": "f8af",
    	"sym-stg": "f8b0",
    	"sym-stmx-s": "f8b1",
    	"sym-stmx": "f8b2",
    	"sym-storm-s": "f8b3",
    	"sym-storm": "f8b4",
    	"sym-stpt-s": "f8b5",
    	"sym-stpt": "f8b6",
    	"sym-stq-s": "f8b7",
    	"sym-stq": "f8b8",
    	"sym-str-s": "f8b9",
    	"sym-str": "f8ba",
    	"sym-strat-s": "f8bb",
    	"sym-strat": "f8bc",
    	"sym-strax-s": "f8bd",
    	"sym-strax": "f8be",
    	"sym-strk-s": "f8bf",
    	"sym-strk": "f8c0",
    	"sym-strong-s": "f8c1",
    	"sym-strong": "f8c2",
    	"sym-stx-s": "f8c3",
    	"sym-stx": "f8c4",
    	"sym-sub-s": "f8c5",
    	"sym-sub": "f8c6",
    	"sym-sui-s": "f8c7",
    	"sym-sui": "f8c8",
    	"sym-sun-s": "f8c9",
    	"sym-sun": "f8ca",
    	"sym-super-s": "f8cb",
    	"sym-super": "f8cc",
    	"sym-susd-s": "f8cd",
    	"sym-susd": "f8ce",
    	"sym-sushi-s": "f8cf",
    	"sym-sushi": "f8d0",
    	"sym-swftc-s": "f8d1",
    	"sym-swftc": "f8d2",
    	"sym-swm-s": "f8d3",
    	"sym-swm": "f8d4",
    	"sym-swrv-s": "f8d5",
    	"sym-swrv": "f8d6",
    	"sym-swt-s": "f8d7",
    	"sym-swt": "f8d8",
    	"sym-swth-s": "f8d9",
    	"sym-swth": "f8da",
    	"sym-sxp-s": "f8db",
    	"sym-sxp": "f8dc",
    	"sym-syn-s": "f8dd",
    	"sym-syn": "f8de",
    	"sym-sys-s": "f8df",
    	"sym-sys": "f8e0",
    	"sym-t-s": "f8e1",
    	"sym-t": "f8e2",
    	"sym-taas-s": "f8e3",
    	"sym-taas": "f8e4",
    	"sym-tau-s": "f8e5",
    	"sym-tau": "f8e6",
    	"sym-tbtc-s": "f8e7",
    	"sym-tbtc": "f8e8",
    	"sym-tct-s": "f8e9",
    	"sym-tct": "f8ea",
    	"sym-teer-s": "f8eb",
    	"sym-teer": "f8ec",
    	"sym-tel-s": "f8ed",
    	"sym-temco-s": "f8ee",
    	"sym-temco": "f8ef",
    	"sym-tfuel-s": "f8f0",
    	"sym-tfuel": "f8f1",
    	"sym-thb-s": "f8f2",
    	"sym-thb": "f8f3",
    	"sym-thc-s": "f8f4",
    	"sym-thc": "f8f5",
    	"sym-theta-s": "f8f6",
    	"sym-theta": "f8f7",
    	"sym-thx-s": "f8f8",
    	"sym-thx": "f8f9",
    	"sym-time-s": "f8fa",
    	"sym-time": "f8fb",
    	"sym-tio-s": "f8fc",
    	"sym-tio": "f8fd",
    	"sym-tix-s": "f8fe",
    	"sym-tix": "f8ff",
    	"sym-tkn-s": "f900",
    	"sym-tkn": "f901",
    	"sym-tky-s": "f902",
    	"sym-tky": "f903",
    	"sym-tlm-s": "f904",
    	"sym-tlm": "f905",
    	"sym-tnb-s": "f906",
    	"sym-tnb": "f907",
    	"sym-tnc-s": "f908",
    	"sym-tnc": "f909",
    	"sym-tnt-s": "f90a",
    	"sym-tnt": "f90b",
    	"sym-toke-s": "f90c",
    	"sym-toke": "f90d",
    	"sym-tomb-s": "f90e",
    	"sym-tomb": "f90f",
    	"sym-tomo-s": "f910",
    	"sym-tomo": "f911",
    	"sym-top-s": "f912",
    	"sym-top": "f913",
    	"sym-torn-s": "f914",
    	"sym-torn": "f915",
    	"sym-tower-s": "f916",
    	"sym-tower": "f917",
    	"sym-tpay-s": "f918",
    	"sym-tpay": "f919",
    	"sym-trac-s": "f91a",
    	"sym-trac": "f91b",
    	"sym-trb-s": "f91c",
    	"sym-trb": "f91d",
    	"sym-tribe-s": "f91e",
    	"sym-tribe": "f91f",
    	"sym-trig-s": "f920",
    	"sym-trig": "f921",
    	"sym-trio-s": "f922",
    	"sym-trio": "f923",
    	"sym-troy-s": "f924",
    	"sym-troy": "f925",
    	"sym-trst-s": "f926",
    	"sym-trst": "f927",
    	"sym-tru-s": "f928",
    	"sym-tru": "f929",
    	"sym-true-s": "f92a",
    	"sym-true": "f92b",
    	"sym-trx-s": "f92c",
    	"sym-trx": "f92d",
    	"sym-try-s": "f92e",
    	"sym-try": "f92f",
    	"sym-tryb-s": "f930",
    	"sym-tryb": "f931",
    	"sym-tt-s": "f932",
    	"sym-tt": "f933",
    	"sym-ttc-s": "f934",
    	"sym-ttc": "f935",
    	"sym-ttt-s": "f936",
    	"sym-ttt": "f937",
    	"sym-ttu-s": "f938",
    	"sym-ttu": "f939",
    	"sym-tube-s": "f93a",
    	"sym-tube": "f93b",
    	"sym-tusd-s": "f93c",
    	"sym-tusd": "f93d",
    	"sym-tvk-s": "f93e",
    	"sym-tvk": "f93f",
    	"sym-twt-s": "f940",
    	"sym-twt": "f941",
    	"sym-uah-s": "f942",
    	"sym-uah": "f943",
    	"sym-ubq-s": "f944",
    	"sym-ubq": "f945",
    	"sym-ubt-s": "f946",
    	"sym-ubt": "f947",
    	"sym-uft-s": "f948",
    	"sym-uft": "f949",
    	"sym-ugas-s": "f94a",
    	"sym-ugas": "f94b",
    	"sym-uip-s": "f94c",
    	"sym-uip": "f94d",
    	"sym-ukg-s": "f94e",
    	"sym-ukg": "f94f",
    	"sym-uma-s": "f950",
    	"sym-uma": "f951",
    	"sym-umami-s": "f952",
    	"sym-umami": "f953",
    	"sym-unfi-s": "f954",
    	"sym-unfi": "f955",
    	"sym-uni-s": "f956",
    	"sym-uni": "f957",
    	"sym-unq-s": "f958",
    	"sym-unq": "f959",
    	"sym-up-s": "f95a",
    	"sym-up": "f95b",
    	"sym-upp-s": "f95c",
    	"sym-upp": "f95d",
    	"sym-usd-s": "f95e",
    	"sym-usd": "f95f",
    	"sym-usdc-s": "f960",
    	"sym-usdc": "f961",
    	"sym-usds-s": "f962",
    	"sym-usds": "f963",
    	"sym-usk-s": "f964",
    	"sym-usk": "f965",
    	"sym-ust-s": "f966",
    	"sym-ust": "f967",
    	"sym-utk-s": "f968",
    	"sym-utk": "f969",
    	"sym-utnp-s": "f96a",
    	"sym-utnp": "f96b",
    	"sym-utt-s": "f96c",
    	"sym-utt": "f96d",
    	"sym-uuu-s": "f96e",
    	"sym-uuu": "f96f",
    	"sym-ux-s": "f970",
    	"sym-ux": "f971",
    	"sym-vader-s": "f972",
    	"sym-vader": "f973",
    	"sym-vai-s": "f974",
    	"sym-vai": "f975",
    	"sym-vbk-s": "f976",
    	"sym-vbk": "f977",
    	"sym-vdx-s": "f978",
    	"sym-vdx": "f979",
    	"sym-vee-s": "f97a",
    	"sym-vee": "f97b",
    	"sym-vemp-s": "f97c",
    	"sym-vemp": "f97d",
    	"sym-ven-s": "f97e",
    	"sym-ven": "f97f",
    	"sym-veo-s": "f980",
    	"sym-veo": "f981",
    	"sym-veri-s": "f982",
    	"sym-veri": "f983",
    	"sym-vex-s": "f984",
    	"sym-vex": "f985",
    	"sym-vgx-s": "f986",
    	"sym-vgx": "f987",
    	"sym-via-s": "f988",
    	"sym-via": "f989",
    	"sym-vib-s": "f98a",
    	"sym-vib": "f98b",
    	"sym-vibe-s": "f98c",
    	"sym-vibe": "f98d",
    	"sym-vid-s": "f98e",
    	"sym-vid": "f98f",
    	"sym-vidt-s": "f990",
    	"sym-vidt": "f991",
    	"sym-vidy-s": "f992",
    	"sym-vidy": "f993",
    	"sym-vitae-s": "f994",
    	"sym-vitae": "f995",
    	"sym-vite-s": "f996",
    	"sym-vite": "f997",
    	"sym-vlx-s": "f998",
    	"sym-vlx": "f999",
    	"sym-vox-s": "f99a",
    	"sym-vox": "f99b",
    	"sym-voxel-s": "f99c",
    	"sym-voxel": "f99d",
    	"sym-vra-s": "f99e",
    	"sym-vra": "f99f",
    	"sym-vrc-s": "f9a0",
    	"sym-vrc": "f9a1",
    	"sym-vrm-s": "f9a2",
    	"sym-vrm": "f9a3",
    	"sym-vsys-s": "f9a4",
    	"sym-vsys": "f9a5",
    	"sym-vtc-s": "f9a6",
    	"sym-vtc": "f9a7",
    	"sym-vtho-s": "f9a8",
    	"sym-vtho": "f9a9",
    	"sym-wabi-s": "f9aa",
    	"sym-wabi": "f9ab",
    	"sym-wan-s": "f9ac",
    	"sym-wan": "f9ad",
    	"sym-waves-s": "f9ae",
    	"sym-waves": "f9af",
    	"sym-wax-s": "f9b0",
    	"sym-wax": "f9b1",
    	"sym-wbtc-s": "f9b2",
    	"sym-wbtc": "f9b3",
    	"sym-wet-s": "f9b4",
    	"sym-wet": "f9b5",
    	"sym-weth-s": "f9b6",
    	"sym-weth": "f9b7",
    	"sym-wib-s": "f9b8",
    	"sym-wib": "f9b9",
    	"sym-wicc-s": "f9ba",
    	"sym-wicc": "f9bb",
    	"sym-win-s": "f9bc",
    	"sym-win": "f9bd",
    	"sym-wing-s": "f9be",
    	"sym-wing": "f9bf",
    	"sym-wings-s": "f9c0",
    	"sym-wings": "f9c1",
    	"sym-wnxm-s": "f9c2",
    	"sym-wnxm": "f9c3",
    	"sym-woo-s": "f9c4",
    	"sym-woo": "f9c5",
    	"sym-wpr-s": "f9c6",
    	"sym-wpr": "f9c7",
    	"sym-wrx-s": "f9c8",
    	"sym-wrx": "f9c9",
    	"sym-wtc-s": "f9ca",
    	"sym-wtc": "f9cb",
    	"sym-wtt-s": "f9cc",
    	"sym-wtt": "f9cd",
    	"sym-wwb-s": "f9ce",
    	"sym-wwb": "f9cf",
    	"sym-wxt-s": "f9d0",
    	"sym-wxt": "f9d1",
    	"sym-xas-s": "f9d2",
    	"sym-xas": "f9d3",
    	"sym-xaur-s": "f9d4",
    	"sym-xaur": "f9d5",
    	"sym-xaut-s": "f9d6",
    	"sym-xaut": "f9d7",
    	"sym-xava-s": "f9d8",
    	"sym-xava": "f9d9",
    	"sym-xbc-s": "f9da",
    	"sym-xbc": "f9db",
    	"sym-xcn-s": "f9dc",
    	"sym-xcn": "f9dd",
    	"sym-xcon-s": "f9de",
    	"sym-xcon": "f9df",
    	"sym-xcp-s": "f9e0",
    	"sym-xcp": "f9e1",
    	"sym-xdefi-s": "f9e2",
    	"sym-xdefi": "f9e3",
    	"sym-xdn-s": "f9e4",
    	"sym-xdn": "f9e5",
    	"sym-xel-s": "f9e6",
    	"sym-xel": "f9e7",
    	"sym-xem-s": "f9e8",
    	"sym-xem": "f9e9",
    	"sym-xes-s": "f9ea",
    	"sym-xes": "f9eb",
    	"sym-xhv-s": "f9ec",
    	"sym-xhv": "f9ed",
    	"sym-xin-s": "f9ee",
    	"sym-xin": "f9ef",
    	"sym-xlm-s": "f9f0",
    	"sym-xlm": "f9f1",
    	"sym-xmc-s": "f9f2",
    	"sym-xmc": "f9f3",
    	"sym-xmr-s": "f9f4",
    	"sym-xmr": "f9f5",
    	"sym-xmx-s": "f9f6",
    	"sym-xmx": "f9f7",
    	"sym-xmy-s": "f9f8",
    	"sym-xmy": "f9f9",
    	"sym-xnk-s": "f9fa",
    	"sym-xnk": "f9fb",
    	"sym-xns-s": "f9fc",
    	"sym-xns": "f9fd",
    	"sym-xor-s": "f9fe",
    	"sym-xor": "f9ff",
    	"sym-xos-s": "fa00",
    	"sym-xos": "fa01",
    	"sym-xpm-s": "fa02",
    	"sym-xpm": "fa03",
    	"sym-xpr-s": "fa04",
    	"sym-xpr": "fa05",
    	"sym-xrc-s": "fa06",
    	"sym-xrc": "fa07",
    	"sym-xrp-s": "fa08",
    	"sym-xrp": "fa09",
    	"sym-xrpx-s": "fa0a",
    	"sym-xrpx": "fa0b",
    	"sym-xrt-s": "fa0c",
    	"sym-xrt": "fa0d",
    	"sym-xst-s": "fa0e",
    	"sym-xst": "fa0f",
    	"sym-xtp-s": "fa10",
    	"sym-xtp": "fa11",
    	"sym-xtz-s": "fa12",
    	"sym-xtz": "fa13",
    	"sym-xtzdown-s": "fa14",
    	"sym-xtzdown": "fa15",
    	"sym-xvc-s": "fa16",
    	"sym-xvc": "fa17",
    	"sym-xvg-s": "fa18",
    	"sym-xvg": "fa19",
    	"sym-xvs-s": "fa1a",
    	"sym-xvs": "fa1b",
    	"sym-xwc-s": "fa1c",
    	"sym-xwc": "fa1d",
    	"sym-xyo-s": "fa1e",
    	"sym-xyo": "fa1f",
    	"sym-xzc-s": "fa20",
    	"sym-xzc": "fa21",
    	"sym-yam-s": "fa22",
    	"sym-yam": "fa23",
    	"sym-yee-s": "fa24",
    	"sym-yee": "fa25",
    	"sym-yeed-s": "fa26",
    	"sym-yeed": "fa27",
    	"sym-yfi-s": "fa28",
    	"sym-yfi": "fa29",
    	"sym-yfii-s": "fa2a",
    	"sym-yfii": "fa2b",
    	"sym-ygg-s": "fa2c",
    	"sym-ygg": "fa2d",
    	"sym-yoyow-s": "fa2e",
    	"sym-yoyow": "fa2f",
    	"sym-zar-s": "fa30",
    	"sym-zar": "fa31",
    	"sym-zcl-s": "fa32",
    	"sym-zcl": "fa33",
    	"sym-zcn-s": "fa34",
    	"sym-zcn": "fa35",
    	"sym-zco-s": "fa36",
    	"sym-zco": "fa37",
    	"sym-zec-s": "fa38",
    	"sym-zec": "fa39",
    	"sym-zen-s": "fa3a",
    	"sym-zen": "fa3b",
    	"sym-zil-s": "fa3c",
    	"sym-zil": "fa3d",
    	"sym-zks-s": "fa3e",
    	"sym-zks": "fa3f",
    	"sym-zla-s": "fa40",
    	"sym-zla": "fa41",
    	"sym-zlk": "fa42",
    	"sym-zondo-s": "fa43",
    	"sym-zondo": "fa44",
    	"sym-zpr-s": "fa45",
    	"sym-zpr": "fa46",
    	"sym-zpt-s": "fa47",
    	"sym-zpt": "fa48",
    	"sym-zrc-s": "fa49",
    	"sym-zrc": "fa4a",
    	"sym-zrx-s": "fa4b",
    	"sym-zrx": "fa4c",
    	"sym-zsc-s": "fa4d",
    	"sym-zsc": "fa4e",
    	"sym-ztg-s": "fa4f",
    	"sym-ztg": "fa50",
    	"ustc-s": "fa51",
    	ustc: ustc,
    	"cur-anct": "f1d4",
    	"cur-anct-s": "f1d3",
    	"cur-aud": "f206",
    	"cur-aud-s": "f205",
    	"cur-bnb": "f27b",
    	"cur-bnb-s": "f27a",
    	"sym-xbt": "f2a5",
    	"cur-btc": "f2a5",
    	"sym-xbt-s": "f2a4",
    	"cur-btc-s": "f2a4",
    	"cur-busd": "f2c5",
    	"cur-busd-s": "f2c4",
    	"exc-bitz": "f2c9",
    	"cur-bz": "f2c9",
    	"exc-bitz-s": "f2c8",
    	"cur-bz-s": "f2c8",
    	"cur-cad": "f2d3",
    	"cur-cad-s": "f2d2",
    	"cur-chf": "f2f3",
    	"cur-chf-s": "f2f2",
    	"cur-cny": "f317",
    	"cur-cny-s": "f316",
    	"sym-cs": "f32b",
    	"sym-cs-s": "f32a",
    	"sym-crm": "f343",
    	"sym-crm-s": "f342",
    	"cur-dai": "f373",
    	"cur-dai-s": "f372",
    	"sym-xdg": "f3b1",
    	"sym-xdg-s": "f3b0",
    	"cur-eos": "f3fe",
    	"cur-eos-s": "f3fd",
    	"sym-eth2": "f40e",
    	"sym-eth2s": "f40e",
    	"sym-eth2.s": "f40e",
    	"cur-eth": "f40e",
    	"sym-eth2-s": "f40d",
    	"sym-eth2s-s": "f40d",
    	"sym-eth2.s-s": "f40d",
    	"cur-eth-s": "f40d",
    	"cur-eur": "f41a",
    	"cur-eur-s": "f419",
    	"cur-eurs": "f41e",
    	"cur-eurs-s": "f41d",
    	"sym-usdt": "f420",
    	"cur-usdt": "f420",
    	"sym-usdt-s": "f41f",
    	"cur-usdt-s": "f41f",
    	"exc-kraken": "f438",
    	"exc-kraken-futures": "f438",
    	"exc-kraken-s": "f437",
    	"exc-kraken-futures-s": "f437",
    	"cur-gbp": "f48e",
    	"cur-gbp-s": "f48d",
    	"exc-gemini": "f4da",
    	"cur-gusd": "f4da",
    	"exc-gemini-s": "f4d9",
    	"cur-gusd-s": "f4d9",
    	"cur-hkd": "f4fe",
    	"cur-hkd-s": "f4fd",
    	"sym-husd": "f51c",
    	"exc-huobi": "f51c",
    	"cur-ht": "f51c",
    	"sym-husd-s": "f51b",
    	"exc-huobi-s": "f51b",
    	"cur-ht-s": "f51b",
    	"cur-idr": "f53c",
    	"cur-idr-s": "f53b",
    	"sym-iota": "f564",
    	"sym-iota-s": "f563",
    	"cur-inr": "f556",
    	"cur-inr-s": "f555",
    	"cur-jpy": "f57a",
    	"cur-jpy-s": "f579",
    	"cur-krw": "f5ac",
    	"cur-krw-s": "f5ab",
    	"sym-medx": "f62a",
    	"sym-medx-s": "f629",
    	"cur-mxn": "f682",
    	"cur-mxn-s": "f681",
    	"cur-myr": "f684",
    	"cur-myr-s": "f683",
    	"cur-ngn": "f6ae",
    	"cur-ngn-s": "f6ad",
    	"cur-pax": "f72a",
    	"cur-pax-s": "f729",
    	"cur-php": "f742",
    	"cur-php-s": "f741",
    	"cur-pln": "f758",
    	"cur-pln-s": "f757",
    	"cur-qash": "f790",
    	"cur-qash-s": "f78f",
    	"cur-rub": "f80e",
    	"cur-rur": "f80e",
    	"cur-rub-s": "f80d",
    	"cur-rur-s": "f80d",
    	"sym-steem": "f826",
    	"sym-steem-s": "f825",
    	"sym-xsc": "f82a",
    	"sym-xsc-s": "f829",
    	"cur-sgd": "f846",
    	"cur-sgd-s": "f845",
    	"sym-storj": "f85c",
    	"sym-storj-s": "f85b",
    	"sym-tel": "f8e4",
    	"cur-trx": "f92d",
    	"cur-trx-s": "f92c",
    	"cur-tusd": "f93d",
    	"cur-tusd-s": "f93c",
    	"cur-usd": "f95f",
    	"cur-usd-s": "f95e",
    	"cur-usdc": "f961",
    	"cur-usdc-s": "f960",
    	"sym-vet": "f97f",
    	"sym-vet-s": "f97e",
    	"sym-waxp": "f9b1",
    	"sym-waxp-s": "f9b0",
    	"cur-xlm": "f9f1",
    	"cur-xlm-s": "f9f0",
    	"cur-xmr": "f9f5",
    	"cur-xmr-s": "f9f4",
    	"cur-xrp": "fa09",
    	"cur-xrp-s": "fa08",
    	"cur-zar": "fa31",
    	"cur-zar-s": "fa30",
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
    	"cur-crc": "f337",
    	"cur-crc-s": "f336",
    	"cur-lak": "f5b6",
    	"cur-lak-s": "f5b5",
    	"cur-sek": "f836",
    	"cur-sek-s": "f835",
    	"cur-thb": "f8f3",
    	"cur-thb-s": "f8f2",
    	"cur-try": "f92f",
    	"cur-try-s": "f92e",
    	"cur-uah": "f943",
    	"cur-uah-s": "f942",
    	"exc-ftx": "f46e",
    	"exc-ftx-s": "f46d",
    	"exc-ftx-us": "f46e",
    	"exc-ftx-us-s": "f46d",
    	"sym-cgld": "f2e3",
    	"sym-cgld-s": "f2e2",
    	"exc-uniswap-v2": "f957",
    	"exc-uniswap-v2-s": "f956",
    	"sym-kshib": "f84c",
    	"sym-kshib-s": "f84b",
    	"sym-easy-s": "f3d2",
    	"sym-srare": "f7ba",
    	"sym-srare-s": "f7b9",
    	"sym-ape.2": "f1da",
    	"sym-ape.2-s": "f1d9",
    	"cur-sat": "f824",
    	"cur-sat-s": "f823"
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
    var arb = "Arbitrum";
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
    var blur = "Blur";
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
    var erd = "Elrond-old";
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
    var lseth = "Liquid Staked ETH";
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
    var op = "Optimism";
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
    var qnt = "Quant";
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
    var sat = "";
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
    var xcn = "Onyxcoin";
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
    	arb: arb,
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
    	blur: blur,
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
    	lseth: lseth,
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
    	op: op,
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
    	sat: sat,
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
    	"super": "SuperVerse",
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
    	"sym-ape.2-s": "sym-ape-s",
    	"cur-sat": "sym-sat",
    	"cur-sat-s": "sym-sat-s"
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
