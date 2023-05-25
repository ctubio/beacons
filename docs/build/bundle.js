
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

    var ustc = "fa5c";
    var beacons = {
    	"exc-_default-s": "f101",
    	"exc-_default": "f102",
    	"sym-_default-s": "f16f",
    	"sym-_default": "f170",
    	"sym-d": "f170",
    	"sym-d-s": "f16f",
    	"sym-default": "f170",
    	"sym-default-s": "f16f",
    	"exc-d": "f102",
    	"exc-d-s": "f101",
    	"exc-default": "f102",
    	"exc-default-s": "f101",
    	"cur-default": "f170",
    	"cur-default-s": "f16f",
    	"exc-amex-s": "f103",
    	"exc-amex": "f104",
    	"exc-axieinfinity-s": "f105",
    	"exc-axieinfinity": "f106",
    	"exc-bibox-s": "f107",
    	"exc-bibox": "f108",
    	"exc-binance-s": "f109",
    	"exc-binance": "f10a",
    	"exc-bisq-s": "f10b",
    	"exc-bisq": "f10c",
    	"exc-bitbay-s": "f10d",
    	"exc-bitbay": "f10e",
    	"exc-bitfinex-s": "f10f",
    	"exc-bitfinex": "f110",
    	"exc-bitflyer-s": "f111",
    	"exc-bitflyer": "f112",
    	"exc-bithumb-s": "f113",
    	"exc-bithumb": "f114",
    	"exc-bitmex-s": "f115",
    	"exc-bitmex": "f116",
    	"exc-bitso-s": "f117",
    	"exc-bitso": "f118",
    	"exc-bitsquare-s": "f119",
    	"exc-bitsquare": "f11a",
    	"exc-bitstamp-s": "f11b",
    	"exc-bitstamp": "f11c",
    	"exc-bittrex-s": "f11d",
    	"exc-bittrex": "f11e",
    	"exc-bitvc-s": "f11f",
    	"exc-bitvc": "f120",
    	"exc-btcchina-s": "f121",
    	"exc-btcchina": "f122",
    	"exc-btce-s": "f123",
    	"exc-btce": "f124",
    	"exc-bybit-s": "f125",
    	"exc-bybit": "f126",
    	"exc-cexio-s": "f127",
    	"exc-cexio": "f128",
    	"exc-cme-s": "f129",
    	"exc-cme": "f12a",
    	"exc-coinbase-s": "f12b",
    	"exc-coinbase": "f12c",
    	"exc-coinbasepro-s": "f12d",
    	"exc-coinbasepro": "f12e",
    	"exc-coinone-s": "f12f",
    	"exc-coinone": "f130",
    	"exc-comex-s": "f131",
    	"exc-comex": "f132",
    	"exc-crypto-com-s": "f133",
    	"exc-crypto-com": "f134",
    	"exc-cryptofacilities-s": "f135",
    	"exc-cryptofacilities": "f136",
    	"exc-deribit-s": "f137",
    	"exc-deribit": "f138",
    	"exc-dex-aggregated-s": "f139",
    	"exc-dex-aggregated": "f13a",
    	"exc-gateio-s": "f13b",
    	"exc-gateio": "f13c",
    	"exc-hitbtc-s": "f13d",
    	"exc-hitbtc": "f13e",
    	"exc-kucoin-s": "f13f",
    	"exc-kucoin": "f140",
    	"exc-liquid-s": "f141",
    	"exc-liquid": "f142",
    	"exc-luno-s": "f143",
    	"exc-luno": "f144",
    	"exc-mtgox-s": "f145",
    	"exc-mtgox": "f146",
    	"exc-mxc-s": "f147",
    	"exc-mxc": "f148",
    	"exc-nasdaq-s": "f149",
    	"exc-nasdaq": "f14a",
    	"exc-nbatopshop-s": "f14b",
    	"exc-nbatopshop": "f14c",
    	"exc-nymex-s": "f14d",
    	"exc-nymex": "f14e",
    	"exc-nyse-s": "f14f",
    	"exc-nyse": "f150",
    	"exc-okcoin-s": "f151",
    	"exc-okcoin": "f152",
    	"exc-okx-s": "f153",
    	"exc-okx": "f154",
    	"exc-opensea-s": "f155",
    	"exc-opensea": "f156",
    	"exc-poloniex-s": "f157",
    	"exc-poloniex": "f158",
    	"exc-qryptos-s": "f159",
    	"exc-qryptos": "f15a",
    	"exc-quadrigacx-s": "f15b",
    	"exc-quadrigacx": "f15c",
    	"exc-quick-s": "f15d",
    	"exc-quick": "f15e",
    	"exc-quoine-s": "f15f",
    	"exc-quoine": "f160",
    	"exc-rarible-s": "f161",
    	"exc-rarible": "f162",
    	"exc-totle-s": "f163",
    	"exc-totle": "f164",
    	"exc-upbit-s": "f165",
    	"exc-upbit": "f166",
    	"exc-vaultofsatoshi-s": "f167",
    	"exc-vaultofsatoshi": "f168",
    	"exc-wex-s": "f169",
    	"exc-wex": "f16a",
    	"exc-zaif-s": "f16b",
    	"exc-zaif": "f16c",
    	"exc-zonda-s": "f16d",
    	"exc-zonda": "f16e",
    	"sym-1inch-s": "f171",
    	"sym-1inch": "f172",
    	"sym-1st-s": "f173",
    	"sym-1st": "f174",
    	"sym-6a-s": "f175",
    	"sym-6a": "f176",
    	"sym-6b-s": "f177",
    	"sym-6b": "f178",
    	"sym-6c-s": "f179",
    	"sym-6c": "f17a",
    	"sym-6e-s": "f17b",
    	"sym-6e": "f17c",
    	"sym-6j-s": "f17d",
    	"sym-6j": "f17e",
    	"sym-6l-s": "f17f",
    	"sym-6l": "f180",
    	"sym-6m-s": "f181",
    	"sym-6m": "f182",
    	"sym-6n-s": "f183",
    	"sym-6n": "f184",
    	"sym-6s-s": "f185",
    	"sym-6s": "f186",
    	"sym-a38-s": "f187",
    	"sym-a38": "f188",
    	"sym-aac-s": "f189",
    	"sym-aac": "f18a",
    	"sym-aave-s": "f18b",
    	"sym-aave": "f18c",
    	"sym-abbc-s": "f18d",
    	"sym-abbc": "f18e",
    	"sym-abt-s": "f18f",
    	"sym-abt": "f190",
    	"sym-abyss-s": "f191",
    	"sym-abyss": "f192",
    	"sym-aca-s": "f193",
    	"sym-aca": "f194",
    	"sym-acat-s": "f195",
    	"sym-acat": "f196",
    	"sym-ach-s": "f197",
    	"sym-ach": "f198",
    	"sym-act-s": "f199",
    	"sym-act": "f19a",
    	"sym-ad0-s": "f19b",
    	"sym-ad0": "f19c",
    	"sym-ada-s": "f19d",
    	"sym-ada": "f19e",
    	"sym-adel-s": "f19f",
    	"sym-adel": "f1a0",
    	"sym-adh-s": "f1a1",
    	"sym-adh": "f1a2",
    	"sym-adm-s": "f1a3",
    	"sym-adm": "f1a4",
    	"sym-ado-s": "f1a5",
    	"sym-ado": "f1a6",
    	"sym-adt-s": "f1a7",
    	"sym-adt": "f1a8",
    	"sym-adx-s": "f1a9",
    	"sym-adx": "f1aa",
    	"sym-ae-s": "f1ab",
    	"sym-ae": "f1ac",
    	"sym-aed-s": "f1ad",
    	"sym-aed": "f1ae",
    	"sym-aeon-s": "f1af",
    	"sym-aeon": "f1b0",
    	"sym-aep-s": "f1b1",
    	"sym-aep": "f1b2",
    	"sym-aergo-s": "f1b3",
    	"sym-aergo": "f1b4",
    	"sym-agi-s": "f1b5",
    	"sym-agi": "f1b6",
    	"sym-agld-s": "f1b7",
    	"sym-agld": "f1b8",
    	"sym-aid-s": "f1b9",
    	"sym-aid": "f1ba",
    	"sym-aion-s": "f1bb",
    	"sym-aion": "f1bc",
    	"sym-air-s": "f1bd",
    	"sym-air": "f1be",
    	"sym-akro-s": "f1bf",
    	"sym-akro": "f1c0",
    	"sym-akt-s": "f1c1",
    	"sym-akt": "f1c2",
    	"sym-alcx-s": "f1c3",
    	"sym-alcx": "f1c4",
    	"sym-aleph-s": "f1c5",
    	"sym-aleph": "f1c6",
    	"sym-algo-s": "f1c7",
    	"sym-algo": "f1c8",
    	"sym-ali-s": "f1c9",
    	"sym-ali": "f1ca",
    	"sym-alice-s": "f1cb",
    	"sym-alice": "f1cc",
    	"sym-alpha-s": "f1cd",
    	"sym-alpha": "f1ce",
    	"sym-amb-s": "f1cf",
    	"sym-amb": "f1d0",
    	"sym-amlt-s": "f1d1",
    	"sym-amlt": "f1d2",
    	"sym-amp-s": "f1d3",
    	"sym-amp": "f1d4",
    	"sym-ampl-s": "f1d5",
    	"sym-ampl": "f1d6",
    	"sym-anc-s": "f1d7",
    	"sym-anc": "f1d8",
    	"sym-anct-s": "f1d9",
    	"sym-anct": "f1da",
    	"sym-ankr-s": "f1db",
    	"sym-ankr": "f1dc",
    	"sym-ant-s": "f1dd",
    	"sym-ant": "f1de",
    	"sym-ape-s": "f1df",
    	"sym-ape": "f1e0",
    	"sym-api3-s": "f1e1",
    	"sym-api3": "f1e2",
    	"sym-apis-s": "f1e3",
    	"sym-apis": "f1e4",
    	"sym-appc-s": "f1e5",
    	"sym-appc": "f1e6",
    	"sym-aptos-s": "f1e7",
    	"sym-aptos": "f1e8",
    	"sym-ar-s": "f1e9",
    	"sym-ar": "f1ea",
    	"sym-arb-s": "f1eb",
    	"sym-arb": "f1ec",
    	"sym-ardr-s": "f1ed",
    	"sym-ardr": "f1ee",
    	"sym-ark-s": "f1ef",
    	"sym-ark": "f1f0",
    	"sym-arn-s": "f1f1",
    	"sym-arn": "f1f2",
    	"sym-arpa-s": "f1f3",
    	"sym-arpa": "f1f4",
    	"sym-art-s": "f1f5",
    	"sym-art": "f1f6",
    	"sym-aspt-s": "f1f7",
    	"sym-aspt": "f1f8",
    	"sym-ast-s": "f1f9",
    	"sym-ast": "f1fa",
    	"sym-astr-s": "f1fb",
    	"sym-astr": "f1fc",
    	"sym-at-s": "f1fd",
    	"sym-at": "f1fe",
    	"sym-atlas-s": "f1ff",
    	"sym-atlas": "f200",
    	"sym-atm-s": "f201",
    	"sym-atm": "f202",
    	"sym-atom-s": "f203",
    	"sym-atom": "f204",
    	"sym-atp-s": "f205",
    	"sym-atp": "f206",
    	"sym-atri-s": "f207",
    	"sym-atri": "f208",
    	"sym-auction-s": "f209",
    	"sym-auction": "f20a",
    	"sym-aud-s": "f20b",
    	"sym-aud": "f20c",
    	"sym-audio-s": "f20d",
    	"sym-audio": "f20e",
    	"sym-aup-s": "f20f",
    	"sym-aup": "f210",
    	"sym-aury-s": "f211",
    	"sym-aury": "f212",
    	"sym-ausd-s": "f213",
    	"sym-ausd": "f214",
    	"sym-auto-s": "f215",
    	"sym-auto": "f216",
    	"sym-ava-s": "f217",
    	"sym-ava": "f218",
    	"sym-avax-s": "f219",
    	"sym-avax": "f21a",
    	"sym-avt-s": "f21b",
    	"sym-avt": "f21c",
    	"sym-axl-s": "f21d",
    	"sym-axl": "f21e",
    	"sym-axpr-s": "f21f",
    	"sym-axpr": "f220",
    	"sym-axs-s": "f221",
    	"sym-axs": "f222",
    	"sym-b": "f223",
    	"sym-b0-s": "f224",
    	"sym-b0": "f225",
    	"sym-b2g-s": "f226",
    	"sym-b2g": "f227",
    	"sym-bab-s": "f228",
    	"sym-bab": "f229",
    	"sym-badger-s": "f22a",
    	"sym-badger": "f22b",
    	"sym-bake-s": "f22c",
    	"sym-bake": "f22d",
    	"sym-bal-s": "f22e",
    	"sym-bal": "f22f",
    	"sym-banca-s": "f230",
    	"sym-banca": "f231",
    	"sym-band-s": "f232",
    	"sym-band": "f233",
    	"sym-bat-s": "f234",
    	"sym-bat": "f235",
    	"sym-bay-s": "f236",
    	"sym-bay": "f237",
    	"sym-bbc-s": "f238",
    	"sym-bbc": "f239",
    	"sym-bcc-s": "f23a",
    	"sym-bcc": "f23b",
    	"sym-bcd-s": "f23c",
    	"sym-bcd": "f23d",
    	"sym-bch-s": "f23e",
    	"sym-bch": "f23f",
    	"sym-bci-s": "f240",
    	"sym-bci": "f241",
    	"sym-bcn-s": "f242",
    	"sym-bcn": "f243",
    	"sym-bcpt-s": "f244",
    	"sym-bcpt": "f245",
    	"sym-bcu-s": "f246",
    	"sym-bcu": "f247",
    	"sym-bcv-s": "f248",
    	"sym-bcv": "f249",
    	"sym-bcy-s": "f24a",
    	"sym-bcy": "f24b",
    	"sym-bdg-s": "f24c",
    	"sym-bdg": "f24d",
    	"sym-beam-s": "f24e",
    	"sym-beam": "f24f",
    	"sym-beet-s": "f250",
    	"sym-beet": "f251",
    	"sym-bel-s": "f252",
    	"sym-bel": "f253",
    	"sym-bela-s": "f254",
    	"sym-bela": "f255",
    	"sym-berry-s": "f256",
    	"sym-berry": "f257",
    	"sym-beta-s": "f258",
    	"sym-beta": "f259",
    	"sym-betr-s": "f25a",
    	"sym-betr": "f25b",
    	"sym-bez-s": "f25c",
    	"sym-bez": "f25d",
    	"sym-bft-s": "f25e",
    	"sym-bft": "f25f",
    	"sym-bfx-s": "f260",
    	"sym-bfx": "f261",
    	"sym-bhd-s": "f262",
    	"sym-bhd": "f263",
    	"sym-bht-s": "f264",
    	"sym-bht": "f265",
    	"sym-bico-s": "f266",
    	"sym-bico": "f267",
    	"sym-bit-s": "f268",
    	"sym-bit": "f269",
    	"sym-bitb-s": "f26a",
    	"sym-bitb": "f26b",
    	"sym-bix-s": "f26c",
    	"sym-bix": "f26d",
    	"sym-bk-s": "f26e",
    	"sym-bk": "f26f",
    	"sym-bkx-s": "f270",
    	"sym-bkx": "f271",
    	"sym-blk-s": "f272",
    	"sym-blk": "f273",
    	"sym-block-s": "f274",
    	"sym-block": "f275",
    	"sym-blok-s": "f276",
    	"sym-blok": "f277",
    	"sym-blt-s": "f278",
    	"sym-blt": "f279",
    	"sym-blur-s": "f27a",
    	"sym-blur": "f27b",
    	"sym-blz-s": "f27c",
    	"sym-blz": "f27d",
    	"sym-bmc-s": "f27e",
    	"sym-bmc": "f27f",
    	"sym-bnb-s": "f280",
    	"sym-bnb": "f281",
    	"sym-bnc-s": "f282",
    	"sym-bnc": "f283",
    	"sym-bnk-s": "f284",
    	"sym-bnk": "f285",
    	"sym-bnt-s": "f286",
    	"sym-bnt": "f287",
    	"sym-bo-s": "f288",
    	"sym-bo": "f289",
    	"sym-boba-s": "f28a",
    	"sym-boba": "f28b",
    	"sym-bond-s": "f28c",
    	"sym-bond": "f28d",
    	"sym-boo-s": "f28e",
    	"sym-boo": "f28f",
    	"sym-bor-s": "f290",
    	"sym-bor": "f291",
    	"sym-bora-s": "f292",
    	"sym-bora": "f293",
    	"sym-bos-s": "f294",
    	"sym-bos": "f295",
    	"sym-box-s": "f296",
    	"sym-box": "f297",
    	"sym-brd-s": "f298",
    	"sym-brd": "f299",
    	"sym-breed-s": "f29a",
    	"sym-breed": "f29b",
    	"sym-brg-s": "f29c",
    	"sym-brg": "f29d",
    	"sym-brick-s": "f29e",
    	"sym-brick": "f29f",
    	"sym-bsd-s": "f2a0",
    	"sym-bsd": "f2a1",
    	"sym-bsv-s": "f2a2",
    	"sym-bsv": "f2a3",
    	"sym-bsx-s": "f2a4",
    	"sym-bsx": "f2a5",
    	"sym-bt1-s": "f2a6",
    	"sym-bt1": "f2a7",
    	"sym-bt2-s": "f2a8",
    	"sym-bt2": "f2a9",
    	"sym-btc-s": "f2aa",
    	"sym-btc": "f2ab",
    	"sym-btcd-s": "f2ac",
    	"sym-btcd": "f2ad",
    	"sym-btcfx-s": "f2ae",
    	"sym-btcfx": "f2af",
    	"sym-btcp-s": "f2b0",
    	"sym-btcp": "f2b1",
    	"sym-btg-s": "f2b2",
    	"sym-btg": "f2b3",
    	"sym-btm-s": "f2b4",
    	"sym-btm": "f2b5",
    	"sym-btn-s": "f2b6",
    	"sym-btn": "f2b7",
    	"sym-bto-s": "f2b8",
    	"sym-bto": "f2b9",
    	"sym-btrst-s": "f2ba",
    	"sym-btrst": "f2bb",
    	"sym-bts-s": "f2bc",
    	"sym-bts": "f2bd",
    	"sym-btt-s": "f2be",
    	"sym-btt": "f2bf",
    	"sym-btu-s": "f2c0",
    	"sym-btu": "f2c1",
    	"sym-btx-s": "f2c2",
    	"sym-btx": "f2c3",
    	"sym-burger-s": "f2c4",
    	"sym-burger": "f2c5",
    	"sym-burst-s": "f2c6",
    	"sym-burst": "f2c7",
    	"sym-bus-s": "f2c8",
    	"sym-bus": "f2c9",
    	"sym-busd-s": "f2ca",
    	"sym-busd": "f2cb",
    	"sym-bwx-s": "f2cc",
    	"sym-bwx": "f2cd",
    	"sym-bz-s": "f2ce",
    	"sym-bz": "f2cf",
    	"sym-bzrx-s": "f2d0",
    	"sym-bzrx": "f2d1",
    	"sym-c-s": "f2d2",
    	"sym-c": "f2d3",
    	"sym-c20-s": "f2d4",
    	"sym-c20": "f2d5",
    	"sym-c98-s": "f2d6",
    	"sym-c98": "f2d7",
    	"sym-cad-s": "f2d8",
    	"sym-cad": "f2d9",
    	"sym-cake-s": "f2da",
    	"sym-cake": "f2db",
    	"sym-cas-s": "f2dc",
    	"sym-cas": "f2dd",
    	"sym-cat-s": "f2de",
    	"sym-cat": "f2df",
    	"sym-cbc-s": "f2e0",
    	"sym-cbc": "f2e1",
    	"sym-cbt-s": "f2e2",
    	"sym-cbt": "f2e3",
    	"sym-cdt-s": "f2e4",
    	"sym-cdt": "f2e5",
    	"sym-cel-s": "f2e6",
    	"sym-cel": "f2e7",
    	"sym-celo-s": "f2e8",
    	"sym-celo": "f2e9",
    	"sym-celr-s": "f2ea",
    	"sym-celr": "f2eb",
    	"sym-cennz-s": "f2ec",
    	"sym-cennz": "f2ed",
    	"sym-cfg-s": "f2ee",
    	"sym-cfg": "f2ef",
    	"sym-cfi-s": "f2f0",
    	"sym-cfi": "f2f1",
    	"sym-cfx-s": "f2f2",
    	"sym-cfx": "f2f3",
    	"sym-cgt-s": "f2f4",
    	"sym-cgt": "f2f5",
    	"sym-chat-s": "f2f6",
    	"sym-chat": "f2f7",
    	"sym-chf-s": "f2f8",
    	"sym-chf": "f2f9",
    	"sym-chp-s": "f2fa",
    	"sym-chp": "f2fb",
    	"sym-chr-s": "f2fc",
    	"sym-chr": "f2fd",
    	"sym-chsb-s": "f2fe",
    	"sym-chsb": "f2ff",
    	"sym-chx-s": "f300",
    	"sym-chx": "f301",
    	"sym-chz-s": "f302",
    	"sym-chz": "f303",
    	"sym-ckb-s": "f304",
    	"sym-ckb": "f305",
    	"sym-cl-s": "f306",
    	"sym-cl": "f307",
    	"sym-clam-s": "f308",
    	"sym-clam": "f309",
    	"sym-cln-s": "f30a",
    	"sym-cln": "f30b",
    	"sym-clo-s": "f30c",
    	"sym-clo": "f30d",
    	"sym-cloak-s": "f30e",
    	"sym-cloak": "f30f",
    	"sym-clv-s": "f310",
    	"sym-clv": "f311",
    	"sym-cmct-s": "f312",
    	"sym-cmct": "f313",
    	"sym-cmt-s": "f314",
    	"sym-cmt": "f315",
    	"sym-cnd-s": "f316",
    	"sym-cnd": "f317",
    	"sym-cnn-s": "f318",
    	"sym-cnn": "f319",
    	"sym-cnx-s": "f31a",
    	"sym-cnx": "f31b",
    	"sym-cny-s": "f31c",
    	"sym-cny": "f31d",
    	"sym-cob-s": "f31e",
    	"sym-cob": "f31f",
    	"sym-cocos-s": "f320",
    	"sym-cocos": "f321",
    	"sym-comp-s": "f322",
    	"sym-comp": "f323",
    	"sym-cope-s": "f324",
    	"sym-cope": "f325",
    	"sym-cos-s": "f326",
    	"sym-cos": "f327",
    	"sym-cosm-s": "f328",
    	"sym-cosm": "f329",
    	"sym-coss-s": "f32a",
    	"sym-coss": "f32b",
    	"sym-coti-s": "f32c",
    	"sym-coti": "f32d",
    	"sym-cov-s": "f32e",
    	"sym-cov": "f32f",
    	"sym-cova-s": "f330",
    	"sym-cova": "f331",
    	"sym-cpt-s": "f332",
    	"sym-cpt": "f333",
    	"sym-cpx-s": "f334",
    	"sym-cpx": "f335",
    	"sym-cqt-s": "f336",
    	"sym-cqt": "f337",
    	"sym-cra-s": "f338",
    	"sym-cra": "f339",
    	"sym-crab-s": "f33a",
    	"sym-crab": "f33b",
    	"sym-crc-s": "f33c",
    	"sym-crc": "f33d",
    	"sym-cre-s": "f33e",
    	"sym-cre": "f33f",
    	"sym-cream-s": "f340",
    	"sym-cream": "f341",
    	"sym-cring-s": "f342",
    	"sym-cring": "f343",
    	"sym-cro-s": "f344",
    	"sym-cro": "f345",
    	"sym-crpt-s": "f346",
    	"sym-crpt": "f347",
    	"sym-cru-s": "f348",
    	"sym-cru": "f349",
    	"sym-crust-s": "f34a",
    	"sym-crust": "f34b",
    	"sym-crv-s": "f34c",
    	"sym-crv": "f34d",
    	"sym-crw-s": "f34e",
    	"sym-crw": "f34f",
    	"sym-csm-s": "f350",
    	"sym-csm": "f351",
    	"sym-csx-s": "f352",
    	"sym-csx": "f353",
    	"sym-ctc-s": "f354",
    	"sym-ctc": "f355",
    	"sym-ctk-s": "f356",
    	"sym-ctk": "f357",
    	"sym-ctsi-s": "f358",
    	"sym-ctsi": "f359",
    	"sym-ctxc-s": "f35a",
    	"sym-ctxc": "f35b",
    	"sym-cult-s": "f35c",
    	"sym-cult": "f35d",
    	"sym-cur-s": "f35e",
    	"sym-cur": "f35f",
    	"sym-cvc-s": "f360",
    	"sym-cvc": "f361",
    	"sym-cvcoin-s": "f362",
    	"sym-cvcoin": "f363",
    	"sym-cvnt-s": "f364",
    	"sym-cvnt": "f365",
    	"sym-cvp-s": "f366",
    	"sym-cvp": "f367",
    	"sym-cvt-s": "f368",
    	"sym-cvt": "f369",
    	"sym-cvx-s": "f36a",
    	"sym-cvx": "f36b",
    	"sym-cw-s": "f36c",
    	"sym-cw": "f36d",
    	"sym-cyc-s": "f36e",
    	"sym-cyc": "f36f",
    	"sym-dac-s": "f370",
    	"sym-dac": "f371",
    	"sym-dacs-s": "f372",
    	"sym-dacs": "f373",
    	"sym-dadi-s": "f374",
    	"sym-dadi": "f375",
    	"sym-dag-s": "f376",
    	"sym-dag": "f377",
    	"sym-dai-s": "f378",
    	"sym-dai": "f379",
    	"sym-dao-s": "f37a",
    	"sym-dao": "f37b",
    	"sym-dar-s": "f37c",
    	"sym-dar": "f37d",
    	"sym-dash-s": "f37e",
    	"sym-dash": "f37f",
    	"sym-dat-s": "f380",
    	"sym-dat": "f381",
    	"sym-data-s": "f382",
    	"sym-data": "f383",
    	"sym-datx-s": "f384",
    	"sym-datx": "f385",
    	"sym-dbc-s": "f386",
    	"sym-dbc": "f387",
    	"sym-dbet-s": "f388",
    	"sym-dbet": "f389",
    	"sym-dbix-s": "f38a",
    	"sym-dbix": "f38b",
    	"sym-dcn-s": "f38c",
    	"sym-dcn": "f38d",
    	"sym-dcr-s": "f38e",
    	"sym-dcr": "f38f",
    	"sym-dct-s": "f390",
    	"sym-dct": "f391",
    	"sym-ddd-s": "f392",
    	"sym-ddd": "f393",
    	"sym-dego-s": "f394",
    	"sym-dego": "f395",
    	"sym-dent-s": "f396",
    	"sym-dent": "f397",
    	"sym-dext-s": "f398",
    	"sym-dext": "f399",
    	"sym-dgb-s": "f39a",
    	"sym-dgb": "f39b",
    	"sym-dgd-s": "f39c",
    	"sym-dgd": "f39d",
    	"sym-dgtx-s": "f39e",
    	"sym-dgtx": "f39f",
    	"sym-dgx-s": "f3a0",
    	"sym-dgx": "f3a1",
    	"sym-dhx-s": "f3a2",
    	"sym-dhx": "f3a3",
    	"sym-dia-s": "f3a4",
    	"sym-dia": "f3a5",
    	"sym-dice-s": "f3a6",
    	"sym-dice": "f3a7",
    	"sym-dim-s": "f3a8",
    	"sym-dim": "f3a9",
    	"sym-dlt-s": "f3aa",
    	"sym-dlt": "f3ab",
    	"sym-dmd-s": "f3ac",
    	"sym-dmd": "f3ad",
    	"sym-dmt-s": "f3ae",
    	"sym-dmt": "f3af",
    	"sym-dnt-s": "f3b0",
    	"sym-dnt": "f3b1",
    	"sym-dock-s": "f3b2",
    	"sym-dock": "f3b3",
    	"sym-dodo-s": "f3b4",
    	"sym-dodo": "f3b5",
    	"sym-doge-s": "f3b6",
    	"sym-doge": "f3b7",
    	"sym-dose-s": "f3b8",
    	"sym-dose": "f3b9",
    	"sym-dot-s": "f3ba",
    	"sym-dot": "f3bb",
    	"sym-dpx-s": "f3bc",
    	"sym-dpx": "f3bd",
    	"sym-dpy-s": "f3be",
    	"sym-dpy": "f3bf",
    	"sym-dream-s": "f3c0",
    	"sym-dream": "f3c1",
    	"sym-drep-s": "f3c2",
    	"sym-drep": "f3c3",
    	"sym-drg-s": "f3c4",
    	"sym-drg": "f3c5",
    	"sym-drgn-s": "f3c6",
    	"sym-drgn": "f3c7",
    	"sym-drt-s": "f3c8",
    	"sym-drt": "f3c9",
    	"sym-dta-s": "f3ca",
    	"sym-dta": "f3cb",
    	"sym-dtb-s": "f3cc",
    	"sym-dtb": "f3cd",
    	"sym-dtr-s": "f3ce",
    	"sym-dtr": "f3cf",
    	"sym-dusk-s": "f3d0",
    	"sym-dusk": "f3d1",
    	"sym-dx-s": "f3d2",
    	"sym-dx": "f3d3",
    	"sym-dydx-s": "f3d4",
    	"sym-dydx": "f3d5",
    	"sym-dyn-s": "f3d6",
    	"sym-dyn": "f3d7",
    	"sym-easy": "f3d8",
    	"sym-ecom-s": "f3d9",
    	"sym-ecom": "f3da",
    	"sym-edc-s": "f3db",
    	"sym-edc": "f3dc",
    	"sym-edg-s": "f3dd",
    	"sym-edg": "f3de",
    	"sym-edo-s": "f3df",
    	"sym-edo": "f3e0",
    	"sym-edp-s": "f3e1",
    	"sym-edp": "f3e2",
    	"sym-edr-s": "f3e3",
    	"sym-edr": "f3e4",
    	"sym-efi-s": "f3e5",
    	"sym-efi": "f3e6",
    	"sym-egld-s": "f3e7",
    	"sym-egld": "f3e8",
    	"sym-egt-s": "f3e9",
    	"sym-egt": "f3ea",
    	"sym-ehr-s": "f3eb",
    	"sym-ehr": "f3ec",
    	"sym-eko-s": "f3ed",
    	"sym-eko": "f3ee",
    	"sym-ekt-s": "f3ef",
    	"sym-ekt": "f3f0",
    	"sym-ela-s": "f3f1",
    	"sym-ela": "f3f2",
    	"sym-elec-s": "f3f3",
    	"sym-elec": "f3f4",
    	"sym-elf-s": "f3f5",
    	"sym-elf": "f3f6",
    	"sym-em-s": "f3f7",
    	"sym-em": "f3f8",
    	"sym-emc-s": "f3f9",
    	"sym-emc": "f3fa",
    	"sym-emc2-s": "f3fb",
    	"sym-emc2": "f3fc",
    	"sym-eng-s": "f3fd",
    	"sym-eng": "f3fe",
    	"sym-enj-s": "f3ff",
    	"sym-enj": "f400",
    	"sym-ens-s": "f401",
    	"sym-ens": "f402",
    	"sym-eos-s": "f403",
    	"sym-eos": "f404",
    	"sym-eosdac-s": "f405",
    	"sym-eosdac": "f406",
    	"sym-eq-s": "f407",
    	"sym-eq": "f408",
    	"sym-erd-s": "f409",
    	"sym-erd": "f40a",
    	"sym-ern-s": "f40b",
    	"sym-ern": "f40c",
    	"sym-es": "f40d",
    	"sym-es-s": "f40e",
    	"sym-esd-s": "f40f",
    	"sym-esd": "f410",
    	"sym-etc-s": "f411",
    	"sym-etc": "f412",
    	"sym-eth-s": "f413",
    	"sym-eth": "f414",
    	"sym-ethup-s": "f415",
    	"sym-ethup": "f416",
    	"sym-ethw-s": "f417",
    	"sym-ethw": "f418",
    	"sym-etn-s": "f419",
    	"sym-etn": "f41a",
    	"sym-etp-s": "f41b",
    	"sym-etp": "f41c",
    	"sym-eul-s": "f41d",
    	"sym-eul": "f41e",
    	"sym-eur-s": "f41f",
    	"sym-eur": "f420",
    	"sym-euroc-s": "f421",
    	"sym-euroc": "f422",
    	"sym-eurs-s": "f423",
    	"sym-eurs": "f424",
    	"sym-eurt-s": "f425",
    	"sym-eurt": "f426",
    	"sym-evn-s": "f427",
    	"sym-evn": "f428",
    	"sym-evx-s": "f429",
    	"sym-evx": "f42a",
    	"sym-ewt-s": "f42b",
    	"sym-ewt": "f42c",
    	"sym-exp-s": "f42d",
    	"sym-exp": "f42e",
    	"sym-exrd-s": "f42f",
    	"sym-exrd": "f430",
    	"sym-exy-s": "f431",
    	"sym-exy": "f432",
    	"sym-ez-s": "f433",
    	"sym-ez": "f434",
    	"sym-fair-s": "f435",
    	"sym-fair": "f436",
    	"sym-farm-s": "f437",
    	"sym-farm": "f438",
    	"sym-fct-s": "f439",
    	"sym-fct": "f43a",
    	"sym-fdz-s": "f43b",
    	"sym-fdz": "f43c",
    	"sym-fee-s": "f43d",
    	"sym-fee": "f43e",
    	"sym-fet-s": "f43f",
    	"sym-fet": "f440",
    	"sym-fida-s": "f441",
    	"sym-fida": "f442",
    	"sym-fil-s": "f443",
    	"sym-fil": "f444",
    	"sym-fio-s": "f445",
    	"sym-fio": "f446",
    	"sym-firo-s": "f447",
    	"sym-firo": "f448",
    	"sym-fis-s": "f449",
    	"sym-fis": "f44a",
    	"sym-fldc-s": "f44b",
    	"sym-fldc": "f44c",
    	"sym-flo-s": "f44d",
    	"sym-flo": "f44e",
    	"sym-floki-s": "f44f",
    	"sym-floki": "f450",
    	"sym-flow-s": "f451",
    	"sym-flow": "f452",
    	"sym-flr-s": "f453",
    	"sym-flr": "f454",
    	"sym-flux-s": "f455",
    	"sym-flux": "f456",
    	"sym-fluz-s": "f457",
    	"sym-fluz": "f458",
    	"sym-fnb-s": "f459",
    	"sym-fnb": "f45a",
    	"sym-foam-s": "f45b",
    	"sym-foam": "f45c",
    	"sym-for-s": "f45d",
    	"sym-for": "f45e",
    	"sym-forth-s": "f45f",
    	"sym-forth": "f460",
    	"sym-fota-s": "f461",
    	"sym-fota": "f462",
    	"sym-fox-s": "f463",
    	"sym-fox": "f464",
    	"sym-fpis-s": "f465",
    	"sym-fpis": "f466",
    	"sym-frax-s": "f467",
    	"sym-frax": "f468",
    	"sym-front-s": "f469",
    	"sym-front": "f46a",
    	"sym-fsn-s": "f46b",
    	"sym-fsn": "f46c",
    	"sym-ftc-s": "f46d",
    	"sym-ftc": "f46e",
    	"sym-fti-s": "f46f",
    	"sym-fti": "f470",
    	"sym-ftm-s": "f471",
    	"sym-ftm": "f472",
    	"sym-ftt-s": "f473",
    	"sym-ftt": "f474",
    	"sym-ftx-s": "f475",
    	"sym-ftx": "f476",
    	"sym-fuel-s": "f477",
    	"sym-fuel": "f478",
    	"sym-fun-s": "f479",
    	"sym-fun": "f47a",
    	"sym-fx-s": "f47b",
    	"sym-fx": "f47c",
    	"sym-fxc-s": "f47d",
    	"sym-fxc": "f47e",
    	"sym-fxs-s": "f47f",
    	"sym-fxs": "f480",
    	"sym-fxt-s": "f481",
    	"sym-fxt": "f482",
    	"sym-gal-s": "f483",
    	"sym-gal": "f484",
    	"sym-gala-s": "f485",
    	"sym-gala": "f486",
    	"sym-game-s": "f487",
    	"sym-game": "f488",
    	"sym-gamee-s": "f489",
    	"sym-gamee": "f48a",
    	"sym-gard-s": "f48b",
    	"sym-gard": "f48c",
    	"sym-gari-s": "f48d",
    	"sym-gari": "f48e",
    	"sym-gas-s": "f48f",
    	"sym-gas": "f490",
    	"sym-gbc-s": "f491",
    	"sym-gbc": "f492",
    	"sym-gbp-s": "f493",
    	"sym-gbp": "f494",
    	"sym-gbx-s": "f495",
    	"sym-gbx": "f496",
    	"sym-gbyte-s": "f497",
    	"sym-gbyte": "f498",
    	"sym-gc-s": "f499",
    	"sym-gc": "f49a",
    	"sym-gcc-s": "f49b",
    	"sym-gcc": "f49c",
    	"sym-ge-s": "f49d",
    	"sym-ge": "f49e",
    	"sym-geist-s": "f49f",
    	"sym-geist": "f4a0",
    	"sym-gen-s": "f4a1",
    	"sym-gen": "f4a2",
    	"sym-gene-s": "f4a3",
    	"sym-gene": "f4a4",
    	"sym-gens-s": "f4a5",
    	"sym-gens": "f4a6",
    	"sym-get-s": "f4a7",
    	"sym-get": "f4a8",
    	"sym-ghst-s": "f4a9",
    	"sym-ghst": "f4aa",
    	"sym-glc-s": "f4ab",
    	"sym-glc": "f4ac",
    	"sym-gld-s": "f4ad",
    	"sym-gld": "f4ae",
    	"sym-glm-s": "f4af",
    	"sym-glm": "f4b0",
    	"sym-glmr-s": "f4b1",
    	"sym-glmr": "f4b2",
    	"sym-gmat-s": "f4b3",
    	"sym-gmat": "f4b4",
    	"sym-gmt-s": "f4b5",
    	"sym-gmt": "f4b6",
    	"sym-gmt2-s": "f4b7",
    	"sym-gmt2": "f4b8",
    	"sym-gmx-s": "f4b9",
    	"sym-gmx": "f4ba",
    	"sym-gno-s": "f4bb",
    	"sym-gno": "f4bc",
    	"sym-gnt-s": "f4bd",
    	"sym-gnt": "f4be",
    	"sym-gnx-s": "f4bf",
    	"sym-gnx": "f4c0",
    	"sym-go-s": "f4c1",
    	"sym-go": "f4c2",
    	"sym-gods-s": "f4c3",
    	"sym-gods": "f4c4",
    	"sym-goo-s": "f4c5",
    	"sym-goo": "f4c6",
    	"sym-got-s": "f4c7",
    	"sym-got": "f4c8",
    	"sym-grc-s": "f4c9",
    	"sym-grc": "f4ca",
    	"sym-grin-s": "f4cb",
    	"sym-grin": "f4cc",
    	"sym-grs-s": "f4cd",
    	"sym-grs": "f4ce",
    	"sym-grt-s": "f4cf",
    	"sym-grt": "f4d0",
    	"sym-gsc-s": "f4d1",
    	"sym-gsc": "f4d2",
    	"sym-gst-s": "f4d3",
    	"sym-gst": "f4d4",
    	"sym-gt-s": "f4d5",
    	"sym-gt": "f4d6",
    	"sym-gtc-s": "f4d7",
    	"sym-gtc": "f4d8",
    	"sym-gtc2-s": "f4d9",
    	"sym-gtc2": "f4da",
    	"sym-gto-s": "f4db",
    	"sym-gto": "f4dc",
    	"sym-gup-s": "f4dd",
    	"sym-gup": "f4de",
    	"sym-gusd-s": "f4df",
    	"sym-gusd": "f4e0",
    	"sym-gvt-s": "f4e1",
    	"sym-gvt": "f4e2",
    	"sym-gxc-s": "f4e3",
    	"sym-gxc": "f4e4",
    	"sym-gxs-s": "f4e5",
    	"sym-gxs": "f4e6",
    	"sym-hard-s": "f4e7",
    	"sym-hard": "f4e8",
    	"sym-hbar-s": "f4e9",
    	"sym-hbar": "f4ea",
    	"sym-hc-s": "f4eb",
    	"sym-hc": "f4ec",
    	"sym-hdx-s": "f4ed",
    	"sym-hdx": "f4ee",
    	"sym-hedg-s": "f4ef",
    	"sym-hedg": "f4f0",
    	"sym-hegic-s": "f4f1",
    	"sym-hegic": "f4f2",
    	"sym-hex-s": "f4f3",
    	"sym-hex": "f4f4",
    	"sym-hft-s": "f4f5",
    	"sym-hft": "f4f6",
    	"sym-hg-s": "f4f7",
    	"sym-hg": "f4f8",
    	"sym-hgs-s": "f4f9",
    	"sym-hgs": "f4fa",
    	"sym-hh-s": "f4fb",
    	"sym-hh": "f4fc",
    	"sym-high-s": "f4fd",
    	"sym-high": "f4fe",
    	"sym-hit-s": "f4ff",
    	"sym-hit": "f500",
    	"sym-hive-s": "f501",
    	"sym-hive": "f502",
    	"sym-hkd-s": "f503",
    	"sym-hkd": "f504",
    	"sym-hko-s": "f505",
    	"sym-hko": "f506",
    	"sym-hmq-s": "f507",
    	"sym-hmq": "f508",
    	"sym-hns-s": "f509",
    	"sym-hns": "f50a",
    	"sym-ho-s": "f50b",
    	"sym-ho": "f50c",
    	"sym-hopr-s": "f50d",
    	"sym-hopr": "f50e",
    	"sym-hot-s": "f50f",
    	"sym-hot": "f510",
    	"sym-hp-s": "f511",
    	"sym-hp": "f512",
    	"sym-hpb-s": "f513",
    	"sym-hpb": "f514",
    	"sym-hpc-s": "f515",
    	"sym-hpc": "f516",
    	"sym-hpt-s": "f517",
    	"sym-hpt": "f518",
    	"sym-hrc-s": "f519",
    	"sym-hrc": "f51a",
    	"sym-hsc-s": "f51b",
    	"sym-hsc": "f51c",
    	"sym-hsr-s": "f51d",
    	"sym-hsr": "f51e",
    	"sym-hst-s": "f51f",
    	"sym-hst": "f520",
    	"sym-ht-s": "f521",
    	"sym-ht": "f522",
    	"sym-html-s": "f523",
    	"sym-html": "f524",
    	"sym-htt-s": "f525",
    	"sym-htt": "f526",
    	"sym-huc-s": "f527",
    	"sym-huc": "f528",
    	"sym-hunt-s": "f529",
    	"sym-hunt": "f52a",
    	"sym-hvn-s": "f52b",
    	"sym-hvn": "f52c",
    	"sym-hxro-s": "f52d",
    	"sym-hxro": "f52e",
    	"sym-hyc-s": "f52f",
    	"sym-hyc": "f530",
    	"sym-hydra-s": "f531",
    	"sym-hydra": "f532",
    	"sym-hydro-s": "f533",
    	"sym-hydro": "f534",
    	"sym-icn-s": "f535",
    	"sym-icn": "f536",
    	"sym-icos-s": "f537",
    	"sym-icos": "f538",
    	"sym-icp-s": "f539",
    	"sym-icp": "f53a",
    	"sym-icx-s": "f53b",
    	"sym-icx": "f53c",
    	"sym-idex-s": "f53d",
    	"sym-idex": "f53e",
    	"sym-idh-s": "f53f",
    	"sym-idh": "f540",
    	"sym-idr-s": "f541",
    	"sym-idr": "f542",
    	"sym-ift-s": "f543",
    	"sym-ift": "f544",
    	"sym-ignis-s": "f545",
    	"sym-ignis": "f546",
    	"sym-ihf-s": "f547",
    	"sym-ihf": "f548",
    	"sym-iht-s": "f549",
    	"sym-iht": "f54a",
    	"sym-ilc-s": "f54b",
    	"sym-ilc": "f54c",
    	"sym-ilv-s": "f54d",
    	"sym-ilv": "f54e",
    	"sym-imx-s": "f54f",
    	"sym-imx": "f550",
    	"sym-incnt-s": "f551",
    	"sym-incnt": "f552",
    	"sym-ind-s": "f553",
    	"sym-ind": "f554",
    	"sym-indi-s": "f555",
    	"sym-indi": "f556",
    	"sym-inj-s": "f557",
    	"sym-inj": "f558",
    	"sym-ink-s": "f559",
    	"sym-ink": "f55a",
    	"sym-inr-s": "f55b",
    	"sym-inr": "f55c",
    	"sym-ins-s": "f55d",
    	"sym-ins": "f55e",
    	"sym-int-s": "f55f",
    	"sym-int": "f560",
    	"sym-intr-s": "f561",
    	"sym-intr": "f562",
    	"sym-ioc-s": "f563",
    	"sym-ioc": "f564",
    	"sym-ion-s": "f565",
    	"sym-ion": "f566",
    	"sym-iost-s": "f567",
    	"sym-iost": "f568",
    	"sym-iot-s": "f569",
    	"sym-iot": "f56a",
    	"sym-iotx-s": "f56b",
    	"sym-iotx": "f56c",
    	"sym-iq-s": "f56d",
    	"sym-iq": "f56e",
    	"sym-iris-s": "f56f",
    	"sym-iris": "f570",
    	"sym-itc-s": "f571",
    	"sym-itc": "f572",
    	"sym-ivy-s": "f573",
    	"sym-ivy": "f574",
    	"sym-ixt-s": "f575",
    	"sym-ixt": "f576",
    	"sym-jasmy-s": "f577",
    	"sym-jasmy": "f578",
    	"sym-jnt-s": "f579",
    	"sym-jnt": "f57a",
    	"sym-joe-s": "f57b",
    	"sym-joe": "f57c",
    	"sym-jpeg-s": "f57d",
    	"sym-jpeg": "f57e",
    	"sym-jpy-s": "f57f",
    	"sym-jpy": "f580",
    	"sym-jst-s": "f581",
    	"sym-jst": "f582",
    	"sym-juno-s": "f583",
    	"sym-juno": "f584",
    	"sym-just-s": "f585",
    	"sym-just": "f586",
    	"sym-juv-s": "f587",
    	"sym-juv": "f588",
    	"sym-kan-s": "f589",
    	"sym-kan": "f58a",
    	"sym-kapex-s": "f58b",
    	"sym-kapex": "f58c",
    	"sym-kar-s": "f58d",
    	"sym-kar": "f58e",
    	"sym-kava-s": "f58f",
    	"sym-kava": "f590",
    	"sym-kbc-s": "f591",
    	"sym-kbc": "f592",
    	"sym-kcash-s": "f593",
    	"sym-kcash": "f594",
    	"sym-kda-s": "f595",
    	"sym-kda": "f596",
    	"sym-keep-s": "f597",
    	"sym-keep": "f598",
    	"sym-key-s": "f599",
    	"sym-key": "f59a",
    	"sym-kick-s": "f59b",
    	"sym-kick": "f59c",
    	"sym-kilt-s": "f59d",
    	"sym-kilt": "f59e",
    	"sym-kin-s": "f59f",
    	"sym-kin": "f5a0",
    	"sym-kint-s": "f5a1",
    	"sym-kint": "f5a2",
    	"sym-klay-s": "f5a3",
    	"sym-klay": "f5a4",
    	"sym-kma-s": "f5a5",
    	"sym-kma": "f5a6",
    	"sym-kmd-s": "f5a7",
    	"sym-kmd": "f5a8",
    	"sym-knc-s": "f5a9",
    	"sym-knc": "f5aa",
    	"sym-kore-s": "f5ab",
    	"sym-kore": "f5ac",
    	"sym-kp3r-s": "f5ad",
    	"sym-kp3r": "f5ae",
    	"sym-krm-s": "f5af",
    	"sym-krm": "f5b0",
    	"sym-krw-s": "f5b1",
    	"sym-krw": "f5b2",
    	"sym-ksm-s": "f5b3",
    	"sym-ksm": "f5b4",
    	"sym-ksx-s": "f5b5",
    	"sym-ksx": "f5b6",
    	"sym-kyl-s": "f5b7",
    	"sym-kyl": "f5b8",
    	"sym-la-s": "f5b9",
    	"sym-la": "f5ba",
    	"sym-lak-s": "f5bb",
    	"sym-lak": "f5bc",
    	"sym-lamb-s": "f5bd",
    	"sym-lamb": "f5be",
    	"sym-latx-s": "f5bf",
    	"sym-latx": "f5c0",
    	"sym-layr-s": "f5c1",
    	"sym-layr": "f5c2",
    	"sym-lba-s": "f5c3",
    	"sym-lba": "f5c4",
    	"sym-lbc-s": "f5c5",
    	"sym-lbc": "f5c6",
    	"sym-lcc-s": "f5c7",
    	"sym-lcc": "f5c8",
    	"sym-lcx-s": "f5c9",
    	"sym-lcx": "f5ca",
    	"sym-ldo-s": "f5cb",
    	"sym-ldo": "f5cc",
    	"sym-lend-s": "f5cd",
    	"sym-lend": "f5ce",
    	"sym-leo-s": "f5cf",
    	"sym-leo": "f5d0",
    	"sym-leoc-s": "f5d1",
    	"sym-leoc": "f5d2",
    	"sym-let-s": "f5d3",
    	"sym-let": "f5d4",
    	"sym-life-s": "f5d5",
    	"sym-life": "f5d6",
    	"sym-lina-s": "f5d7",
    	"sym-lina": "f5d8",
    	"sym-link-s": "f5d9",
    	"sym-link": "f5da",
    	"sym-lit-s": "f5db",
    	"sym-lit": "f5dc",
    	"sym-lmc-s": "f5dd",
    	"sym-lmc": "f5de",
    	"sym-lml-s": "f5df",
    	"sym-lml": "f5e0",
    	"sym-lmwr-s": "f5e1",
    	"sym-lmwr": "f5e2",
    	"sym-lnc-s": "f5e3",
    	"sym-lnc": "f5e4",
    	"sym-lnd-s": "f5e5",
    	"sym-lnd": "f5e6",
    	"sym-loc-s": "f5e7",
    	"sym-loc": "f5e8",
    	"sym-loka-s": "f5e9",
    	"sym-loka": "f5ea",
    	"sym-looks-s": "f5eb",
    	"sym-looks": "f5ec",
    	"sym-loom-s": "f5ed",
    	"sym-loom": "f5ee",
    	"sym-lpt-s": "f5ef",
    	"sym-lpt": "f5f0",
    	"sym-lqty-s": "f5f1",
    	"sym-lqty": "f5f2",
    	"sym-lrc-s": "f5f3",
    	"sym-lrc": "f5f4",
    	"sym-lrn-s": "f5f5",
    	"sym-lrn": "f5f6",
    	"sym-lseth-s": "f5f7",
    	"sym-lseth": "f5f8",
    	"sym-lsk-s": "f5f9",
    	"sym-lsk": "f5fa",
    	"sym-ltc-s": "f5fb",
    	"sym-ltc": "f5fc",
    	"sym-lto-s": "f5fd",
    	"sym-lto": "f5fe",
    	"sym-lun-s": "f5ff",
    	"sym-lun": "f600",
    	"sym-luna-s": "f601",
    	"sym-luna": "f602",
    	"sym-luna2-s": "f603",
    	"sym-luna2": "f604",
    	"sym-lxt-s": "f605",
    	"sym-lxt": "f606",
    	"sym-lym-s": "f607",
    	"sym-lym": "f608",
    	"sym-m2k-s": "f609",
    	"sym-m2k": "f60a",
    	"sym-ma-s": "f60b",
    	"sym-ma": "f60c",
    	"sym-magic-s": "f60d",
    	"sym-magic": "f60e",
    	"sym-maid-s": "f60f",
    	"sym-maid": "f610",
    	"sym-man-s": "f611",
    	"sym-man": "f612",
    	"sym-mana-s": "f613",
    	"sym-mana": "f614",
    	"sym-maps-s": "f615",
    	"sym-maps": "f616",
    	"sym-mask-s": "f617",
    	"sym-mask": "f618",
    	"sym-mass-s": "f619",
    	"sym-mass": "f61a",
    	"sym-math-s": "f61b",
    	"sym-math": "f61c",
    	"sym-matic-s": "f61d",
    	"sym-matic": "f61e",
    	"sym-mbl-s": "f61f",
    	"sym-mbl": "f620",
    	"sym-mbt-s": "f621",
    	"sym-mbt": "f622",
    	"sym-mc-s": "f623",
    	"sym-mc": "f624",
    	"sym-mco-s": "f625",
    	"sym-mco": "f626",
    	"sym-mda-s": "f627",
    	"sym-mda": "f628",
    	"sym-mds-s": "f629",
    	"sym-mds": "f62a",
    	"sym-mdt-s": "f62b",
    	"sym-mdt": "f62c",
    	"sym-mdx-s": "f62d",
    	"sym-mdx": "f62e",
    	"sym-med-s": "f62f",
    	"sym-med": "f630",
    	"sym-mer-s": "f631",
    	"sym-mer": "f632",
    	"sym-mes-s": "f633",
    	"sym-mes": "f634",
    	"sym-met-s": "f635",
    	"sym-met": "f636",
    	"sym-meta-s": "f637",
    	"sym-meta": "f638",
    	"sym-metis-s": "f639",
    	"sym-metis": "f63a",
    	"sym-mft-s": "f63b",
    	"sym-mft": "f63c",
    	"sym-mgc-s": "f63d",
    	"sym-mgc": "f63e",
    	"sym-mgo-s": "f63f",
    	"sym-mgo": "f640",
    	"sym-mhc-s": "f641",
    	"sym-mhc": "f642",
    	"sym-mina-s": "f643",
    	"sym-mina": "f644",
    	"sym-mir-s": "f645",
    	"sym-mir": "f646",
    	"sym-mith-s": "f647",
    	"sym-mith": "f648",
    	"sym-mitx-s": "f649",
    	"sym-mitx": "f64a",
    	"sym-mjp-s": "f64b",
    	"sym-mjp": "f64c",
    	"sym-mkr-s": "f64d",
    	"sym-mkr": "f64e",
    	"sym-mln-s": "f64f",
    	"sym-mln": "f650",
    	"sym-mngo-s": "f651",
    	"sym-mngo": "f652",
    	"sym-mnx-s": "f653",
    	"sym-mnx": "f654",
    	"sym-moac-s": "f655",
    	"sym-moac": "f656",
    	"sym-mob-s": "f657",
    	"sym-mob": "f658",
    	"sym-mobi-s": "f659",
    	"sym-mobi": "f65a",
    	"sym-moc-s": "f65b",
    	"sym-moc": "f65c",
    	"sym-mod-s": "f65d",
    	"sym-mod": "f65e",
    	"sym-mona-s": "f65f",
    	"sym-mona": "f660",
    	"sym-moon-s": "f661",
    	"sym-moon": "f662",
    	"sym-morph-s": "f663",
    	"sym-morph": "f664",
    	"sym-movr-s": "f665",
    	"sym-movr": "f666",
    	"sym-mpl-s": "f667",
    	"sym-mpl": "f668",
    	"sym-mrk-s": "f669",
    	"sym-mrk": "f66a",
    	"sym-msol-s": "f66b",
    	"sym-msol": "f66c",
    	"sym-msp-s": "f66d",
    	"sym-msp": "f66e",
    	"sym-mta-s": "f66f",
    	"sym-mta": "f670",
    	"sym-mtc-s": "f671",
    	"sym-mtc": "f672",
    	"sym-mth-s": "f673",
    	"sym-mth": "f674",
    	"sym-mtl-s": "f675",
    	"sym-mtl": "f676",
    	"sym-mtn-s": "f677",
    	"sym-mtn": "f678",
    	"sym-mtx-s": "f679",
    	"sym-mtx": "f67a",
    	"sym-mue-s": "f67b",
    	"sym-mue": "f67c",
    	"sym-multi-s": "f67d",
    	"sym-multi": "f67e",
    	"sym-mv-s": "f67f",
    	"sym-mv": "f680",
    	"sym-mx-s": "f681",
    	"sym-mx": "f682",
    	"sym-mxc-s": "f683",
    	"sym-mxc": "f684",
    	"sym-mxm-s": "f685",
    	"sym-mxm": "f686",
    	"sym-mxn-s": "f687",
    	"sym-mxn": "f688",
    	"sym-myr-s": "f689",
    	"sym-myr": "f68a",
    	"sym-n9l-s": "f68b",
    	"sym-n9l": "f68c",
    	"sym-nanj-s": "f68d",
    	"sym-nanj": "f68e",
    	"sym-nano-s": "f68f",
    	"sym-nano": "f690",
    	"sym-nas-s": "f691",
    	"sym-nas": "f692",
    	"sym-naut-s": "f693",
    	"sym-naut": "f694",
    	"sym-nav-s": "f695",
    	"sym-nav": "f696",
    	"sym-ncash-s": "f697",
    	"sym-ncash": "f698",
    	"sym-nct-s": "f699",
    	"sym-nct": "f69a",
    	"sym-near-s": "f69b",
    	"sym-near": "f69c",
    	"sym-nebl-s": "f69d",
    	"sym-nebl": "f69e",
    	"sym-nec-s": "f69f",
    	"sym-nec": "f6a0",
    	"sym-neo-s": "f6a1",
    	"sym-neo": "f6a2",
    	"sym-neos-s": "f6a3",
    	"sym-neos": "f6a4",
    	"sym-nest-s": "f6a5",
    	"sym-nest": "f6a6",
    	"sym-neu-s": "f6a7",
    	"sym-neu": "f6a8",
    	"sym-new-s": "f6a9",
    	"sym-new": "f6aa",
    	"sym-nexo-s": "f6ab",
    	"sym-nexo": "f6ac",
    	"sym-nft-s": "f6ad",
    	"sym-nft": "f6ae",
    	"sym-ng-s": "f6af",
    	"sym-ng": "f6b0",
    	"sym-ngc-s": "f6b1",
    	"sym-ngc": "f6b2",
    	"sym-ngn-s": "f6b3",
    	"sym-ngn": "f6b4",
    	"sym-nim-s": "f6b5",
    	"sym-nim": "f6b6",
    	"sym-niy-s": "f6b7",
    	"sym-niy": "f6b8",
    	"sym-nkd-s": "f6b9",
    	"sym-nkd": "f6ba",
    	"sym-nkn-s": "f6bb",
    	"sym-nkn": "f6bc",
    	"sym-nlc2-s": "f6bd",
    	"sym-nlc2": "f6be",
    	"sym-nlg-s": "f6bf",
    	"sym-nlg": "f6c0",
    	"sym-nmc-s": "f6c1",
    	"sym-nmc": "f6c2",
    	"sym-nmr-s": "f6c3",
    	"sym-nmr": "f6c4",
    	"sym-nn-s": "f6c5",
    	"sym-nn": "f6c6",
    	"sym-noah-s": "f6c7",
    	"sym-noah": "f6c8",
    	"sym-nodl-s": "f6c9",
    	"sym-nodl": "f6ca",
    	"sym-note-s": "f6cb",
    	"sym-note": "f6cc",
    	"sym-npg-s": "f6cd",
    	"sym-npg": "f6ce",
    	"sym-nplc-s": "f6cf",
    	"sym-nplc": "f6d0",
    	"sym-npxs-s": "f6d1",
    	"sym-npxs": "f6d2",
    	"sym-nq-s": "f6d3",
    	"sym-nq": "f6d4",
    	"sym-nrg-s": "f6d5",
    	"sym-nrg": "f6d6",
    	"sym-ntk-s": "f6d7",
    	"sym-ntk": "f6d8",
    	"sym-nu-s": "f6d9",
    	"sym-nu": "f6da",
    	"sym-nuls-s": "f6db",
    	"sym-nuls": "f6dc",
    	"sym-nvc-s": "f6dd",
    	"sym-nvc": "f6de",
    	"sym-nxc-s": "f6df",
    	"sym-nxc": "f6e0",
    	"sym-nxs-s": "f6e1",
    	"sym-nxs": "f6e2",
    	"sym-nxt-s": "f6e3",
    	"sym-nxt": "f6e4",
    	"sym-nym-s": "f6e5",
    	"sym-nym": "f6e6",
    	"sym-o-s": "f6e7",
    	"sym-o": "f6e8",
    	"sym-oak-s": "f6e9",
    	"sym-oak": "f6ea",
    	"sym-oax-s": "f6eb",
    	"sym-oax": "f6ec",
    	"sym-ocean-s": "f6ed",
    	"sym-ocean": "f6ee",
    	"sym-ocn-s": "f6ef",
    	"sym-ocn": "f6f0",
    	"sym-ode-s": "f6f1",
    	"sym-ode": "f6f2",
    	"sym-ogn-s": "f6f3",
    	"sym-ogn": "f6f4",
    	"sym-ogo-s": "f6f5",
    	"sym-ogo": "f6f6",
    	"sym-ok-s": "f6f7",
    	"sym-ok": "f6f8",
    	"sym-okb-s": "f6f9",
    	"sym-okb": "f6fa",
    	"sym-om-s": "f6fb",
    	"sym-om": "f6fc",
    	"sym-omg-s": "f6fd",
    	"sym-omg": "f6fe",
    	"sym-omni-s": "f6ff",
    	"sym-omni": "f700",
    	"sym-one-s": "f701",
    	"sym-one": "f702",
    	"sym-ong-s": "f703",
    	"sym-ong": "f704",
    	"sym-onot-s": "f705",
    	"sym-onot": "f706",
    	"sym-ont-s": "f707",
    	"sym-ont": "f708",
    	"sym-ooki-s": "f709",
    	"sym-ooki": "f70a",
    	"sym-op-s": "f70b",
    	"sym-op": "f70c",
    	"sym-orbs-s": "f70d",
    	"sym-orbs": "f70e",
    	"sym-orca-s": "f70f",
    	"sym-orca": "f710",
    	"sym-orme-s": "f711",
    	"sym-orme": "f712",
    	"sym-orn-s": "f713",
    	"sym-orn": "f714",
    	"sym-ors-s": "f715",
    	"sym-ors": "f716",
    	"sym-osmo-s": "f717",
    	"sym-osmo": "f718",
    	"sym-ost-s": "f719",
    	"sym-ost": "f71a",
    	"sym-otn-s": "f71b",
    	"sym-otn": "f71c",
    	"sym-oxt-s": "f71d",
    	"sym-oxt": "f71e",
    	"sym-oxy-s": "f71f",
    	"sym-oxy": "f720",
    	"sym-pai-s": "f721",
    	"sym-pai": "f722",
    	"sym-pal-s": "f723",
    	"sym-pal": "f724",
    	"sym-paper-s": "f725",
    	"sym-paper": "f726",
    	"sym-para-s": "f727",
    	"sym-para": "f728",
    	"sym-part-s": "f729",
    	"sym-part": "f72a",
    	"sym-pasc-s": "f72b",
    	"sym-pasc": "f72c",
    	"sym-pat-s": "f72d",
    	"sym-pat": "f72e",
    	"sym-pax-s": "f72f",
    	"sym-pax": "f730",
    	"sym-paxg-s": "f731",
    	"sym-paxg": "f732",
    	"sym-pay-s": "f733",
    	"sym-pay": "f734",
    	"sym-pbt-s": "f735",
    	"sym-pbt": "f736",
    	"sym-pcl-s": "f737",
    	"sym-pcl": "f738",
    	"sym-pcx-s": "f739",
    	"sym-pcx": "f73a",
    	"sym-pdex-s": "f73b",
    	"sym-pdex": "f73c",
    	"sym-people-s": "f73d",
    	"sym-people": "f73e",
    	"sym-pepe-s": "f73f",
    	"sym-pepe": "f740",
    	"sym-perl-s": "f741",
    	"sym-perl": "f742",
    	"sym-perp-s": "f743",
    	"sym-perp": "f744",
    	"sym-pha-s": "f745",
    	"sym-pha": "f746",
    	"sym-phb-s": "f747",
    	"sym-phb": "f748",
    	"sym-php-s": "f749",
    	"sym-php": "f74a",
    	"sym-phx-s": "f74b",
    	"sym-phx": "f74c",
    	"sym-pi-s": "f74d",
    	"sym-pi": "f74e",
    	"sym-pica-s": "f74f",
    	"sym-pica": "f750",
    	"sym-pink-s": "f751",
    	"sym-pink": "f752",
    	"sym-pivx-s": "f753",
    	"sym-pivx": "f754",
    	"sym-pkt-s": "f755",
    	"sym-pkt": "f756",
    	"sym-pl-s": "f757",
    	"sym-pl": "f758",
    	"sym-pla-s": "f759",
    	"sym-pla": "f75a",
    	"sym-plbt-s": "f75b",
    	"sym-plbt": "f75c",
    	"sym-plm-s": "f75d",
    	"sym-plm": "f75e",
    	"sym-pln-s": "f75f",
    	"sym-pln": "f760",
    	"sym-plr-s": "f761",
    	"sym-plr": "f762",
    	"sym-ply-s": "f763",
    	"sym-ply": "f764",
    	"sym-pma-s": "f765",
    	"sym-pma": "f766",
    	"sym-png-s": "f767",
    	"sym-png": "f768",
    	"sym-pnt-s": "f769",
    	"sym-pnt": "f76a",
    	"sym-poa-s": "f76b",
    	"sym-poa": "f76c",
    	"sym-poe-s": "f76d",
    	"sym-poe": "f76e",
    	"sym-polis-s": "f76f",
    	"sym-polis": "f770",
    	"sym-pols-s": "f771",
    	"sym-pols": "f772",
    	"sym-poly-s": "f773",
    	"sym-poly": "f774",
    	"sym-pond-s": "f775",
    	"sym-pond": "f776",
    	"sym-pot-s": "f777",
    	"sym-pot": "f778",
    	"sym-powr-s": "f779",
    	"sym-powr": "f77a",
    	"sym-ppc-s": "f77b",
    	"sym-ppc": "f77c",
    	"sym-ppt-s": "f77d",
    	"sym-ppt": "f77e",
    	"sym-pra-s": "f77f",
    	"sym-pra": "f780",
    	"sym-pre-s": "f781",
    	"sym-pre": "f782",
    	"sym-prg-s": "f783",
    	"sym-prg": "f784",
    	"sym-pro-s": "f785",
    	"sym-pro": "f786",
    	"sym-prq-s": "f787",
    	"sym-prq": "f788",
    	"sym-pst-s": "f789",
    	"sym-pst": "f78a",
    	"sym-pstake-s": "f78b",
    	"sym-pstake": "f78c",
    	"sym-pton-s": "f78d",
    	"sym-pton": "f78e",
    	"sym-pundix-s": "f78f",
    	"sym-pundix": "f790",
    	"sym-pvt-s": "f791",
    	"sym-pvt": "f792",
    	"sym-pxg-s": "f793",
    	"sym-pxg": "f794",
    	"sym-pyr-s": "f795",
    	"sym-pyr": "f796",
    	"sym-qash-s": "f797",
    	"sym-qash": "f798",
    	"sym-qau-s": "f799",
    	"sym-qau": "f79a",
    	"sym-qc-s": "f79b",
    	"sym-qc": "f79c",
    	"sym-qi-s": "f79d",
    	"sym-qi": "f79e",
    	"sym-qi2-s": "f79f",
    	"sym-qi2": "f7a0",
    	"sym-qkc-s": "f7a1",
    	"sym-qkc": "f7a2",
    	"sym-qlc-s": "f7a3",
    	"sym-qlc": "f7a4",
    	"sym-qnt-s": "f7a5",
    	"sym-qnt": "f7a6",
    	"sym-qntu-s": "f7a7",
    	"sym-qntu": "f7a8",
    	"sym-qo-s": "f7a9",
    	"sym-qo": "f7aa",
    	"sym-qrdo-s": "f7ab",
    	"sym-qrdo": "f7ac",
    	"sym-qrl-s": "f7ad",
    	"sym-qrl": "f7ae",
    	"sym-qsp-s": "f7af",
    	"sym-qsp": "f7b0",
    	"sym-qtum-s": "f7b1",
    	"sym-qtum": "f7b2",
    	"sym-quick-s": "f7b3",
    	"sym-quick": "f7b4",
    	"sym-qun-s": "f7b5",
    	"sym-qun": "f7b6",
    	"sym-r-s": "f7b7",
    	"sym-r": "f7b8",
    	"sym-rad-s": "f7b9",
    	"sym-rad": "f7ba",
    	"sym-radar-s": "f7bb",
    	"sym-radar": "f7bc",
    	"sym-rads-s": "f7bd",
    	"sym-rads": "f7be",
    	"sym-ramp-s": "f7bf",
    	"sym-ramp": "f7c0",
    	"sym-rare-s": "f7c1",
    	"sym-rare": "f7c2",
    	"sym-rari-s": "f7c3",
    	"sym-rari": "f7c4",
    	"sym-rating-s": "f7c5",
    	"sym-rating": "f7c6",
    	"sym-ray-s": "f7c7",
    	"sym-ray": "f7c8",
    	"sym-rb-s": "f7c9",
    	"sym-rb": "f7ca",
    	"sym-rbc-s": "f7cb",
    	"sym-rbc": "f7cc",
    	"sym-rblx-s": "f7cd",
    	"sym-rblx": "f7ce",
    	"sym-rbn-s": "f7cf",
    	"sym-rbn": "f7d0",
    	"sym-rbtc-s": "f7d1",
    	"sym-rbtc": "f7d2",
    	"sym-rby-s": "f7d3",
    	"sym-rby": "f7d4",
    	"sym-rcn-s": "f7d5",
    	"sym-rcn": "f7d6",
    	"sym-rdd-s": "f7d7",
    	"sym-rdd": "f7d8",
    	"sym-rdn-s": "f7d9",
    	"sym-rdn": "f7da",
    	"sym-real-s": "f7db",
    	"sym-real": "f7dc",
    	"sym-reef-s": "f7dd",
    	"sym-reef": "f7de",
    	"sym-rem-s": "f7df",
    	"sym-rem": "f7e0",
    	"sym-ren-s": "f7e1",
    	"sym-ren": "f7e2",
    	"sym-rep-s": "f7e3",
    	"sym-rep": "f7e4",
    	"sym-repv2-s": "f7e5",
    	"sym-repv2": "f7e6",
    	"sym-req-s": "f7e7",
    	"sym-req": "f7e8",
    	"sym-rev-s": "f7e9",
    	"sym-rev": "f7ea",
    	"sym-revv-s": "f7eb",
    	"sym-revv": "f7ec",
    	"sym-rfox-s": "f7ed",
    	"sym-rfox": "f7ee",
    	"sym-rfr-s": "f7ef",
    	"sym-rfr": "f7f0",
    	"sym-ric-s": "f7f1",
    	"sym-ric": "f7f2",
    	"sym-rif-s": "f7f3",
    	"sym-rif": "f7f4",
    	"sym-ring-s": "f7f5",
    	"sym-ring": "f7f6",
    	"sym-rlc-s": "f7f7",
    	"sym-rlc": "f7f8",
    	"sym-rly-s": "f7f9",
    	"sym-rly": "f7fa",
    	"sym-rmrk-s": "f7fb",
    	"sym-rmrk": "f7fc",
    	"sym-rndr-s": "f7fd",
    	"sym-rndr": "f7fe",
    	"sym-rntb-s": "f7ff",
    	"sym-rntb": "f800",
    	"sym-ron-s": "f801",
    	"sym-ron": "f802",
    	"sym-rook-s": "f803",
    	"sym-rook": "f804",
    	"sym-rose-s": "f805",
    	"sym-rose": "f806",
    	"sym-rox-s": "f807",
    	"sym-rox": "f808",
    	"sym-rp-s": "f809",
    	"sym-rp": "f80a",
    	"sym-rpl-s": "f80b",
    	"sym-rpl": "f80c",
    	"sym-rpx-s": "f80d",
    	"sym-rpx": "f80e",
    	"sym-rsr-s": "f80f",
    	"sym-rsr": "f810",
    	"sym-rsv-s": "f811",
    	"sym-rsv": "f812",
    	"sym-rty-s": "f813",
    	"sym-rty": "f814",
    	"sym-rub-s": "f815",
    	"sym-rub": "f816",
    	"sym-ruff-s": "f817",
    	"sym-ruff": "f818",
    	"sym-rune-s": "f819",
    	"sym-rune": "f81a",
    	"sym-rvn-s": "f81b",
    	"sym-rvn": "f81c",
    	"sym-rvr-s": "f81d",
    	"sym-rvr": "f81e",
    	"sym-rvt-s": "f81f",
    	"sym-rvt": "f820",
    	"sym-sai-s": "f821",
    	"sym-sai": "f822",
    	"sym-salt-s": "f823",
    	"sym-salt": "f824",
    	"sym-samo-s": "f825",
    	"sym-samo": "f826",
    	"sym-san-s": "f827",
    	"sym-san": "f828",
    	"sym-sand-s": "f829",
    	"sym-sand": "f82a",
    	"sym-sat-s": "f82b",
    	"sym-sat": "f82c",
    	"sym-sbd-s": "f82d",
    	"sym-sbd": "f82e",
    	"sym-sbr-s": "f82f",
    	"sym-sbr": "f830",
    	"sym-sc-s": "f831",
    	"sym-sc": "f832",
    	"sym-scc-s": "f833",
    	"sym-scc": "f834",
    	"sym-scrt-s": "f835",
    	"sym-scrt": "f836",
    	"sym-sdc-s": "f837",
    	"sym-sdc": "f838",
    	"sym-sdn-s": "f839",
    	"sym-sdn": "f83a",
    	"sym-seele-s": "f83b",
    	"sym-seele": "f83c",
    	"sym-sei-s": "f83d",
    	"sym-sei": "f83e",
    	"sym-sek-s": "f83f",
    	"sym-sek": "f840",
    	"sym-sen-s": "f841",
    	"sym-sen": "f842",
    	"sym-sent-s": "f843",
    	"sym-sent": "f844",
    	"sym-sero-s": "f845",
    	"sym-sero": "f846",
    	"sym-sexc-s": "f847",
    	"sym-sexc": "f848",
    	"sym-sfp-s": "f849",
    	"sym-sfp": "f84a",
    	"sym-sgb-s": "f84b",
    	"sym-sgb": "f84c",
    	"sym-sgc-s": "f84d",
    	"sym-sgc": "f84e",
    	"sym-sgd-s": "f84f",
    	"sym-sgd": "f850",
    	"sym-sgn-s": "f851",
    	"sym-sgn": "f852",
    	"sym-sgu-s": "f853",
    	"sym-sgu": "f854",
    	"sym-shib-s": "f855",
    	"sym-shib": "f856",
    	"sym-shift-s": "f857",
    	"sym-shift": "f858",
    	"sym-ship-s": "f859",
    	"sym-ship": "f85a",
    	"sym-shping-s": "f85b",
    	"sym-shping": "f85c",
    	"sym-si-s": "f85d",
    	"sym-si": "f85e",
    	"sym-sib-s": "f85f",
    	"sym-sib": "f860",
    	"sym-sil-s": "f861",
    	"sym-sil": "f862",
    	"sym-six-s": "f863",
    	"sym-six": "f864",
    	"sym-sjcx-s": "f865",
    	"sym-sjcx": "f866",
    	"sym-skl-s": "f867",
    	"sym-skl": "f868",
    	"sym-skm-s": "f869",
    	"sym-skm": "f86a",
    	"sym-sku-s": "f86b",
    	"sym-sku": "f86c",
    	"sym-sky-s": "f86d",
    	"sym-sky": "f86e",
    	"sym-slp-s": "f86f",
    	"sym-slp": "f870",
    	"sym-slr-s": "f871",
    	"sym-slr": "f872",
    	"sym-sls-s": "f873",
    	"sym-sls": "f874",
    	"sym-slt-s": "f875",
    	"sym-slt": "f876",
    	"sym-slv-s": "f877",
    	"sym-slv": "f878",
    	"sym-smart-s": "f879",
    	"sym-smart": "f87a",
    	"sym-smn-s": "f87b",
    	"sym-smn": "f87c",
    	"sym-smt-s": "f87d",
    	"sym-smt": "f87e",
    	"sym-snc-s": "f87f",
    	"sym-snc": "f880",
    	"sym-snet-s": "f881",
    	"sym-snet": "f882",
    	"sym-sngls-s": "f883",
    	"sym-sngls": "f884",
    	"sym-snm-s": "f885",
    	"sym-snm": "f886",
    	"sym-snt-s": "f887",
    	"sym-snt": "f888",
    	"sym-snx-s": "f889",
    	"sym-snx": "f88a",
    	"sym-soc-s": "f88b",
    	"sym-soc": "f88c",
    	"sym-socks-s": "f88d",
    	"sym-socks": "f88e",
    	"sym-sol-s": "f88f",
    	"sym-sol": "f890",
    	"sym-solid-s": "f891",
    	"sym-solid": "f892",
    	"sym-solo-s": "f893",
    	"sym-solo": "f894",
    	"sym-solve-s": "f895",
    	"sym-solve": "f896",
    	"sym-sos-s": "f897",
    	"sym-sos": "f898",
    	"sym-soul-s": "f899",
    	"sym-soul": "f89a",
    	"sym-sp-s": "f89b",
    	"sym-sp": "f89c",
    	"sym-sparta-s": "f89d",
    	"sym-sparta": "f89e",
    	"sym-spc-s": "f89f",
    	"sym-spc": "f8a0",
    	"sym-spd-s": "f8a1",
    	"sym-spd": "f8a2",
    	"sym-spell-s": "f8a3",
    	"sym-spell": "f8a4",
    	"sym-sphr-s": "f8a5",
    	"sym-sphr": "f8a6",
    	"sym-sphtx-s": "f8a7",
    	"sym-sphtx": "f8a8",
    	"sym-spnd-s": "f8a9",
    	"sym-spnd": "f8aa",
    	"sym-spnk-s": "f8ab",
    	"sym-spnk": "f8ac",
    	"sym-srm-s": "f8ad",
    	"sym-srm": "f8ae",
    	"sym-srn-s": "f8af",
    	"sym-srn": "f8b0",
    	"sym-ssp-s": "f8b1",
    	"sym-ssp": "f8b2",
    	"sym-ssv-s": "f8b3",
    	"sym-ssv": "f8b4",
    	"sym-stacs-s": "f8b5",
    	"sym-stacs": "f8b6",
    	"sym-step-s": "f8b7",
    	"sym-step": "f8b8",
    	"sym-stg-s": "f8b9",
    	"sym-stg": "f8ba",
    	"sym-stmx-s": "f8bb",
    	"sym-stmx": "f8bc",
    	"sym-storm-s": "f8bd",
    	"sym-storm": "f8be",
    	"sym-stpt-s": "f8bf",
    	"sym-stpt": "f8c0",
    	"sym-stq-s": "f8c1",
    	"sym-stq": "f8c2",
    	"sym-str-s": "f8c3",
    	"sym-str": "f8c4",
    	"sym-strat-s": "f8c5",
    	"sym-strat": "f8c6",
    	"sym-strax-s": "f8c7",
    	"sym-strax": "f8c8",
    	"sym-strk-s": "f8c9",
    	"sym-strk": "f8ca",
    	"sym-strong-s": "f8cb",
    	"sym-strong": "f8cc",
    	"sym-stx-s": "f8cd",
    	"sym-stx": "f8ce",
    	"sym-sub-s": "f8cf",
    	"sym-sub": "f8d0",
    	"sym-sui-s": "f8d1",
    	"sym-sui": "f8d2",
    	"sym-sun-s": "f8d3",
    	"sym-sun": "f8d4",
    	"sym-super-s": "f8d5",
    	"sym-super": "f8d6",
    	"sym-susd-s": "f8d7",
    	"sym-susd": "f8d8",
    	"sym-sushi-s": "f8d9",
    	"sym-sushi": "f8da",
    	"sym-swftc-s": "f8db",
    	"sym-swftc": "f8dc",
    	"sym-swm-s": "f8dd",
    	"sym-swm": "f8de",
    	"sym-swrv-s": "f8df",
    	"sym-swrv": "f8e0",
    	"sym-swt-s": "f8e1",
    	"sym-swt": "f8e2",
    	"sym-swth-s": "f8e3",
    	"sym-swth": "f8e4",
    	"sym-sxp-s": "f8e5",
    	"sym-sxp": "f8e6",
    	"sym-syn-s": "f8e7",
    	"sym-syn": "f8e8",
    	"sym-sys-s": "f8e9",
    	"sym-sys": "f8ea",
    	"sym-t-s": "f8eb",
    	"sym-t": "f8ec",
    	"sym-taas-s": "f8ed",
    	"sym-taas": "f8ee",
    	"sym-tau-s": "f8ef",
    	"sym-tau": "f8f0",
    	"sym-tbtc-s": "f8f1",
    	"sym-tbtc": "f8f2",
    	"sym-tct-s": "f8f3",
    	"sym-tct": "f8f4",
    	"sym-teer-s": "f8f5",
    	"sym-teer": "f8f6",
    	"sym-tel-s": "f8f7",
    	"sym-temco-s": "f8f8",
    	"sym-temco": "f8f9",
    	"sym-tfuel-s": "f8fa",
    	"sym-tfuel": "f8fb",
    	"sym-thb-s": "f8fc",
    	"sym-thb": "f8fd",
    	"sym-thc-s": "f8fe",
    	"sym-thc": "f8ff",
    	"sym-theta-s": "f900",
    	"sym-theta": "f901",
    	"sym-thx-s": "f902",
    	"sym-thx": "f903",
    	"sym-time-s": "f904",
    	"sym-time": "f905",
    	"sym-tio-s": "f906",
    	"sym-tio": "f907",
    	"sym-tix-s": "f908",
    	"sym-tix": "f909",
    	"sym-tkn-s": "f90a",
    	"sym-tkn": "f90b",
    	"sym-tky-s": "f90c",
    	"sym-tky": "f90d",
    	"sym-tlm-s": "f90e",
    	"sym-tlm": "f90f",
    	"sym-tnb-s": "f910",
    	"sym-tnb": "f911",
    	"sym-tnc-s": "f912",
    	"sym-tnc": "f913",
    	"sym-tnt-s": "f914",
    	"sym-tnt": "f915",
    	"sym-toke-s": "f916",
    	"sym-toke": "f917",
    	"sym-tomb-s": "f918",
    	"sym-tomb": "f919",
    	"sym-tomo-s": "f91a",
    	"sym-tomo": "f91b",
    	"sym-top-s": "f91c",
    	"sym-top": "f91d",
    	"sym-torn-s": "f91e",
    	"sym-torn": "f91f",
    	"sym-tower-s": "f920",
    	"sym-tower": "f921",
    	"sym-tpay-s": "f922",
    	"sym-tpay": "f923",
    	"sym-trac-s": "f924",
    	"sym-trac": "f925",
    	"sym-trb-s": "f926",
    	"sym-trb": "f927",
    	"sym-tribe-s": "f928",
    	"sym-tribe": "f929",
    	"sym-trig-s": "f92a",
    	"sym-trig": "f92b",
    	"sym-trio-s": "f92c",
    	"sym-trio": "f92d",
    	"sym-troy-s": "f92e",
    	"sym-troy": "f92f",
    	"sym-trst-s": "f930",
    	"sym-trst": "f931",
    	"sym-tru-s": "f932",
    	"sym-tru": "f933",
    	"sym-true-s": "f934",
    	"sym-true": "f935",
    	"sym-trx-s": "f936",
    	"sym-trx": "f937",
    	"sym-try-s": "f938",
    	"sym-try": "f939",
    	"sym-tryb-s": "f93a",
    	"sym-tryb": "f93b",
    	"sym-tt-s": "f93c",
    	"sym-tt": "f93d",
    	"sym-ttc-s": "f93e",
    	"sym-ttc": "f93f",
    	"sym-ttt-s": "f940",
    	"sym-ttt": "f941",
    	"sym-ttu-s": "f942",
    	"sym-ttu": "f943",
    	"sym-tube-s": "f944",
    	"sym-tube": "f945",
    	"sym-tusd-s": "f946",
    	"sym-tusd": "f947",
    	"sym-tvk-s": "f948",
    	"sym-tvk": "f949",
    	"sym-twt-s": "f94a",
    	"sym-twt": "f94b",
    	"sym-uah-s": "f94c",
    	"sym-uah": "f94d",
    	"sym-ubq-s": "f94e",
    	"sym-ubq": "f94f",
    	"sym-ubt-s": "f950",
    	"sym-ubt": "f951",
    	"sym-uft-s": "f952",
    	"sym-uft": "f953",
    	"sym-ugas-s": "f954",
    	"sym-ugas": "f955",
    	"sym-uip-s": "f956",
    	"sym-uip": "f957",
    	"sym-ukg-s": "f958",
    	"sym-ukg": "f959",
    	"sym-uma-s": "f95a",
    	"sym-uma": "f95b",
    	"sym-umami-s": "f95c",
    	"sym-umami": "f95d",
    	"sym-unfi-s": "f95e",
    	"sym-unfi": "f95f",
    	"sym-uni-s": "f960",
    	"sym-uni": "f961",
    	"sym-unq-s": "f962",
    	"sym-unq": "f963",
    	"sym-up-s": "f964",
    	"sym-up": "f965",
    	"sym-upp-s": "f966",
    	"sym-upp": "f967",
    	"sym-usd-s": "f968",
    	"sym-usd": "f969",
    	"sym-usdc-s": "f96a",
    	"sym-usdc": "f96b",
    	"sym-usds-s": "f96c",
    	"sym-usds": "f96d",
    	"sym-usk-s": "f96e",
    	"sym-usk": "f96f",
    	"sym-ust-s": "f970",
    	"sym-ust": "f971",
    	"sym-utk-s": "f972",
    	"sym-utk": "f973",
    	"sym-utnp-s": "f974",
    	"sym-utnp": "f975",
    	"sym-utt-s": "f976",
    	"sym-utt": "f977",
    	"sym-uuu-s": "f978",
    	"sym-uuu": "f979",
    	"sym-ux-s": "f97a",
    	"sym-ux": "f97b",
    	"sym-vader-s": "f97c",
    	"sym-vader": "f97d",
    	"sym-vai-s": "f97e",
    	"sym-vai": "f97f",
    	"sym-vbk-s": "f980",
    	"sym-vbk": "f981",
    	"sym-vdx-s": "f982",
    	"sym-vdx": "f983",
    	"sym-vee-s": "f984",
    	"sym-vee": "f985",
    	"sym-vemp-s": "f986",
    	"sym-vemp": "f987",
    	"sym-ven-s": "f988",
    	"sym-ven": "f989",
    	"sym-veo-s": "f98a",
    	"sym-veo": "f98b",
    	"sym-veri-s": "f98c",
    	"sym-veri": "f98d",
    	"sym-vex-s": "f98e",
    	"sym-vex": "f98f",
    	"sym-vgx-s": "f990",
    	"sym-vgx": "f991",
    	"sym-via-s": "f992",
    	"sym-via": "f993",
    	"sym-vib-s": "f994",
    	"sym-vib": "f995",
    	"sym-vibe-s": "f996",
    	"sym-vibe": "f997",
    	"sym-vid-s": "f998",
    	"sym-vid": "f999",
    	"sym-vidt-s": "f99a",
    	"sym-vidt": "f99b",
    	"sym-vidy-s": "f99c",
    	"sym-vidy": "f99d",
    	"sym-vitae-s": "f99e",
    	"sym-vitae": "f99f",
    	"sym-vite-s": "f9a0",
    	"sym-vite": "f9a1",
    	"sym-vlx-s": "f9a2",
    	"sym-vlx": "f9a3",
    	"sym-vox-s": "f9a4",
    	"sym-vox": "f9a5",
    	"sym-voxel-s": "f9a6",
    	"sym-voxel": "f9a7",
    	"sym-vra-s": "f9a8",
    	"sym-vra": "f9a9",
    	"sym-vrc-s": "f9aa",
    	"sym-vrc": "f9ab",
    	"sym-vrm-s": "f9ac",
    	"sym-vrm": "f9ad",
    	"sym-vsys-s": "f9ae",
    	"sym-vsys": "f9af",
    	"sym-vtc-s": "f9b0",
    	"sym-vtc": "f9b1",
    	"sym-vtho-s": "f9b2",
    	"sym-vtho": "f9b3",
    	"sym-wabi-s": "f9b4",
    	"sym-wabi": "f9b5",
    	"sym-wan-s": "f9b6",
    	"sym-wan": "f9b7",
    	"sym-waves-s": "f9b8",
    	"sym-waves": "f9b9",
    	"sym-wax-s": "f9ba",
    	"sym-wax": "f9bb",
    	"sym-wbtc-s": "f9bc",
    	"sym-wbtc": "f9bd",
    	"sym-wet-s": "f9be",
    	"sym-wet": "f9bf",
    	"sym-weth-s": "f9c0",
    	"sym-weth": "f9c1",
    	"sym-wib-s": "f9c2",
    	"sym-wib": "f9c3",
    	"sym-wicc-s": "f9c4",
    	"sym-wicc": "f9c5",
    	"sym-win-s": "f9c6",
    	"sym-win": "f9c7",
    	"sym-wing-s": "f9c8",
    	"sym-wing": "f9c9",
    	"sym-wings-s": "f9ca",
    	"sym-wings": "f9cb",
    	"sym-wnxm-s": "f9cc",
    	"sym-wnxm": "f9cd",
    	"sym-woo-s": "f9ce",
    	"sym-woo": "f9cf",
    	"sym-wpr-s": "f9d0",
    	"sym-wpr": "f9d1",
    	"sym-wrx-s": "f9d2",
    	"sym-wrx": "f9d3",
    	"sym-wtc-s": "f9d4",
    	"sym-wtc": "f9d5",
    	"sym-wtt-s": "f9d6",
    	"sym-wtt": "f9d7",
    	"sym-wwb-s": "f9d8",
    	"sym-wwb": "f9d9",
    	"sym-wxt-s": "f9da",
    	"sym-wxt": "f9db",
    	"sym-xas-s": "f9dc",
    	"sym-xas": "f9dd",
    	"sym-xaur-s": "f9de",
    	"sym-xaur": "f9df",
    	"sym-xaut-s": "f9e0",
    	"sym-xaut": "f9e1",
    	"sym-xava-s": "f9e2",
    	"sym-xava": "f9e3",
    	"sym-xbc-s": "f9e4",
    	"sym-xbc": "f9e5",
    	"sym-xcn-s": "f9e6",
    	"sym-xcn": "f9e7",
    	"sym-xcon-s": "f9e8",
    	"sym-xcon": "f9e9",
    	"sym-xcp-s": "f9ea",
    	"sym-xcp": "f9eb",
    	"sym-xdefi-s": "f9ec",
    	"sym-xdefi": "f9ed",
    	"sym-xdn-s": "f9ee",
    	"sym-xdn": "f9ef",
    	"sym-xel-s": "f9f0",
    	"sym-xel": "f9f1",
    	"sym-xem-s": "f9f2",
    	"sym-xem": "f9f3",
    	"sym-xes-s": "f9f4",
    	"sym-xes": "f9f5",
    	"sym-xhv-s": "f9f6",
    	"sym-xhv": "f9f7",
    	"sym-xin-s": "f9f8",
    	"sym-xin": "f9f9",
    	"sym-xlm-s": "f9fa",
    	"sym-xlm": "f9fb",
    	"sym-xmc-s": "f9fc",
    	"sym-xmc": "f9fd",
    	"sym-xmr-s": "f9fe",
    	"sym-xmr": "f9ff",
    	"sym-xmx-s": "fa00",
    	"sym-xmx": "fa01",
    	"sym-xmy-s": "fa02",
    	"sym-xmy": "fa03",
    	"sym-xnk-s": "fa04",
    	"sym-xnk": "fa05",
    	"sym-xns-s": "fa06",
    	"sym-xns": "fa07",
    	"sym-xor-s": "fa08",
    	"sym-xor": "fa09",
    	"sym-xos-s": "fa0a",
    	"sym-xos": "fa0b",
    	"sym-xpm-s": "fa0c",
    	"sym-xpm": "fa0d",
    	"sym-xpr-s": "fa0e",
    	"sym-xpr": "fa0f",
    	"sym-xrc-s": "fa10",
    	"sym-xrc": "fa11",
    	"sym-xrp-s": "fa12",
    	"sym-xrp": "fa13",
    	"sym-xrpx-s": "fa14",
    	"sym-xrpx": "fa15",
    	"sym-xrt-s": "fa16",
    	"sym-xrt": "fa17",
    	"sym-xst-s": "fa18",
    	"sym-xst": "fa19",
    	"sym-xtp-s": "fa1a",
    	"sym-xtp": "fa1b",
    	"sym-xtz-s": "fa1c",
    	"sym-xtz": "fa1d",
    	"sym-xtzdown-s": "fa1e",
    	"sym-xtzdown": "fa1f",
    	"sym-xvc-s": "fa20",
    	"sym-xvc": "fa21",
    	"sym-xvg-s": "fa22",
    	"sym-xvg": "fa23",
    	"sym-xvs-s": "fa24",
    	"sym-xvs": "fa25",
    	"sym-xwc-s": "fa26",
    	"sym-xwc": "fa27",
    	"sym-xyo-s": "fa28",
    	"sym-xyo": "fa29",
    	"sym-xzc-s": "fa2a",
    	"sym-xzc": "fa2b",
    	"sym-yam-s": "fa2c",
    	"sym-yam": "fa2d",
    	"sym-yee-s": "fa2e",
    	"sym-yee": "fa2f",
    	"sym-yeed-s": "fa30",
    	"sym-yeed": "fa31",
    	"sym-yfi-s": "fa32",
    	"sym-yfi": "fa33",
    	"sym-yfii-s": "fa34",
    	"sym-yfii": "fa35",
    	"sym-ygg-s": "fa36",
    	"sym-ygg": "fa37",
    	"sym-yoyow-s": "fa38",
    	"sym-yoyow": "fa39",
    	"sym-zar-s": "fa3a",
    	"sym-zar": "fa3b",
    	"sym-zcl-s": "fa3c",
    	"sym-zcl": "fa3d",
    	"sym-zcn-s": "fa3e",
    	"sym-zcn": "fa3f",
    	"sym-zco-s": "fa40",
    	"sym-zco": "fa41",
    	"sym-zec-s": "fa42",
    	"sym-zec": "fa43",
    	"sym-zen-s": "fa44",
    	"sym-zen": "fa45",
    	"sym-zil-s": "fa46",
    	"sym-zil": "fa47",
    	"sym-zks-s": "fa48",
    	"sym-zks": "fa49",
    	"sym-zla-s": "fa4a",
    	"sym-zla": "fa4b",
    	"sym-zlk": "fa4c",
    	"sym-zondo-s": "fa4d",
    	"sym-zondo": "fa4e",
    	"sym-zpr-s": "fa4f",
    	"sym-zpr": "fa50",
    	"sym-zpt-s": "fa51",
    	"sym-zpt": "fa52",
    	"sym-zrc-s": "fa53",
    	"sym-zrc": "fa54",
    	"sym-zrx-s": "fa55",
    	"sym-zrx": "fa56",
    	"sym-zsc-s": "fa57",
    	"sym-zsc": "fa58",
    	"sym-ztg-s": "fa59",
    	"sym-ztg": "fa5a",
    	"ustc-s": "fa5b",
    	ustc: ustc,
    	"cur-anct": "f1da",
    	"cur-anct-s": "f1d9",
    	"cur-aud": "f20c",
    	"cur-aud-s": "f20b",
    	"cur-bnb": "f281",
    	"cur-bnb-s": "f280",
    	"sym-xbt": "f2ab",
    	"cur-btc": "f2ab",
    	"sym-xbt-s": "f2aa",
    	"cur-btc-s": "f2aa",
    	"cur-busd": "f2cb",
    	"cur-busd-s": "f2ca",
    	"exc-bitz": "f2cf",
    	"cur-bz": "f2cf",
    	"exc-bitz-s": "f2ce",
    	"cur-bz-s": "f2ce",
    	"cur-cad": "f2d9",
    	"cur-cad-s": "f2d8",
    	"cur-chf": "f2f9",
    	"cur-chf-s": "f2f8",
    	"cur-cny": "f31d",
    	"cur-cny-s": "f31c",
    	"sym-cs": "f331",
    	"sym-cs-s": "f330",
    	"sym-crm": "f349",
    	"sym-crm-s": "f348",
    	"cur-dai": "f379",
    	"cur-dai-s": "f378",
    	"sym-xdg": "f3b7",
    	"sym-xdg-s": "f3b6",
    	"cur-eos": "f404",
    	"cur-eos-s": "f403",
    	"sym-eth2": "f414",
    	"sym-eth2s": "f414",
    	"sym-eth2.s": "f414",
    	"cur-eth": "f414",
    	"sym-eth2-s": "f413",
    	"sym-eth2s-s": "f413",
    	"sym-eth2.s-s": "f413",
    	"cur-eth-s": "f413",
    	"cur-eur": "f420",
    	"cur-eur-s": "f41f",
    	"cur-eurs": "f424",
    	"cur-eurs-s": "f423",
    	"sym-usdt": "f426",
    	"cur-usdt": "f426",
    	"sym-usdt-s": "f425",
    	"cur-usdt-s": "f425",
    	"exc-kraken": "f43e",
    	"exc-kraken-futures": "f43e",
    	"exc-kraken-s": "f43d",
    	"exc-kraken-futures-s": "f43d",
    	"cur-gbp": "f494",
    	"cur-gbp-s": "f493",
    	"exc-gemini": "f4e0",
    	"cur-gusd": "f4e0",
    	"exc-gemini-s": "f4df",
    	"cur-gusd-s": "f4df",
    	"cur-hkd": "f504",
    	"cur-hkd-s": "f503",
    	"sym-husd": "f522",
    	"exc-huobi": "f522",
    	"cur-ht": "f522",
    	"sym-husd-s": "f521",
    	"exc-huobi-s": "f521",
    	"cur-ht-s": "f521",
    	"cur-idr": "f542",
    	"cur-idr-s": "f541",
    	"sym-iota": "f56a",
    	"sym-iota-s": "f569",
    	"cur-inr": "f55c",
    	"cur-inr-s": "f55b",
    	"cur-jpy": "f580",
    	"cur-jpy-s": "f57f",
    	"cur-krw": "f5b2",
    	"cur-krw-s": "f5b1",
    	"sym-medx": "f630",
    	"sym-medx-s": "f62f",
    	"cur-mxn": "f688",
    	"cur-mxn-s": "f687",
    	"cur-myr": "f68a",
    	"cur-myr-s": "f689",
    	"cur-ngn": "f6b4",
    	"cur-ngn-s": "f6b3",
    	"cur-pax": "f730",
    	"cur-pax-s": "f72f",
    	"cur-php": "f74a",
    	"cur-php-s": "f749",
    	"cur-pln": "f760",
    	"cur-pln-s": "f75f",
    	"cur-qash": "f798",
    	"cur-qash-s": "f797",
    	"cur-rub": "f816",
    	"cur-rur": "f816",
    	"cur-rub-s": "f815",
    	"cur-rur-s": "f815",
    	"sym-steem": "f82e",
    	"sym-steem-s": "f82d",
    	"sym-xsc": "f832",
    	"sym-xsc-s": "f831",
    	"cur-sgd": "f850",
    	"cur-sgd-s": "f84f",
    	"sym-storj": "f866",
    	"sym-storj-s": "f865",
    	"sym-tel": "f8ee",
    	"cur-trx": "f937",
    	"cur-trx-s": "f936",
    	"cur-tusd": "f947",
    	"cur-tusd-s": "f946",
    	"cur-usd": "f969",
    	"cur-usd-s": "f968",
    	"cur-usdc": "f96b",
    	"cur-usdc-s": "f96a",
    	"sym-vet": "f989",
    	"sym-vet-s": "f988",
    	"sym-waxp": "f9bb",
    	"sym-waxp-s": "f9ba",
    	"cur-xlm": "f9fb",
    	"cur-xlm-s": "f9fa",
    	"cur-xmr": "f9ff",
    	"cur-xmr-s": "f9fe",
    	"cur-xrp": "fa13",
    	"cur-xrp-s": "fa12",
    	"cur-zar": "fa3b",
    	"cur-zar-s": "fa3a",
    	"exc-binance-us": "f10a",
    	"exc-binance-us-s": "f109",
    	"exc-mexbt": "f120",
    	"exc-mexbt-s": "f11f",
    	"exc-coinbase-pro": "f12e",
    	"exc-gdax": "f12e",
    	"exc-coinbase-pro-s": "f12d",
    	"exc-gdax-s": "f12d",
    	"exc-quadriga": "f15c",
    	"exc-quadriga-s": "f15b",
    	"cur-crc": "f33d",
    	"cur-crc-s": "f33c",
    	"cur-lak": "f5bc",
    	"cur-lak-s": "f5bb",
    	"cur-sek": "f840",
    	"cur-sek-s": "f83f",
    	"cur-thb": "f8fd",
    	"cur-thb-s": "f8fc",
    	"cur-try": "f939",
    	"cur-try-s": "f938",
    	"cur-uah": "f94d",
    	"cur-uah-s": "f94c",
    	"exc-ftx": "f474",
    	"exc-ftx-s": "f473",
    	"exc-ftx-us": "f474",
    	"exc-ftx-us-s": "f473",
    	"sym-cgld": "f2e9",
    	"sym-cgld-s": "f2e8",
    	"exc-uniswap-v2": "f961",
    	"exc-uniswap-v2-s": "f960",
    	"sym-kshib": "f856",
    	"sym-kshib-s": "f855",
    	"sym-easy-s": "f3d8",
    	"sym-srare": "f7c2",
    	"sym-srare-s": "f7c1",
    	"sym-ape.2": "f1e0",
    	"sym-ape.2-s": "f1df",
    	"cur-sat": "f82c",
    	"cur-sat-s": "f82b"
    };

    var _default = "";
    var d = "";
    var amex = "";
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
    var nasdaq = "";
    var nbatopshop = "";
    var nymex = "NYMEX (Beta)";
    var nyse = "";
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
    var auto = "Autoharvest Finance";
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
    var bcc = "Basis Coin";
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
    var egld = "MultiversX";
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
    var pepe = "Pepe";
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
    var sei = "";
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
    var sxp = "Solar";
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
    	amex: amex,
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
    	nasdaq: nasdaq,
    	nbatopshop: nbatopshop,
    	nymex: nymex,
    	nyse: nyse,
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
    	pepe: pepe,
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
    	sei: sei,
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
    	"coinbase-pro": "",
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
