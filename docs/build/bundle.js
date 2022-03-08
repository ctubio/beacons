
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
    	"sym-_default-s": "f15f",
    	"sym-_default": "f160",
    	"sym-d": "f160",
    	"sym-d-s": "f15f",
    	"sym-default": "f160",
    	"sym-default-s": "f15f",
    	"exc-d": "f102",
    	"exc-d-s": "f101",
    	"exc-default": "f102",
    	"exc-default-s": "f101",
    	"cur-default": "f160",
    	"cur-default-s": "f15f",
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
    	"exc-cryptofacilities-s": "f12b",
    	"exc-cryptofacilities": "f12c",
    	"exc-deribit-s": "f12d",
    	"exc-deribit": "f12e",
    	"exc-dex-aggregated-s": "f12f",
    	"exc-dex-aggregated": "f130",
    	"exc-gateio-s": "f131",
    	"exc-gateio": "f132",
    	"exc-hitbtc-s": "f133",
    	"exc-hitbtc": "f134",
    	"exc-kucoin-s": "f135",
    	"exc-kucoin": "f136",
    	"exc-liquid-s": "f137",
    	"exc-liquid": "f138",
    	"exc-luno-s": "f139",
    	"exc-luno": "f13a",
    	"exc-mtgox-s": "f13b",
    	"exc-mtgox": "f13c",
    	"exc-mxc-s": "f13d",
    	"exc-mxc": "f13e",
    	"exc-nbatopshop-s": "f13f",
    	"exc-nbatopshop": "f140",
    	"exc-nymex-s": "f141",
    	"exc-nymex": "f142",
    	"exc-okcoin-s": "f143",
    	"exc-okcoin": "f144",
    	"exc-okx-s": "f145",
    	"exc-okx": "f146",
    	"exc-opensea-s": "f147",
    	"exc-opensea": "f148",
    	"exc-poloniex-s": "f149",
    	"exc-poloniex": "f14a",
    	"exc-qryptos-s": "f14b",
    	"exc-qryptos": "f14c",
    	"exc-quadrigacx-s": "f14d",
    	"exc-quadrigacx": "f14e",
    	"exc-quoine-s": "f14f",
    	"exc-quoine": "f150",
    	"exc-rarible-s": "f151",
    	"exc-rarible": "f152",
    	"exc-totle-s": "f153",
    	"exc-totle": "f154",
    	"exc-upbit-s": "f155",
    	"exc-upbit": "f156",
    	"exc-vaultofsatoshi-s": "f157",
    	"exc-vaultofsatoshi": "f158",
    	"exc-wex-s": "f159",
    	"exc-wex": "f15a",
    	"exc-zaif-s": "f15b",
    	"exc-zaif": "f15c",
    	"exc-zonda-s": "f15d",
    	"exc-zonda": "f15e",
    	"sym-1inch-s": "f161",
    	"sym-1inch": "f162",
    	"sym-1st-s": "f163",
    	"sym-1st": "f164",
    	"sym-6a-s": "f165",
    	"sym-6a": "f166",
    	"sym-6b-s": "f167",
    	"sym-6b": "f168",
    	"sym-6c-s": "f169",
    	"sym-6c": "f16a",
    	"sym-6e-s": "f16b",
    	"sym-6e": "f16c",
    	"sym-6j-s": "f16d",
    	"sym-6j": "f16e",
    	"sym-6l-s": "f16f",
    	"sym-6l": "f170",
    	"sym-6m-s": "f171",
    	"sym-6m": "f172",
    	"sym-6n-s": "f173",
    	"sym-6n": "f174",
    	"sym-6s-s": "f175",
    	"sym-6s": "f176",
    	"sym-a38-s": "f177",
    	"sym-a38": "f178",
    	"sym-aac-s": "f179",
    	"sym-aac": "f17a",
    	"sym-aave-s": "f17b",
    	"sym-aave": "f17c",
    	"sym-abbc-s": "f17d",
    	"sym-abbc": "f17e",
    	"sym-abt-s": "f17f",
    	"sym-abt": "f180",
    	"sym-abyss-s": "f181",
    	"sym-abyss": "f182",
    	"sym-aca-s": "f183",
    	"sym-aca": "f184",
    	"sym-acat-s": "f185",
    	"sym-acat": "f186",
    	"sym-ach-s": "f187",
    	"sym-ach": "f188",
    	"sym-act-s": "f189",
    	"sym-act": "f18a",
    	"sym-ad0-s": "f18b",
    	"sym-ad0": "f18c",
    	"sym-ada-s": "f18d",
    	"sym-ada": "f18e",
    	"sym-adel-s": "f18f",
    	"sym-adel": "f190",
    	"sym-adh-s": "f191",
    	"sym-adh": "f192",
    	"sym-adm-s": "f193",
    	"sym-adm": "f194",
    	"sym-ado-s": "f195",
    	"sym-ado": "f196",
    	"sym-adt-s": "f197",
    	"sym-adt": "f198",
    	"sym-adx-s": "f199",
    	"sym-adx": "f19a",
    	"sym-ae-s": "f19b",
    	"sym-ae": "f19c",
    	"sym-aeon-s": "f19d",
    	"sym-aeon": "f19e",
    	"sym-aep-s": "f19f",
    	"sym-aep": "f1a0",
    	"sym-aergo-s": "f1a1",
    	"sym-aergo": "f1a2",
    	"sym-agi-s": "f1a3",
    	"sym-agi": "f1a4",
    	"sym-aid-s": "f1a5",
    	"sym-aid": "f1a6",
    	"sym-aion-s": "f1a7",
    	"sym-aion": "f1a8",
    	"sym-air-s": "f1a9",
    	"sym-air": "f1aa",
    	"sym-akro-s": "f1ab",
    	"sym-akro": "f1ac",
    	"sym-akt-s": "f1ad",
    	"sym-akt": "f1ae",
    	"sym-alcx-s": "f1af",
    	"sym-alcx": "f1b0",
    	"sym-algo-s": "f1b1",
    	"sym-algo": "f1b2",
    	"sym-ali-s": "f1b3",
    	"sym-ali": "f1b4",
    	"sym-alice-s": "f1b5",
    	"sym-alice": "f1b6",
    	"sym-alpha-s": "f1b7",
    	"sym-alpha": "f1b8",
    	"sym-amb-s": "f1b9",
    	"sym-amb": "f1ba",
    	"sym-amlt-s": "f1bb",
    	"sym-amlt": "f1bc",
    	"sym-amp-s": "f1bd",
    	"sym-amp": "f1be",
    	"sym-ampl-s": "f1bf",
    	"sym-ampl": "f1c0",
    	"sym-anct-s": "f1c1",
    	"sym-anct": "f1c2",
    	"sym-ankr-s": "f1c3",
    	"sym-ankr": "f1c4",
    	"sym-ant-s": "f1c5",
    	"sym-ant": "f1c6",
    	"sym-ape-s": "f1c7",
    	"sym-ape": "f1c8",
    	"sym-api3-s": "f1c9",
    	"sym-api3": "f1ca",
    	"sym-apis-s": "f1cb",
    	"sym-apis": "f1cc",
    	"sym-appc-s": "f1cd",
    	"sym-appc": "f1ce",
    	"sym-ar-s": "f1cf",
    	"sym-ar": "f1d0",
    	"sym-ardr-s": "f1d1",
    	"sym-ardr": "f1d2",
    	"sym-ark-s": "f1d3",
    	"sym-ark": "f1d4",
    	"sym-arn-s": "f1d5",
    	"sym-arn": "f1d6",
    	"sym-arpa-s": "f1d7",
    	"sym-arpa": "f1d8",
    	"sym-art-s": "f1d9",
    	"sym-art": "f1da",
    	"sym-aspt-s": "f1db",
    	"sym-aspt": "f1dc",
    	"sym-ast-s": "f1dd",
    	"sym-ast": "f1de",
    	"sym-astr-s": "f1df",
    	"sym-astr": "f1e0",
    	"sym-at-s": "f1e1",
    	"sym-at": "f1e2",
    	"sym-atlas-s": "f1e3",
    	"sym-atlas": "f1e4",
    	"sym-atm-s": "f1e5",
    	"sym-atm": "f1e6",
    	"sym-atom-s": "f1e7",
    	"sym-atom": "f1e8",
    	"sym-atp-s": "f1e9",
    	"sym-atp": "f1ea",
    	"sym-auction-s": "f1eb",
    	"sym-auction": "f1ec",
    	"sym-aud-s": "f1ed",
    	"sym-aud": "f1ee",
    	"sym-audio-s": "f1ef",
    	"sym-audio": "f1f0",
    	"sym-aup-s": "f1f1",
    	"sym-aup": "f1f2",
    	"sym-auto-s": "f1f3",
    	"sym-auto": "f1f4",
    	"sym-ava-s": "f1f5",
    	"sym-ava": "f1f6",
    	"sym-avax-s": "f1f7",
    	"sym-avax": "f1f8",
    	"sym-avt-s": "f1f9",
    	"sym-avt": "f1fa",
    	"sym-axp-s": "f1fb",
    	"sym-axp": "f1fc",
    	"sym-axs-s": "f1fd",
    	"sym-axs": "f1fe",
    	"sym-b": "f1ff",
    	"sym-b0-s": "f200",
    	"sym-b0": "f201",
    	"sym-b2g-s": "f202",
    	"sym-b2g": "f203",
    	"sym-bab-s": "f204",
    	"sym-bab": "f205",
    	"sym-badger-s": "f206",
    	"sym-badger": "f207",
    	"sym-bake-s": "f208",
    	"sym-bake": "f209",
    	"sym-bal-s": "f20a",
    	"sym-bal": "f20b",
    	"sym-banca-s": "f20c",
    	"sym-banca": "f20d",
    	"sym-band-s": "f20e",
    	"sym-band": "f20f",
    	"sym-bat-s": "f210",
    	"sym-bat": "f211",
    	"sym-bay-s": "f212",
    	"sym-bay": "f213",
    	"sym-bbc-s": "f214",
    	"sym-bbc": "f215",
    	"sym-bcc-s": "f216",
    	"sym-bcc": "f217",
    	"sym-bcd-s": "f218",
    	"sym-bcd": "f219",
    	"sym-bch-s": "f21a",
    	"sym-bch": "f21b",
    	"sym-bci-s": "f21c",
    	"sym-bci": "f21d",
    	"sym-bcn-s": "f21e",
    	"sym-bcn": "f21f",
    	"sym-bcpt-s": "f220",
    	"sym-bcpt": "f221",
    	"sym-bcu-s": "f222",
    	"sym-bcu": "f223",
    	"sym-bcv-s": "f224",
    	"sym-bcv": "f225",
    	"sym-bcy-s": "f226",
    	"sym-bcy": "f227",
    	"sym-bdg-s": "f228",
    	"sym-bdg": "f229",
    	"sym-beam-s": "f22a",
    	"sym-beam": "f22b",
    	"sym-beet-s": "f22c",
    	"sym-beet": "f22d",
    	"sym-bel-s": "f22e",
    	"sym-bel": "f22f",
    	"sym-bela-s": "f230",
    	"sym-bela": "f231",
    	"sym-berry-s": "f232",
    	"sym-berry": "f233",
    	"sym-betr-s": "f234",
    	"sym-betr": "f235",
    	"sym-bez-s": "f236",
    	"sym-bez": "f237",
    	"sym-bft-s": "f238",
    	"sym-bft": "f239",
    	"sym-bfx-s": "f23a",
    	"sym-bfx": "f23b",
    	"sym-bhd-s": "f23c",
    	"sym-bhd": "f23d",
    	"sym-bht-s": "f23e",
    	"sym-bht": "f23f",
    	"sym-bico-s": "f240",
    	"sym-bico": "f241",
    	"sym-bitb-s": "f242",
    	"sym-bitb": "f243",
    	"sym-bix-s": "f244",
    	"sym-bix": "f245",
    	"sym-bk-s": "f246",
    	"sym-bk": "f247",
    	"sym-bkx-s": "f248",
    	"sym-bkx": "f249",
    	"sym-blk-s": "f24a",
    	"sym-blk": "f24b",
    	"sym-block-s": "f24c",
    	"sym-block": "f24d",
    	"sym-blt-s": "f24e",
    	"sym-blt": "f24f",
    	"sym-blz-s": "f250",
    	"sym-blz": "f251",
    	"sym-bmc-s": "f252",
    	"sym-bmc": "f253",
    	"sym-bnb-s": "f254",
    	"sym-bnb": "f255",
    	"sym-bnc-s": "f256",
    	"sym-bnc": "f257",
    	"sym-bnk-s": "f258",
    	"sym-bnk": "f259",
    	"sym-bnt-s": "f25a",
    	"sym-bnt": "f25b",
    	"sym-bo-s": "f25c",
    	"sym-bo": "f25d",
    	"sym-bond-s": "f25e",
    	"sym-bond": "f25f",
    	"sym-boo-s": "f260",
    	"sym-boo": "f261",
    	"sym-bor-s": "f262",
    	"sym-bor": "f263",
    	"sym-bora-s": "f264",
    	"sym-bora": "f265",
    	"sym-bos-s": "f266",
    	"sym-bos": "f267",
    	"sym-box-s": "f268",
    	"sym-box": "f269",
    	"sym-brd-s": "f26a",
    	"sym-brd": "f26b",
    	"sym-brg-s": "f26c",
    	"sym-brg": "f26d",
    	"sym-brick-s": "f26e",
    	"sym-brick": "f26f",
    	"sym-bsd-s": "f270",
    	"sym-bsd": "f271",
    	"sym-bsv-s": "f272",
    	"sym-bsv": "f273",
    	"sym-bsx-s": "f274",
    	"sym-bsx": "f275",
    	"sym-bt1-s": "f276",
    	"sym-bt1": "f277",
    	"sym-bt2-s": "f278",
    	"sym-bt2": "f279",
    	"sym-btc-s": "f27a",
    	"sym-btc": "f27b",
    	"sym-btcd-s": "f27c",
    	"sym-btcd": "f27d",
    	"sym-btcfx-s": "f27e",
    	"sym-btcfx": "f27f",
    	"sym-btcp-s": "f280",
    	"sym-btcp": "f281",
    	"sym-btg-s": "f282",
    	"sym-btg": "f283",
    	"sym-btm-s": "f284",
    	"sym-btm": "f285",
    	"sym-btn-s": "f286",
    	"sym-btn": "f287",
    	"sym-bto-s": "f288",
    	"sym-bto": "f289",
    	"sym-bts-s": "f28a",
    	"sym-bts": "f28b",
    	"sym-btt-s": "f28c",
    	"sym-btt": "f28d",
    	"sym-btu-s": "f28e",
    	"sym-btu": "f28f",
    	"sym-btx-s": "f290",
    	"sym-btx": "f291",
    	"sym-burger-s": "f292",
    	"sym-burger": "f293",
    	"sym-burst-s": "f294",
    	"sym-burst": "f295",
    	"sym-bus-s": "f296",
    	"sym-bus": "f297",
    	"sym-busd-s": "f298",
    	"sym-busd": "f299",
    	"sym-bwx-s": "f29a",
    	"sym-bwx": "f29b",
    	"sym-bz-s": "f29c",
    	"sym-bz": "f29d",
    	"sym-bzrx-s": "f29e",
    	"sym-bzrx": "f29f",
    	"sym-c-s": "f2a0",
    	"sym-c": "f2a1",
    	"sym-c20-s": "f2a2",
    	"sym-c20": "f2a3",
    	"sym-c98-s": "f2a4",
    	"sym-c98": "f2a5",
    	"sym-cad-s": "f2a6",
    	"sym-cad": "f2a7",
    	"sym-cake-s": "f2a8",
    	"sym-cake": "f2a9",
    	"sym-cas-s": "f2aa",
    	"sym-cas": "f2ab",
    	"sym-cat-s": "f2ac",
    	"sym-cat": "f2ad",
    	"sym-cbc-s": "f2ae",
    	"sym-cbc": "f2af",
    	"sym-cbt-s": "f2b0",
    	"sym-cbt": "f2b1",
    	"sym-cdt-s": "f2b2",
    	"sym-cdt": "f2b3",
    	"sym-cel-s": "f2b4",
    	"sym-cel": "f2b5",
    	"sym-celo-s": "f2b6",
    	"sym-celo": "f2b7",
    	"sym-celr-s": "f2b8",
    	"sym-celr": "f2b9",
    	"sym-cennz-s": "f2ba",
    	"sym-cennz": "f2bb",
    	"sym-cfg-s": "f2bc",
    	"sym-cfg": "f2bd",
    	"sym-cfi-s": "f2be",
    	"sym-cfi": "f2bf",
    	"sym-cfx-s": "f2c0",
    	"sym-cfx": "f2c1",
    	"sym-cgt-s": "f2c2",
    	"sym-cgt": "f2c3",
    	"sym-chat-s": "f2c4",
    	"sym-chat": "f2c5",
    	"sym-chf-s": "f2c6",
    	"sym-chf": "f2c7",
    	"sym-chp-s": "f2c8",
    	"sym-chp": "f2c9",
    	"sym-chr-s": "f2ca",
    	"sym-chr": "f2cb",
    	"sym-chsb-s": "f2cc",
    	"sym-chsb": "f2cd",
    	"sym-chx-s": "f2ce",
    	"sym-chx": "f2cf",
    	"sym-chz-s": "f2d0",
    	"sym-chz": "f2d1",
    	"sym-ckb-s": "f2d2",
    	"sym-ckb": "f2d3",
    	"sym-cl-s": "f2d4",
    	"sym-cl": "f2d5",
    	"sym-clam-s": "f2d6",
    	"sym-clam": "f2d7",
    	"sym-cln-s": "f2d8",
    	"sym-cln": "f2d9",
    	"sym-clo-s": "f2da",
    	"sym-clo": "f2db",
    	"sym-cloak-s": "f2dc",
    	"sym-cloak": "f2dd",
    	"sym-clv-s": "f2de",
    	"sym-clv": "f2df",
    	"sym-cmct-s": "f2e0",
    	"sym-cmct": "f2e1",
    	"sym-cmt-s": "f2e2",
    	"sym-cmt": "f2e3",
    	"sym-cnd-s": "f2e4",
    	"sym-cnd": "f2e5",
    	"sym-cnn-s": "f2e6",
    	"sym-cnn": "f2e7",
    	"sym-cnx-s": "f2e8",
    	"sym-cnx": "f2e9",
    	"sym-cny-s": "f2ea",
    	"sym-cny": "f2eb",
    	"sym-cob-s": "f2ec",
    	"sym-cob": "f2ed",
    	"sym-cocos-s": "f2ee",
    	"sym-cocos": "f2ef",
    	"sym-comp-s": "f2f0",
    	"sym-comp": "f2f1",
    	"sym-cos-s": "f2f2",
    	"sym-cos": "f2f3",
    	"sym-cosm-s": "f2f4",
    	"sym-cosm": "f2f5",
    	"sym-coss-s": "f2f6",
    	"sym-coss": "f2f7",
    	"sym-coti-s": "f2f8",
    	"sym-coti": "f2f9",
    	"sym-cov-s": "f2fa",
    	"sym-cov": "f2fb",
    	"sym-cova-s": "f2fc",
    	"sym-cova": "f2fd",
    	"sym-cpt-s": "f2fe",
    	"sym-cpt": "f2ff",
    	"sym-cpx-s": "f300",
    	"sym-cpx": "f301",
    	"sym-cqt-s": "f302",
    	"sym-cqt": "f303",
    	"sym-crc-s": "f304",
    	"sym-crc": "f305",
    	"sym-cre-s": "f306",
    	"sym-cre": "f307",
    	"sym-cream-s": "f308",
    	"sym-cream": "f309",
    	"sym-cring-s": "f30a",
    	"sym-cring": "f30b",
    	"sym-cro-s": "f30c",
    	"sym-cro": "f30d",
    	"sym-crpt-s": "f30e",
    	"sym-crpt": "f30f",
    	"sym-cru-s": "f310",
    	"sym-cru": "f311",
    	"sym-crv-s": "f312",
    	"sym-crv": "f313",
    	"sym-crw-s": "f314",
    	"sym-crw": "f315",
    	"sym-csm-s": "f316",
    	"sym-csm": "f317",
    	"sym-csx-s": "f318",
    	"sym-csx": "f319",
    	"sym-ctc-s": "f31a",
    	"sym-ctc": "f31b",
    	"sym-ctk-s": "f31c",
    	"sym-ctk": "f31d",
    	"sym-ctsi-s": "f31e",
    	"sym-ctsi": "f31f",
    	"sym-ctxc-s": "f320",
    	"sym-ctxc": "f321",
    	"sym-cur-s": "f322",
    	"sym-cur": "f323",
    	"sym-cvc-s": "f324",
    	"sym-cvc": "f325",
    	"sym-cvcoin-s": "f326",
    	"sym-cvcoin": "f327",
    	"sym-cvnt-s": "f328",
    	"sym-cvnt": "f329",
    	"sym-cvp-s": "f32a",
    	"sym-cvp": "f32b",
    	"sym-cvt-s": "f32c",
    	"sym-cvt": "f32d",
    	"sym-cvx-s": "f32e",
    	"sym-cvx": "f32f",
    	"sym-cw-s": "f330",
    	"sym-cw": "f331",
    	"sym-cyc-s": "f332",
    	"sym-cyc": "f333",
    	"sym-dac-s": "f334",
    	"sym-dac": "f335",
    	"sym-dacs-s": "f336",
    	"sym-dacs": "f337",
    	"sym-dadi-s": "f338",
    	"sym-dadi": "f339",
    	"sym-dag-s": "f33a",
    	"sym-dag": "f33b",
    	"sym-dai-s": "f33c",
    	"sym-dai": "f33d",
    	"sym-dao-s": "f33e",
    	"sym-dao": "f33f",
    	"sym-dash-s": "f340",
    	"sym-dash": "f341",
    	"sym-dat-s": "f342",
    	"sym-dat": "f343",
    	"sym-data-s": "f344",
    	"sym-data": "f345",
    	"sym-datx-s": "f346",
    	"sym-datx": "f347",
    	"sym-dbc-s": "f348",
    	"sym-dbc": "f349",
    	"sym-dbet-s": "f34a",
    	"sym-dbet": "f34b",
    	"sym-dbix-s": "f34c",
    	"sym-dbix": "f34d",
    	"sym-dcn-s": "f34e",
    	"sym-dcn": "f34f",
    	"sym-dcr-s": "f350",
    	"sym-dcr": "f351",
    	"sym-dct-s": "f352",
    	"sym-dct": "f353",
    	"sym-ddd-s": "f354",
    	"sym-ddd": "f355",
    	"sym-dego-s": "f356",
    	"sym-dego": "f357",
    	"sym-dent-s": "f358",
    	"sym-dent": "f359",
    	"sym-dgb-s": "f35a",
    	"sym-dgb": "f35b",
    	"sym-dgd-s": "f35c",
    	"sym-dgd": "f35d",
    	"sym-dgtx-s": "f35e",
    	"sym-dgtx": "f35f",
    	"sym-dgx-s": "f360",
    	"sym-dgx": "f361",
    	"sym-dhx-s": "f362",
    	"sym-dhx": "f363",
    	"sym-dia-s": "f364",
    	"sym-dia": "f365",
    	"sym-dice-s": "f366",
    	"sym-dice": "f367",
    	"sym-dim-s": "f368",
    	"sym-dim": "f369",
    	"sym-dlt-s": "f36a",
    	"sym-dlt": "f36b",
    	"sym-dmd-s": "f36c",
    	"sym-dmd": "f36d",
    	"sym-dmt-s": "f36e",
    	"sym-dmt": "f36f",
    	"sym-dnt-s": "f370",
    	"sym-dnt": "f371",
    	"sym-dock-s": "f372",
    	"sym-dock": "f373",
    	"sym-dodo-s": "f374",
    	"sym-dodo": "f375",
    	"sym-doge-s": "f376",
    	"sym-doge": "f377",
    	"sym-dot-s": "f378",
    	"sym-dot": "f379",
    	"sym-dpy-s": "f37a",
    	"sym-dpy": "f37b",
    	"sym-dream-s": "f37c",
    	"sym-dream": "f37d",
    	"sym-drep-s": "f37e",
    	"sym-drep": "f37f",
    	"sym-drg-s": "f380",
    	"sym-drg": "f381",
    	"sym-drgn-s": "f382",
    	"sym-drgn": "f383",
    	"sym-drt-s": "f384",
    	"sym-drt": "f385",
    	"sym-dta-s": "f386",
    	"sym-dta": "f387",
    	"sym-dtb-s": "f388",
    	"sym-dtb": "f389",
    	"sym-dtr-s": "f38a",
    	"sym-dtr": "f38b",
    	"sym-dusk-s": "f38c",
    	"sym-dusk": "f38d",
    	"sym-dx-s": "f38e",
    	"sym-dx": "f38f",
    	"sym-dydx-s": "f390",
    	"sym-dydx": "f391",
    	"sym-dyn-s": "f392",
    	"sym-dyn": "f393",
    	"sym-easy": "f394",
    	"sym-ecom-s": "f395",
    	"sym-ecom": "f396",
    	"sym-edc-s": "f397",
    	"sym-edc": "f398",
    	"sym-edg-s": "f399",
    	"sym-edg": "f39a",
    	"sym-edo-s": "f39b",
    	"sym-edo": "f39c",
    	"sym-edp-s": "f39d",
    	"sym-edp": "f39e",
    	"sym-edr-s": "f39f",
    	"sym-edr": "f3a0",
    	"sym-efi-s": "f3a1",
    	"sym-efi": "f3a2",
    	"sym-egld-s": "f3a3",
    	"sym-egld": "f3a4",
    	"sym-egt-s": "f3a5",
    	"sym-egt": "f3a6",
    	"sym-ehr-s": "f3a7",
    	"sym-ehr": "f3a8",
    	"sym-eko-s": "f3a9",
    	"sym-eko": "f3aa",
    	"sym-ekt-s": "f3ab",
    	"sym-ekt": "f3ac",
    	"sym-ela-s": "f3ad",
    	"sym-ela": "f3ae",
    	"sym-elec-s": "f3af",
    	"sym-elec": "f3b0",
    	"sym-elf-s": "f3b1",
    	"sym-elf": "f3b2",
    	"sym-em-s": "f3b3",
    	"sym-em": "f3b4",
    	"sym-emc-s": "f3b5",
    	"sym-emc": "f3b6",
    	"sym-emc2-s": "f3b7",
    	"sym-emc2": "f3b8",
    	"sym-eng-s": "f3b9",
    	"sym-eng": "f3ba",
    	"sym-enj-s": "f3bb",
    	"sym-enj": "f3bc",
    	"sym-ens-s": "f3bd",
    	"sym-ens": "f3be",
    	"sym-eos-s": "f3bf",
    	"sym-eos": "f3c0",
    	"sym-eosdac-s": "f3c1",
    	"sym-eosdac": "f3c2",
    	"sym-eq-s": "f3c3",
    	"sym-eq": "f3c4",
    	"sym-erd-s": "f3c5",
    	"sym-erd": "f3c6",
    	"sym-ern-s": "f3c7",
    	"sym-ern": "f3c8",
    	"sym-es-s": "f3c9",
    	"sym-es": "f3ca",
    	"sym-esd-s": "f3cb",
    	"sym-esd": "f3cc",
    	"sym-etc-s": "f3cd",
    	"sym-etc": "f3ce",
    	"sym-eth-s": "f3cf",
    	"sym-eth": "f3d0",
    	"sym-ethup-s": "f3d1",
    	"sym-ethup": "f3d2",
    	"sym-etn-s": "f3d3",
    	"sym-etn": "f3d4",
    	"sym-etp-s": "f3d5",
    	"sym-etp": "f3d6",
    	"sym-eur-s": "f3d7",
    	"sym-eur": "f3d8",
    	"sym-eurs-s": "f3d9",
    	"sym-eurs": "f3da",
    	"sym-eurt-s": "f3db",
    	"sym-eurt": "f3dc",
    	"sym-evn-s": "f3dd",
    	"sym-evn": "f3de",
    	"sym-evx-s": "f3df",
    	"sym-evx": "f3e0",
    	"sym-ewt-s": "f3e1",
    	"sym-ewt": "f3e2",
    	"sym-exp-s": "f3e3",
    	"sym-exp": "f3e4",
    	"sym-exrd-s": "f3e5",
    	"sym-exrd": "f3e6",
    	"sym-exy-s": "f3e7",
    	"sym-exy": "f3e8",
    	"sym-fair-s": "f3e9",
    	"sym-fair": "f3ea",
    	"sym-fct-s": "f3eb",
    	"sym-fct": "f3ec",
    	"sym-fdz-s": "f3ed",
    	"sym-fdz": "f3ee",
    	"sym-fee-s": "f3ef",
    	"sym-fee": "f3f0",
    	"sym-fet-s": "f3f1",
    	"sym-fet": "f3f2",
    	"sym-fida-s": "f3f3",
    	"sym-fida": "f3f4",
    	"sym-fil-s": "f3f5",
    	"sym-fil": "f3f6",
    	"sym-fio-s": "f3f7",
    	"sym-fio": "f3f8",
    	"sym-firo-s": "f3f9",
    	"sym-firo": "f3fa",
    	"sym-fis-s": "f3fb",
    	"sym-fis": "f3fc",
    	"sym-fldc-s": "f3fd",
    	"sym-fldc": "f3fe",
    	"sym-flo-s": "f3ff",
    	"sym-flo": "f400",
    	"sym-floki-s": "f401",
    	"sym-floki": "f402",
    	"sym-flow-s": "f403",
    	"sym-flow": "f404",
    	"sym-flr-s": "f405",
    	"sym-flr": "f406",
    	"sym-fluz-s": "f407",
    	"sym-fluz": "f408",
    	"sym-fnb-s": "f409",
    	"sym-fnb": "f40a",
    	"sym-foam-s": "f40b",
    	"sym-foam": "f40c",
    	"sym-for-s": "f40d",
    	"sym-for": "f40e",
    	"sym-fota-s": "f40f",
    	"sym-fota": "f410",
    	"sym-frax-s": "f411",
    	"sym-frax": "f412",
    	"sym-front-s": "f413",
    	"sym-front": "f414",
    	"sym-fsn-s": "f415",
    	"sym-fsn": "f416",
    	"sym-ftc-s": "f417",
    	"sym-ftc": "f418",
    	"sym-fti-s": "f419",
    	"sym-fti": "f41a",
    	"sym-ftm-s": "f41b",
    	"sym-ftm": "f41c",
    	"sym-ftt-s": "f41d",
    	"sym-ftt": "f41e",
    	"sym-ftx-s": "f41f",
    	"sym-ftx": "f420",
    	"sym-fuel-s": "f421",
    	"sym-fuel": "f422",
    	"sym-fun-s": "f423",
    	"sym-fun": "f424",
    	"sym-fx-s": "f425",
    	"sym-fx": "f426",
    	"sym-fxc-s": "f427",
    	"sym-fxc": "f428",
    	"sym-fxs-s": "f429",
    	"sym-fxs": "f42a",
    	"sym-fxt-s": "f42b",
    	"sym-fxt": "f42c",
    	"sym-gala-s": "f42d",
    	"sym-gala": "f42e",
    	"sym-game-s": "f42f",
    	"sym-game": "f430",
    	"sym-gard-s": "f431",
    	"sym-gard": "f432",
    	"sym-gas-s": "f433",
    	"sym-gas": "f434",
    	"sym-gbc-s": "f435",
    	"sym-gbc": "f436",
    	"sym-gbp-s": "f437",
    	"sym-gbp": "f438",
    	"sym-gbx-s": "f439",
    	"sym-gbx": "f43a",
    	"sym-gbyte-s": "f43b",
    	"sym-gbyte": "f43c",
    	"sym-gc-s": "f43d",
    	"sym-gc": "f43e",
    	"sym-gcc-s": "f43f",
    	"sym-gcc": "f440",
    	"sym-ge-s": "f441",
    	"sym-ge": "f442",
    	"sym-geist-s": "f443",
    	"sym-geist": "f444",
    	"sym-gen-s": "f445",
    	"sym-gen": "f446",
    	"sym-gens-s": "f447",
    	"sym-gens": "f448",
    	"sym-get-s": "f449",
    	"sym-get": "f44a",
    	"sym-ghst-s": "f44b",
    	"sym-ghst": "f44c",
    	"sym-glc-s": "f44d",
    	"sym-glc": "f44e",
    	"sym-gld-s": "f44f",
    	"sym-gld": "f450",
    	"sym-glm-s": "f451",
    	"sym-glm": "f452",
    	"sym-glmr-s": "f453",
    	"sym-glmr": "f454",
    	"sym-gmat-s": "f455",
    	"sym-gmat": "f456",
    	"sym-gno-s": "f457",
    	"sym-gno": "f458",
    	"sym-gnt-s": "f459",
    	"sym-gnt": "f45a",
    	"sym-gnx-s": "f45b",
    	"sym-gnx": "f45c",
    	"sym-go-s": "f45d",
    	"sym-go": "f45e",
    	"sym-got-s": "f45f",
    	"sym-got": "f460",
    	"sym-grc-s": "f461",
    	"sym-grc": "f462",
    	"sym-grin-s": "f463",
    	"sym-grin": "f464",
    	"sym-grs-s": "f465",
    	"sym-grs": "f466",
    	"sym-grt-s": "f467",
    	"sym-grt": "f468",
    	"sym-gsc-s": "f469",
    	"sym-gsc": "f46a",
    	"sym-gt-s": "f46b",
    	"sym-gt": "f46c",
    	"sym-gtc-s": "f46d",
    	"sym-gtc": "f46e",
    	"sym-gto-s": "f46f",
    	"sym-gto": "f470",
    	"sym-gup-s": "f471",
    	"sym-gup": "f472",
    	"sym-gusd-s": "f473",
    	"sym-gusd": "f474",
    	"sym-gvt-s": "f475",
    	"sym-gvt": "f476",
    	"sym-gxc-s": "f477",
    	"sym-gxc": "f478",
    	"sym-gxs-s": "f479",
    	"sym-gxs": "f47a",
    	"sym-hard-s": "f47b",
    	"sym-hard": "f47c",
    	"sym-hbar-s": "f47d",
    	"sym-hbar": "f47e",
    	"sym-hc-s": "f47f",
    	"sym-hc": "f480",
    	"sym-hdx-s": "f481",
    	"sym-hdx": "f482",
    	"sym-hedg-s": "f483",
    	"sym-hedg": "f484",
    	"sym-hex-s": "f485",
    	"sym-hex": "f486",
    	"sym-hft-s": "f487",
    	"sym-hft": "f488",
    	"sym-hg-s": "f489",
    	"sym-hg": "f48a",
    	"sym-hgs-s": "f48b",
    	"sym-hgs": "f48c",
    	"sym-hh-s": "f48d",
    	"sym-hh": "f48e",
    	"sym-hit-s": "f48f",
    	"sym-hit": "f490",
    	"sym-hive-s": "f491",
    	"sym-hive": "f492",
    	"sym-hkd-s": "f493",
    	"sym-hkd": "f494",
    	"sym-hmq-s": "f495",
    	"sym-hmq": "f496",
    	"sym-hns-s": "f497",
    	"sym-hns": "f498",
    	"sym-ho-s": "f499",
    	"sym-ho": "f49a",
    	"sym-hot-s": "f49b",
    	"sym-hot": "f49c",
    	"sym-hp-s": "f49d",
    	"sym-hp": "f49e",
    	"sym-hpb-s": "f49f",
    	"sym-hpb": "f4a0",
    	"sym-hpc-s": "f4a1",
    	"sym-hpc": "f4a2",
    	"sym-hpt-s": "f4a3",
    	"sym-hpt": "f4a4",
    	"sym-hrc-s": "f4a5",
    	"sym-hrc": "f4a6",
    	"sym-hsc-s": "f4a7",
    	"sym-hsc": "f4a8",
    	"sym-hsr-s": "f4a9",
    	"sym-hsr": "f4aa",
    	"sym-hst-s": "f4ab",
    	"sym-hst": "f4ac",
    	"sym-ht-s": "f4ad",
    	"sym-ht": "f4ae",
    	"sym-html-s": "f4af",
    	"sym-html": "f4b0",
    	"sym-htt-s": "f4b1",
    	"sym-htt": "f4b2",
    	"sym-huc-s": "f4b3",
    	"sym-huc": "f4b4",
    	"sym-hvn-s": "f4b5",
    	"sym-hvn": "f4b6",
    	"sym-hxro-s": "f4b7",
    	"sym-hxro": "f4b8",
    	"sym-hyc-s": "f4b9",
    	"sym-hyc": "f4ba",
    	"sym-hydra-s": "f4bb",
    	"sym-hydra": "f4bc",
    	"sym-hydro-s": "f4bd",
    	"sym-hydro": "f4be",
    	"sym-icn-s": "f4bf",
    	"sym-icn": "f4c0",
    	"sym-icos-s": "f4c1",
    	"sym-icos": "f4c2",
    	"sym-icp-s": "f4c3",
    	"sym-icp": "f4c4",
    	"sym-icx-s": "f4c5",
    	"sym-icx": "f4c6",
    	"sym-idex-s": "f4c7",
    	"sym-idex": "f4c8",
    	"sym-idh-s": "f4c9",
    	"sym-idh": "f4ca",
    	"sym-idr-s": "f4cb",
    	"sym-idr": "f4cc",
    	"sym-ift-s": "f4cd",
    	"sym-ift": "f4ce",
    	"sym-ignis-s": "f4cf",
    	"sym-ignis": "f4d0",
    	"sym-ihf-s": "f4d1",
    	"sym-ihf": "f4d2",
    	"sym-iht-s": "f4d3",
    	"sym-iht": "f4d4",
    	"sym-ilc-s": "f4d5",
    	"sym-ilc": "f4d6",
    	"sym-ilv-s": "f4d7",
    	"sym-ilv": "f4d8",
    	"sym-imx-s": "f4d9",
    	"sym-imx": "f4da",
    	"sym-incnt-s": "f4db",
    	"sym-incnt": "f4dc",
    	"sym-ind-s": "f4dd",
    	"sym-ind": "f4de",
    	"sym-inj-s": "f4df",
    	"sym-inj": "f4e0",
    	"sym-ink-s": "f4e1",
    	"sym-ink": "f4e2",
    	"sym-inr-s": "f4e3",
    	"sym-inr": "f4e4",
    	"sym-ins-s": "f4e5",
    	"sym-ins": "f4e6",
    	"sym-int-s": "f4e7",
    	"sym-int": "f4e8",
    	"sym-intr-s": "f4e9",
    	"sym-intr": "f4ea",
    	"sym-ioc-s": "f4eb",
    	"sym-ioc": "f4ec",
    	"sym-ion-s": "f4ed",
    	"sym-ion": "f4ee",
    	"sym-iost-s": "f4ef",
    	"sym-iost": "f4f0",
    	"sym-iot-s": "f4f1",
    	"sym-iot": "f4f2",
    	"sym-iotx-s": "f4f3",
    	"sym-iotx": "f4f4",
    	"sym-iq-s": "f4f5",
    	"sym-iq": "f4f6",
    	"sym-iris-s": "f4f7",
    	"sym-iris": "f4f8",
    	"sym-itc-s": "f4f9",
    	"sym-itc": "f4fa",
    	"sym-ivy-s": "f4fb",
    	"sym-ivy": "f4fc",
    	"sym-ixt-s": "f4fd",
    	"sym-ixt": "f4fe",
    	"sym-jasmy-s": "f4ff",
    	"sym-jasmy": "f500",
    	"sym-jnt-s": "f501",
    	"sym-jnt": "f502",
    	"sym-joe-s": "f503",
    	"sym-joe": "f504",
    	"sym-jpy-s": "f505",
    	"sym-jpy": "f506",
    	"sym-jst-s": "f507",
    	"sym-jst": "f508",
    	"sym-juv-s": "f509",
    	"sym-juv": "f50a",
    	"sym-kan-s": "f50b",
    	"sym-kan": "f50c",
    	"sym-kar-s": "f50d",
    	"sym-kar": "f50e",
    	"sym-kava-s": "f50f",
    	"sym-kava": "f510",
    	"sym-kbc-s": "f511",
    	"sym-kbc": "f512",
    	"sym-kcash-s": "f513",
    	"sym-kcash": "f514",
    	"sym-keep-s": "f515",
    	"sym-keep": "f516",
    	"sym-key-s": "f517",
    	"sym-key": "f518",
    	"sym-kick-s": "f519",
    	"sym-kick": "f51a",
    	"sym-kilt-s": "f51b",
    	"sym-kilt": "f51c",
    	"sym-kin-s": "f51d",
    	"sym-kin": "f51e",
    	"sym-kint-s": "f51f",
    	"sym-kint": "f520",
    	"sym-kma-s": "f521",
    	"sym-kma": "f522",
    	"sym-kmd-s": "f523",
    	"sym-kmd": "f524",
    	"sym-knc-s": "f525",
    	"sym-knc": "f526",
    	"sym-kore-s": "f527",
    	"sym-kore": "f528",
    	"sym-kp3r-s": "f529",
    	"sym-kp3r": "f52a",
    	"sym-krm-s": "f52b",
    	"sym-krm": "f52c",
    	"sym-krw-s": "f52d",
    	"sym-krw": "f52e",
    	"sym-ksm-s": "f52f",
    	"sym-ksm": "f530",
    	"sym-ksx-s": "f531",
    	"sym-ksx": "f532",
    	"sym-kyl-s": "f533",
    	"sym-kyl": "f534",
    	"sym-la-s": "f535",
    	"sym-la": "f536",
    	"sym-lak-s": "f537",
    	"sym-lak": "f538",
    	"sym-lamb-s": "f539",
    	"sym-lamb": "f53a",
    	"sym-latx-s": "f53b",
    	"sym-latx": "f53c",
    	"sym-layr-s": "f53d",
    	"sym-layr": "f53e",
    	"sym-lba-s": "f53f",
    	"sym-lba": "f540",
    	"sym-lbc-s": "f541",
    	"sym-lbc": "f542",
    	"sym-lcc-s": "f543",
    	"sym-lcc": "f544",
    	"sym-lend-s": "f545",
    	"sym-lend": "f546",
    	"sym-leo-s": "f547",
    	"sym-leo": "f548",
    	"sym-leoc-s": "f549",
    	"sym-leoc": "f54a",
    	"sym-let-s": "f54b",
    	"sym-let": "f54c",
    	"sym-life-s": "f54d",
    	"sym-life": "f54e",
    	"sym-link-s": "f54f",
    	"sym-link": "f550",
    	"sym-lit-s": "f551",
    	"sym-lit": "f552",
    	"sym-lmc-s": "f553",
    	"sym-lmc": "f554",
    	"sym-lml-s": "f555",
    	"sym-lml": "f556",
    	"sym-lnc-s": "f557",
    	"sym-lnc": "f558",
    	"sym-lnd-s": "f559",
    	"sym-lnd": "f55a",
    	"sym-loc-s": "f55b",
    	"sym-loc": "f55c",
    	"sym-loom-s": "f55d",
    	"sym-loom": "f55e",
    	"sym-lpt-s": "f55f",
    	"sym-lpt": "f560",
    	"sym-lrc-s": "f561",
    	"sym-lrc": "f562",
    	"sym-lrn-s": "f563",
    	"sym-lrn": "f564",
    	"sym-lsk-s": "f565",
    	"sym-lsk": "f566",
    	"sym-ltc-s": "f567",
    	"sym-ltc": "f568",
    	"sym-lto-s": "f569",
    	"sym-lto": "f56a",
    	"sym-lun-s": "f56b",
    	"sym-lun": "f56c",
    	"sym-luna-s": "f56d",
    	"sym-luna": "f56e",
    	"sym-lxt-s": "f56f",
    	"sym-lxt": "f570",
    	"sym-lym-s": "f571",
    	"sym-lym": "f572",
    	"sym-m2k-s": "f573",
    	"sym-m2k": "f574",
    	"sym-ma-s": "f575",
    	"sym-ma": "f576",
    	"sym-maid-s": "f577",
    	"sym-maid": "f578",
    	"sym-man-s": "f579",
    	"sym-man": "f57a",
    	"sym-mana-s": "f57b",
    	"sym-mana": "f57c",
    	"sym-mask-s": "f57d",
    	"sym-mask": "f57e",
    	"sym-mass-s": "f57f",
    	"sym-mass": "f580",
    	"sym-matic-s": "f581",
    	"sym-matic": "f582",
    	"sym-mbl-s": "f583",
    	"sym-mbl": "f584",
    	"sym-mbt-s": "f585",
    	"sym-mbt": "f586",
    	"sym-mc-s": "f587",
    	"sym-mc": "f588",
    	"sym-mco-s": "f589",
    	"sym-mco": "f58a",
    	"sym-mda-s": "f58b",
    	"sym-mda": "f58c",
    	"sym-mds-s": "f58d",
    	"sym-mds": "f58e",
    	"sym-mdt-s": "f58f",
    	"sym-mdt": "f590",
    	"sym-mdx-s": "f591",
    	"sym-mdx": "f592",
    	"sym-med-s": "f593",
    	"sym-med": "f594",
    	"sym-mer-s": "f595",
    	"sym-mer": "f596",
    	"sym-mes-s": "f597",
    	"sym-mes": "f598",
    	"sym-met-s": "f599",
    	"sym-met": "f59a",
    	"sym-meta-s": "f59b",
    	"sym-meta": "f59c",
    	"sym-mft-s": "f59d",
    	"sym-mft": "f59e",
    	"sym-mgc-s": "f59f",
    	"sym-mgc": "f5a0",
    	"sym-mgo-s": "f5a1",
    	"sym-mgo": "f5a2",
    	"sym-mhc-s": "f5a3",
    	"sym-mhc": "f5a4",
    	"sym-mina-s": "f5a5",
    	"sym-mina": "f5a6",
    	"sym-mir-s": "f5a7",
    	"sym-mir": "f5a8",
    	"sym-mith-s": "f5a9",
    	"sym-mith": "f5aa",
    	"sym-mitx-s": "f5ab",
    	"sym-mitx": "f5ac",
    	"sym-mjp-s": "f5ad",
    	"sym-mjp": "f5ae",
    	"sym-mkr-s": "f5af",
    	"sym-mkr": "f5b0",
    	"sym-mln-s": "f5b1",
    	"sym-mln": "f5b2",
    	"sym-mngo-s": "f5b3",
    	"sym-mngo": "f5b4",
    	"sym-mnx-s": "f5b5",
    	"sym-mnx": "f5b6",
    	"sym-moac-s": "f5b7",
    	"sym-moac": "f5b8",
    	"sym-mob-s": "f5b9",
    	"sym-mob": "f5ba",
    	"sym-mobi-s": "f5bb",
    	"sym-mobi": "f5bc",
    	"sym-moc-s": "f5bd",
    	"sym-moc": "f5be",
    	"sym-mod-s": "f5bf",
    	"sym-mod": "f5c0",
    	"sym-mona-s": "f5c1",
    	"sym-mona": "f5c2",
    	"sym-moon-s": "f5c3",
    	"sym-moon": "f5c4",
    	"sym-morph-s": "f5c5",
    	"sym-morph": "f5c6",
    	"sym-movr-s": "f5c7",
    	"sym-movr": "f5c8",
    	"sym-mrk-s": "f5c9",
    	"sym-mrk": "f5ca",
    	"sym-msp-s": "f5cb",
    	"sym-msp": "f5cc",
    	"sym-mta-s": "f5cd",
    	"sym-mta": "f5ce",
    	"sym-mtc-s": "f5cf",
    	"sym-mtc": "f5d0",
    	"sym-mth-s": "f5d1",
    	"sym-mth": "f5d2",
    	"sym-mtl-s": "f5d3",
    	"sym-mtl": "f5d4",
    	"sym-mtn-s": "f5d5",
    	"sym-mtn": "f5d6",
    	"sym-mtx-s": "f5d7",
    	"sym-mtx": "f5d8",
    	"sym-mue-s": "f5d9",
    	"sym-mue": "f5da",
    	"sym-multi-s": "f5db",
    	"sym-multi": "f5dc",
    	"sym-mx-s": "f5dd",
    	"sym-mx": "f5de",
    	"sym-mxc-s": "f5df",
    	"sym-mxc": "f5e0",
    	"sym-mxm-s": "f5e1",
    	"sym-mxm": "f5e2",
    	"sym-mxn-s": "f5e3",
    	"sym-mxn": "f5e4",
    	"sym-myr-s": "f5e5",
    	"sym-myr": "f5e6",
    	"sym-n9l-s": "f5e7",
    	"sym-n9l": "f5e8",
    	"sym-nanj-s": "f5e9",
    	"sym-nanj": "f5ea",
    	"sym-nano-s": "f5eb",
    	"sym-nano": "f5ec",
    	"sym-nas-s": "f5ed",
    	"sym-nas": "f5ee",
    	"sym-naut-s": "f5ef",
    	"sym-naut": "f5f0",
    	"sym-nav-s": "f5f1",
    	"sym-nav": "f5f2",
    	"sym-ncash-s": "f5f3",
    	"sym-ncash": "f5f4",
    	"sym-nct-s": "f5f5",
    	"sym-nct": "f5f6",
    	"sym-near-s": "f5f7",
    	"sym-near": "f5f8",
    	"sym-nebl-s": "f5f9",
    	"sym-nebl": "f5fa",
    	"sym-nec-s": "f5fb",
    	"sym-nec": "f5fc",
    	"sym-neo-s": "f5fd",
    	"sym-neo": "f5fe",
    	"sym-neos-s": "f5ff",
    	"sym-neos": "f600",
    	"sym-nest-s": "f601",
    	"sym-nest": "f602",
    	"sym-neu-s": "f603",
    	"sym-neu": "f604",
    	"sym-new-s": "f605",
    	"sym-new": "f606",
    	"sym-nexo-s": "f607",
    	"sym-nexo": "f608",
    	"sym-nft-s": "f609",
    	"sym-nft": "f60a",
    	"sym-ng-s": "f60b",
    	"sym-ng": "f60c",
    	"sym-ngc-s": "f60d",
    	"sym-ngc": "f60e",
    	"sym-ngn-s": "f60f",
    	"sym-ngn": "f610",
    	"sym-nim-s": "f611",
    	"sym-nim": "f612",
    	"sym-niy-s": "f613",
    	"sym-niy": "f614",
    	"sym-nkd-s": "f615",
    	"sym-nkd": "f616",
    	"sym-nkn-s": "f617",
    	"sym-nkn": "f618",
    	"sym-nlc2-s": "f619",
    	"sym-nlc2": "f61a",
    	"sym-nlg-s": "f61b",
    	"sym-nlg": "f61c",
    	"sym-nmc-s": "f61d",
    	"sym-nmc": "f61e",
    	"sym-nmr-s": "f61f",
    	"sym-nmr": "f620",
    	"sym-nn-s": "f621",
    	"sym-nn": "f622",
    	"sym-noah-s": "f623",
    	"sym-noah": "f624",
    	"sym-nodl-s": "f625",
    	"sym-nodl": "f626",
    	"sym-note-s": "f627",
    	"sym-note": "f628",
    	"sym-npg-s": "f629",
    	"sym-npg": "f62a",
    	"sym-nplc-s": "f62b",
    	"sym-nplc": "f62c",
    	"sym-npxs-s": "f62d",
    	"sym-npxs": "f62e",
    	"sym-nq-s": "f62f",
    	"sym-nq": "f630",
    	"sym-nrg-s": "f631",
    	"sym-nrg": "f632",
    	"sym-ntk-s": "f633",
    	"sym-ntk": "f634",
    	"sym-nu-s": "f635",
    	"sym-nu": "f636",
    	"sym-nuls-s": "f637",
    	"sym-nuls": "f638",
    	"sym-nvc-s": "f639",
    	"sym-nvc": "f63a",
    	"sym-nxc-s": "f63b",
    	"sym-nxc": "f63c",
    	"sym-nxs-s": "f63d",
    	"sym-nxs": "f63e",
    	"sym-nxt-s": "f63f",
    	"sym-nxt": "f640",
    	"sym-o-s": "f641",
    	"sym-o": "f642",
    	"sym-oax-s": "f643",
    	"sym-oax": "f644",
    	"sym-ocean-s": "f645",
    	"sym-ocean": "f646",
    	"sym-ocn-s": "f647",
    	"sym-ocn": "f648",
    	"sym-ode-s": "f649",
    	"sym-ode": "f64a",
    	"sym-ogn-s": "f64b",
    	"sym-ogn": "f64c",
    	"sym-ogo-s": "f64d",
    	"sym-ogo": "f64e",
    	"sym-ok-s": "f64f",
    	"sym-ok": "f650",
    	"sym-okb-s": "f651",
    	"sym-okb": "f652",
    	"sym-om-s": "f653",
    	"sym-om": "f654",
    	"sym-omg-s": "f655",
    	"sym-omg": "f656",
    	"sym-omni-s": "f657",
    	"sym-omni": "f658",
    	"sym-one-s": "f659",
    	"sym-one": "f65a",
    	"sym-ong-s": "f65b",
    	"sym-ong": "f65c",
    	"sym-onot-s": "f65d",
    	"sym-onot": "f65e",
    	"sym-ont-s": "f65f",
    	"sym-ont": "f660",
    	"sym-orbs-s": "f661",
    	"sym-orbs": "f662",
    	"sym-orca-s": "f663",
    	"sym-orca": "f664",
    	"sym-orme-s": "f665",
    	"sym-orme": "f666",
    	"sym-ors-s": "f667",
    	"sym-ors": "f668",
    	"sym-ost-s": "f669",
    	"sym-ost": "f66a",
    	"sym-otn-s": "f66b",
    	"sym-otn": "f66c",
    	"sym-oxt-s": "f66d",
    	"sym-oxt": "f66e",
    	"sym-oxy-s": "f66f",
    	"sym-oxy": "f670",
    	"sym-pai-s": "f671",
    	"sym-pai": "f672",
    	"sym-pal-s": "f673",
    	"sym-pal": "f674",
    	"sym-para-s": "f675",
    	"sym-para": "f676",
    	"sym-part-s": "f677",
    	"sym-part": "f678",
    	"sym-pasc-s": "f679",
    	"sym-pasc": "f67a",
    	"sym-pat-s": "f67b",
    	"sym-pat": "f67c",
    	"sym-pax-s": "f67d",
    	"sym-pax": "f67e",
    	"sym-paxg-s": "f67f",
    	"sym-paxg": "f680",
    	"sym-pay-s": "f681",
    	"sym-pay": "f682",
    	"sym-pbt-s": "f683",
    	"sym-pbt": "f684",
    	"sym-pcl-s": "f685",
    	"sym-pcl": "f686",
    	"sym-pcx-s": "f687",
    	"sym-pcx": "f688",
    	"sym-pdex-s": "f689",
    	"sym-pdex": "f68a",
    	"sym-people-s": "f68b",
    	"sym-people": "f68c",
    	"sym-perl-s": "f68d",
    	"sym-perl": "f68e",
    	"sym-perp-s": "f68f",
    	"sym-perp": "f690",
    	"sym-pha-s": "f691",
    	"sym-pha": "f692",
    	"sym-phb-s": "f693",
    	"sym-phb": "f694",
    	"sym-php-s": "f695",
    	"sym-php": "f696",
    	"sym-phx-s": "f697",
    	"sym-phx": "f698",
    	"sym-pi-s": "f699",
    	"sym-pi": "f69a",
    	"sym-pica-s": "f69b",
    	"sym-pica": "f69c",
    	"sym-pink-s": "f69d",
    	"sym-pink": "f69e",
    	"sym-pivx-s": "f69f",
    	"sym-pivx": "f6a0",
    	"sym-pkt-s": "f6a1",
    	"sym-pkt": "f6a2",
    	"sym-pl-s": "f6a3",
    	"sym-pl": "f6a4",
    	"sym-pla-s": "f6a5",
    	"sym-pla": "f6a6",
    	"sym-plbt-s": "f6a7",
    	"sym-plbt": "f6a8",
    	"sym-plm-s": "f6a9",
    	"sym-plm": "f6aa",
    	"sym-pln-s": "f6ab",
    	"sym-pln": "f6ac",
    	"sym-plr-s": "f6ad",
    	"sym-plr": "f6ae",
    	"sym-ply-s": "f6af",
    	"sym-ply": "f6b0",
    	"sym-pma-s": "f6b1",
    	"sym-pma": "f6b2",
    	"sym-png-s": "f6b3",
    	"sym-png": "f6b4",
    	"sym-pnt-s": "f6b5",
    	"sym-pnt": "f6b6",
    	"sym-poa-s": "f6b7",
    	"sym-poa": "f6b8",
    	"sym-poe-s": "f6b9",
    	"sym-poe": "f6ba",
    	"sym-polis-s": "f6bb",
    	"sym-polis": "f6bc",
    	"sym-pols-s": "f6bd",
    	"sym-pols": "f6be",
    	"sym-poly-s": "f6bf",
    	"sym-poly": "f6c0",
    	"sym-pond-s": "f6c1",
    	"sym-pond": "f6c2",
    	"sym-pot-s": "f6c3",
    	"sym-pot": "f6c4",
    	"sym-powr-s": "f6c5",
    	"sym-powr": "f6c6",
    	"sym-ppc-s": "f6c7",
    	"sym-ppc": "f6c8",
    	"sym-ppt-s": "f6c9",
    	"sym-ppt": "f6ca",
    	"sym-pra-s": "f6cb",
    	"sym-pra": "f6cc",
    	"sym-pre-s": "f6cd",
    	"sym-pre": "f6ce",
    	"sym-prg-s": "f6cf",
    	"sym-prg": "f6d0",
    	"sym-pro-s": "f6d1",
    	"sym-pro": "f6d2",
    	"sym-pst-s": "f6d3",
    	"sym-pst": "f6d4",
    	"sym-pstake-s": "f6d5",
    	"sym-pstake": "f6d6",
    	"sym-pton-s": "f6d7",
    	"sym-pton": "f6d8",
    	"sym-pvt-s": "f6d9",
    	"sym-pvt": "f6da",
    	"sym-pxg-s": "f6db",
    	"sym-pxg": "f6dc",
    	"sym-qash-s": "f6dd",
    	"sym-qash": "f6de",
    	"sym-qau-s": "f6df",
    	"sym-qau": "f6e0",
    	"sym-qc-s": "f6e1",
    	"sym-qc": "f6e2",
    	"sym-qi-s": "f6e3",
    	"sym-qi": "f6e4",
    	"sym-qkc-s": "f6e5",
    	"sym-qkc": "f6e6",
    	"sym-qlc-s": "f6e7",
    	"sym-qlc": "f6e8",
    	"sym-qnt-s": "f6e9",
    	"sym-qnt": "f6ea",
    	"sym-qntu-s": "f6eb",
    	"sym-qntu": "f6ec",
    	"sym-qo-s": "f6ed",
    	"sym-qo": "f6ee",
    	"sym-qrl-s": "f6ef",
    	"sym-qrl": "f6f0",
    	"sym-qsp-s": "f6f1",
    	"sym-qsp": "f6f2",
    	"sym-qtum-s": "f6f3",
    	"sym-qtum": "f6f4",
    	"sym-qun-s": "f6f5",
    	"sym-qun": "f6f6",
    	"sym-r-s": "f6f7",
    	"sym-r": "f6f8",
    	"sym-rad-s": "f6f9",
    	"sym-rad": "f6fa",
    	"sym-rads-s": "f6fb",
    	"sym-rads": "f6fc",
    	"sym-rare-s": "f6fd",
    	"sym-rare": "f6fe",
    	"sym-rari-s": "f6ff",
    	"sym-rari": "f700",
    	"sym-rating-s": "f701",
    	"sym-rating": "f702",
    	"sym-ray-s": "f703",
    	"sym-ray": "f704",
    	"sym-rb-s": "f705",
    	"sym-rb": "f706",
    	"sym-rbc-s": "f707",
    	"sym-rbc": "f708",
    	"sym-rblx-s": "f709",
    	"sym-rblx": "f70a",
    	"sym-rbtc-s": "f70b",
    	"sym-rbtc": "f70c",
    	"sym-rby-s": "f70d",
    	"sym-rby": "f70e",
    	"sym-rcn-s": "f70f",
    	"sym-rcn": "f710",
    	"sym-rdd-s": "f711",
    	"sym-rdd": "f712",
    	"sym-rdn-s": "f713",
    	"sym-rdn": "f714",
    	"sym-reef-s": "f715",
    	"sym-reef": "f716",
    	"sym-rem-s": "f717",
    	"sym-rem": "f718",
    	"sym-ren-s": "f719",
    	"sym-ren": "f71a",
    	"sym-rep-s": "f71b",
    	"sym-rep": "f71c",
    	"sym-repv2-s": "f71d",
    	"sym-repv2": "f71e",
    	"sym-req-s": "f71f",
    	"sym-req": "f720",
    	"sym-rev-s": "f721",
    	"sym-rev": "f722",
    	"sym-rfox-s": "f723",
    	"sym-rfox": "f724",
    	"sym-rfr-s": "f725",
    	"sym-rfr": "f726",
    	"sym-ric-s": "f727",
    	"sym-ric": "f728",
    	"sym-rif-s": "f729",
    	"sym-rif": "f72a",
    	"sym-ring-s": "f72b",
    	"sym-ring": "f72c",
    	"sym-rlc-s": "f72d",
    	"sym-rlc": "f72e",
    	"sym-rmrk-s": "f72f",
    	"sym-rmrk": "f730",
    	"sym-rndr-s": "f731",
    	"sym-rndr": "f732",
    	"sym-rntb-s": "f733",
    	"sym-rntb": "f734",
    	"sym-ron-s": "f735",
    	"sym-ron": "f736",
    	"sym-rose-s": "f737",
    	"sym-rose": "f738",
    	"sym-rox-s": "f739",
    	"sym-rox": "f73a",
    	"sym-rp-s": "f73b",
    	"sym-rp": "f73c",
    	"sym-rpx-s": "f73d",
    	"sym-rpx": "f73e",
    	"sym-rsr-s": "f73f",
    	"sym-rsr": "f740",
    	"sym-rsv-s": "f741",
    	"sym-rsv": "f742",
    	"sym-rty-s": "f743",
    	"sym-rty": "f744",
    	"sym-rub-s": "f745",
    	"sym-rub": "f746",
    	"sym-ruff-s": "f747",
    	"sym-ruff": "f748",
    	"sym-rune-s": "f749",
    	"sym-rune": "f74a",
    	"sym-rvn-s": "f74b",
    	"sym-rvn": "f74c",
    	"sym-rvr-s": "f74d",
    	"sym-rvr": "f74e",
    	"sym-rvt-s": "f74f",
    	"sym-rvt": "f750",
    	"sym-sai-s": "f751",
    	"sym-sai": "f752",
    	"sym-salt-s": "f753",
    	"sym-salt": "f754",
    	"sym-san-s": "f755",
    	"sym-san": "f756",
    	"sym-sand-s": "f757",
    	"sym-sand": "f758",
    	"sym-sats-s": "f759",
    	"sym-sats": "f75a",
    	"sym-sbd-s": "f75b",
    	"sym-sbd": "f75c",
    	"sym-sbr-s": "f75d",
    	"sym-sbr": "f75e",
    	"sym-sc-s": "f75f",
    	"sym-sc": "f760",
    	"sym-scc-s": "f761",
    	"sym-scc": "f762",
    	"sym-scrt-s": "f763",
    	"sym-scrt": "f764",
    	"sym-sdc-s": "f765",
    	"sym-sdc": "f766",
    	"sym-sdn-s": "f767",
    	"sym-sdn": "f768",
    	"sym-seele-s": "f769",
    	"sym-seele": "f76a",
    	"sym-sek-s": "f76b",
    	"sym-sek": "f76c",
    	"sym-sen-s": "f76d",
    	"sym-sen": "f76e",
    	"sym-sent-s": "f76f",
    	"sym-sent": "f770",
    	"sym-sero-s": "f771",
    	"sym-sero": "f772",
    	"sym-sexc-s": "f773",
    	"sym-sexc": "f774",
    	"sym-sfp-s": "f775",
    	"sym-sfp": "f776",
    	"sym-sgb-s": "f777",
    	"sym-sgb": "f778",
    	"sym-sgc-s": "f779",
    	"sym-sgc": "f77a",
    	"sym-sgd-s": "f77b",
    	"sym-sgd": "f77c",
    	"sym-sgn-s": "f77d",
    	"sym-sgn": "f77e",
    	"sym-sgu-s": "f77f",
    	"sym-sgu": "f780",
    	"sym-shib-s": "f781",
    	"sym-shib": "f782",
    	"sym-shift-s": "f783",
    	"sym-shift": "f784",
    	"sym-ship-s": "f785",
    	"sym-ship": "f786",
    	"sym-si-s": "f787",
    	"sym-si": "f788",
    	"sym-sib-s": "f789",
    	"sym-sib": "f78a",
    	"sym-sil-s": "f78b",
    	"sym-sil": "f78c",
    	"sym-six-s": "f78d",
    	"sym-six": "f78e",
    	"sym-sjcx-s": "f78f",
    	"sym-sjcx": "f790",
    	"sym-skl-s": "f791",
    	"sym-skl": "f792",
    	"sym-skm-s": "f793",
    	"sym-skm": "f794",
    	"sym-sku-s": "f795",
    	"sym-sku": "f796",
    	"sym-sky-s": "f797",
    	"sym-sky": "f798",
    	"sym-slp-s": "f799",
    	"sym-slp": "f79a",
    	"sym-slr-s": "f79b",
    	"sym-slr": "f79c",
    	"sym-sls-s": "f79d",
    	"sym-sls": "f79e",
    	"sym-slt-s": "f79f",
    	"sym-slt": "f7a0",
    	"sym-slv-s": "f7a1",
    	"sym-slv": "f7a2",
    	"sym-smart-s": "f7a3",
    	"sym-smart": "f7a4",
    	"sym-smn-s": "f7a5",
    	"sym-smn": "f7a6",
    	"sym-smt-s": "f7a7",
    	"sym-smt": "f7a8",
    	"sym-snc-s": "f7a9",
    	"sym-snc": "f7aa",
    	"sym-snet-s": "f7ab",
    	"sym-snet": "f7ac",
    	"sym-sngls-s": "f7ad",
    	"sym-sngls": "f7ae",
    	"sym-snm-s": "f7af",
    	"sym-snm": "f7b0",
    	"sym-snt-s": "f7b1",
    	"sym-snt": "f7b2",
    	"sym-snx-s": "f7b3",
    	"sym-snx": "f7b4",
    	"sym-soc-s": "f7b5",
    	"sym-soc": "f7b6",
    	"sym-sol-s": "f7b7",
    	"sym-sol": "f7b8",
    	"sym-solo-s": "f7b9",
    	"sym-solo": "f7ba",
    	"sym-solve-s": "f7bb",
    	"sym-solve": "f7bc",
    	"sym-soul-s": "f7bd",
    	"sym-soul": "f7be",
    	"sym-sp-s": "f7bf",
    	"sym-sp": "f7c0",
    	"sym-sparta-s": "f7c1",
    	"sym-sparta": "f7c2",
    	"sym-spc-s": "f7c3",
    	"sym-spc": "f7c4",
    	"sym-spd-s": "f7c5",
    	"sym-spd": "f7c6",
    	"sym-spell-s": "f7c7",
    	"sym-spell": "f7c8",
    	"sym-sphr-s": "f7c9",
    	"sym-sphr": "f7ca",
    	"sym-sphtx-s": "f7cb",
    	"sym-sphtx": "f7cc",
    	"sym-spnd-s": "f7cd",
    	"sym-spnd": "f7ce",
    	"sym-spnk-s": "f7cf",
    	"sym-spnk": "f7d0",
    	"sym-srm-s": "f7d1",
    	"sym-srm": "f7d2",
    	"sym-srn-s": "f7d3",
    	"sym-srn": "f7d4",
    	"sym-ssp-s": "f7d5",
    	"sym-ssp": "f7d6",
    	"sym-stacs-s": "f7d7",
    	"sym-stacs": "f7d8",
    	"sym-step-s": "f7d9",
    	"sym-step": "f7da",
    	"sym-storm-s": "f7db",
    	"sym-storm": "f7dc",
    	"sym-stpt-s": "f7dd",
    	"sym-stpt": "f7de",
    	"sym-stq-s": "f7df",
    	"sym-stq": "f7e0",
    	"sym-str-s": "f7e1",
    	"sym-str": "f7e2",
    	"sym-strat-s": "f7e3",
    	"sym-strat": "f7e4",
    	"sym-strax-s": "f7e5",
    	"sym-strax": "f7e6",
    	"sym-stx-s": "f7e7",
    	"sym-stx": "f7e8",
    	"sym-sub-s": "f7e9",
    	"sym-sub": "f7ea",
    	"sym-susd-s": "f7eb",
    	"sym-susd": "f7ec",
    	"sym-sushi-s": "f7ed",
    	"sym-sushi": "f7ee",
    	"sym-swftc-s": "f7ef",
    	"sym-swftc": "f7f0",
    	"sym-swm-s": "f7f1",
    	"sym-swm": "f7f2",
    	"sym-swrv-s": "f7f3",
    	"sym-swrv": "f7f4",
    	"sym-swt-s": "f7f5",
    	"sym-swt": "f7f6",
    	"sym-swth-s": "f7f7",
    	"sym-swth": "f7f8",
    	"sym-sxp-s": "f7f9",
    	"sym-sxp": "f7fa",
    	"sym-sys-s": "f7fb",
    	"sym-sys": "f7fc",
    	"sym-taas-s": "f7fd",
    	"sym-taas": "f7fe",
    	"sym-tau-s": "f7ff",
    	"sym-tau": "f800",
    	"sym-tbtc-s": "f801",
    	"sym-tbtc": "f802",
    	"sym-tct-s": "f803",
    	"sym-tct": "f804",
    	"sym-teer-s": "f805",
    	"sym-teer": "f806",
    	"sym-tel-s": "f807",
    	"sym-temco-s": "f808",
    	"sym-temco": "f809",
    	"sym-tfuel-s": "f80a",
    	"sym-tfuel": "f80b",
    	"sym-thb-s": "f80c",
    	"sym-thb": "f80d",
    	"sym-thc-s": "f80e",
    	"sym-thc": "f80f",
    	"sym-theta-s": "f810",
    	"sym-theta": "f811",
    	"sym-thx-s": "f812",
    	"sym-thx": "f813",
    	"sym-time-s": "f814",
    	"sym-time": "f815",
    	"sym-tio-s": "f816",
    	"sym-tio": "f817",
    	"sym-tix-s": "f818",
    	"sym-tix": "f819",
    	"sym-tkn-s": "f81a",
    	"sym-tkn": "f81b",
    	"sym-tky-s": "f81c",
    	"sym-tky": "f81d",
    	"sym-tnb-s": "f81e",
    	"sym-tnb": "f81f",
    	"sym-tnc-s": "f820",
    	"sym-tnc": "f821",
    	"sym-tnt-s": "f822",
    	"sym-tnt": "f823",
    	"sym-toke-s": "f824",
    	"sym-toke": "f825",
    	"sym-tomo-s": "f826",
    	"sym-tomo": "f827",
    	"sym-top-s": "f828",
    	"sym-top": "f829",
    	"sym-torn-s": "f82a",
    	"sym-torn": "f82b",
    	"sym-tpay-s": "f82c",
    	"sym-tpay": "f82d",
    	"sym-trac-s": "f82e",
    	"sym-trac": "f82f",
    	"sym-trb-s": "f830",
    	"sym-trb": "f831",
    	"sym-tribe-s": "f832",
    	"sym-tribe": "f833",
    	"sym-trig-s": "f834",
    	"sym-trig": "f835",
    	"sym-trio-s": "f836",
    	"sym-trio": "f837",
    	"sym-troy-s": "f838",
    	"sym-troy": "f839",
    	"sym-trst-s": "f83a",
    	"sym-trst": "f83b",
    	"sym-tru-s": "f83c",
    	"sym-tru": "f83d",
    	"sym-true-s": "f83e",
    	"sym-true": "f83f",
    	"sym-trx-s": "f840",
    	"sym-trx": "f841",
    	"sym-try-s": "f842",
    	"sym-try": "f843",
    	"sym-tryb-s": "f844",
    	"sym-tryb": "f845",
    	"sym-tt-s": "f846",
    	"sym-tt": "f847",
    	"sym-ttc-s": "f848",
    	"sym-ttc": "f849",
    	"sym-ttt-s": "f84a",
    	"sym-ttt": "f84b",
    	"sym-ttu-s": "f84c",
    	"sym-ttu": "f84d",
    	"sym-tube-s": "f84e",
    	"sym-tube": "f84f",
    	"sym-tusd-s": "f850",
    	"sym-tusd": "f851",
    	"sym-twt-s": "f852",
    	"sym-twt": "f853",
    	"sym-uah-s": "f854",
    	"sym-uah": "f855",
    	"sym-ubq-s": "f856",
    	"sym-ubq": "f857",
    	"sym-ubt-s": "f858",
    	"sym-ubt": "f859",
    	"sym-uft-s": "f85a",
    	"sym-uft": "f85b",
    	"sym-ugas-s": "f85c",
    	"sym-ugas": "f85d",
    	"sym-uip-s": "f85e",
    	"sym-uip": "f85f",
    	"sym-ukg-s": "f860",
    	"sym-ukg": "f861",
    	"sym-uma-s": "f862",
    	"sym-uma": "f863",
    	"sym-unfi-s": "f864",
    	"sym-unfi": "f865",
    	"sym-uni-s": "f866",
    	"sym-uni": "f867",
    	"sym-unq-s": "f868",
    	"sym-unq": "f869",
    	"sym-up-s": "f86a",
    	"sym-up": "f86b",
    	"sym-upp-s": "f86c",
    	"sym-upp": "f86d",
    	"sym-usd-s": "f86e",
    	"sym-usd": "f86f",
    	"sym-usdc-s": "f870",
    	"sym-usdc": "f871",
    	"sym-usds-s": "f872",
    	"sym-usds": "f873",
    	"sym-usk-s": "f874",
    	"sym-usk": "f875",
    	"sym-ust-s": "f876",
    	"sym-ust": "f877",
    	"sym-utk-s": "f878",
    	"sym-utk": "f879",
    	"sym-utnp-s": "f87a",
    	"sym-utnp": "f87b",
    	"sym-utt-s": "f87c",
    	"sym-utt": "f87d",
    	"sym-uuu-s": "f87e",
    	"sym-uuu": "f87f",
    	"sym-ux-s": "f880",
    	"sym-ux": "f881",
    	"sym-vai-s": "f882",
    	"sym-vai": "f883",
    	"sym-vbk-s": "f884",
    	"sym-vbk": "f885",
    	"sym-vdx-s": "f886",
    	"sym-vdx": "f887",
    	"sym-vee-s": "f888",
    	"sym-vee": "f889",
    	"sym-ven-s": "f88a",
    	"sym-ven": "f88b",
    	"sym-veo-s": "f88c",
    	"sym-veo": "f88d",
    	"sym-veri-s": "f88e",
    	"sym-veri": "f88f",
    	"sym-vex-s": "f890",
    	"sym-vex": "f891",
    	"sym-vgx-s": "f892",
    	"sym-vgx": "f893",
    	"sym-via-s": "f894",
    	"sym-via": "f895",
    	"sym-vib-s": "f896",
    	"sym-vib": "f897",
    	"sym-vibe-s": "f898",
    	"sym-vibe": "f899",
    	"sym-vid-s": "f89a",
    	"sym-vid": "f89b",
    	"sym-vidt-s": "f89c",
    	"sym-vidt": "f89d",
    	"sym-vidy-s": "f89e",
    	"sym-vidy": "f89f",
    	"sym-vitae-s": "f8a0",
    	"sym-vitae": "f8a1",
    	"sym-vite-s": "f8a2",
    	"sym-vite": "f8a3",
    	"sym-vlx-s": "f8a4",
    	"sym-vlx": "f8a5",
    	"sym-vox-s": "f8a6",
    	"sym-vox": "f8a7",
    	"sym-vra-s": "f8a8",
    	"sym-vra": "f8a9",
    	"sym-vrc-s": "f8aa",
    	"sym-vrc": "f8ab",
    	"sym-vrm-s": "f8ac",
    	"sym-vrm": "f8ad",
    	"sym-vsys-s": "f8ae",
    	"sym-vsys": "f8af",
    	"sym-vtc-s": "f8b0",
    	"sym-vtc": "f8b1",
    	"sym-vtho-s": "f8b2",
    	"sym-vtho": "f8b3",
    	"sym-wabi-s": "f8b4",
    	"sym-wabi": "f8b5",
    	"sym-wan-s": "f8b6",
    	"sym-wan": "f8b7",
    	"sym-waves-s": "f8b8",
    	"sym-waves": "f8b9",
    	"sym-wax-s": "f8ba",
    	"sym-wax": "f8bb",
    	"sym-wbtc-s": "f8bc",
    	"sym-wbtc": "f8bd",
    	"sym-wet-s": "f8be",
    	"sym-wet": "f8bf",
    	"sym-wib-s": "f8c0",
    	"sym-wib": "f8c1",
    	"sym-wicc-s": "f8c2",
    	"sym-wicc": "f8c3",
    	"sym-win-s": "f8c4",
    	"sym-win": "f8c5",
    	"sym-wing-s": "f8c6",
    	"sym-wing": "f8c7",
    	"sym-wings-s": "f8c8",
    	"sym-wings": "f8c9",
    	"sym-wnxm-s": "f8ca",
    	"sym-wnxm": "f8cb",
    	"sym-woo-s": "f8cc",
    	"sym-woo": "f8cd",
    	"sym-wpr-s": "f8ce",
    	"sym-wpr": "f8cf",
    	"sym-wrx-s": "f8d0",
    	"sym-wrx": "f8d1",
    	"sym-wtc-s": "f8d2",
    	"sym-wtc": "f8d3",
    	"sym-wtt-s": "f8d4",
    	"sym-wtt": "f8d5",
    	"sym-wwb-s": "f8d6",
    	"sym-wwb": "f8d7",
    	"sym-wxt-s": "f8d8",
    	"sym-wxt": "f8d9",
    	"sym-xas-s": "f8da",
    	"sym-xas": "f8db",
    	"sym-xaur-s": "f8dc",
    	"sym-xaur": "f8dd",
    	"sym-xaut-s": "f8de",
    	"sym-xaut": "f8df",
    	"sym-xava-s": "f8e0",
    	"sym-xava": "f8e1",
    	"sym-xbc-s": "f8e2",
    	"sym-xbc": "f8e3",
    	"sym-xcon-s": "f8e4",
    	"sym-xcon": "f8e5",
    	"sym-xcp-s": "f8e6",
    	"sym-xcp": "f8e7",
    	"sym-xdn-s": "f8e8",
    	"sym-xdn": "f8e9",
    	"sym-xel-s": "f8ea",
    	"sym-xel": "f8eb",
    	"sym-xem-s": "f8ec",
    	"sym-xem": "f8ed",
    	"sym-xes-s": "f8ee",
    	"sym-xes": "f8ef",
    	"sym-xhv-s": "f8f0",
    	"sym-xhv": "f8f1",
    	"sym-xin-s": "f8f2",
    	"sym-xin": "f8f3",
    	"sym-xlm-s": "f8f4",
    	"sym-xlm": "f8f5",
    	"sym-xmc-s": "f8f6",
    	"sym-xmc": "f8f7",
    	"sym-xmr-s": "f8f8",
    	"sym-xmr": "f8f9",
    	"sym-xmx-s": "f8fa",
    	"sym-xmx": "f8fb",
    	"sym-xmy-s": "f8fc",
    	"sym-xmy": "f8fd",
    	"sym-xnk-s": "f8fe",
    	"sym-xnk": "f8ff",
    	"sym-xns-s": "f900",
    	"sym-xns": "f901",
    	"sym-xor-s": "f902",
    	"sym-xor": "f903",
    	"sym-xos-s": "f904",
    	"sym-xos": "f905",
    	"sym-xpm-s": "f906",
    	"sym-xpm": "f907",
    	"sym-xpr-s": "f908",
    	"sym-xpr": "f909",
    	"sym-xrc-s": "f90a",
    	"sym-xrc": "f90b",
    	"sym-xrp-s": "f90c",
    	"sym-xrp": "f90d",
    	"sym-xrpx-s": "f90e",
    	"sym-xrpx": "f90f",
    	"sym-xrt-s": "f910",
    	"sym-xrt": "f911",
    	"sym-xst-s": "f912",
    	"sym-xst": "f913",
    	"sym-xtp-s": "f914",
    	"sym-xtp": "f915",
    	"sym-xtz-s": "f916",
    	"sym-xtz": "f917",
    	"sym-xtzdown-s": "f918",
    	"sym-xtzdown": "f919",
    	"sym-xvc-s": "f91a",
    	"sym-xvc": "f91b",
    	"sym-xvg-s": "f91c",
    	"sym-xvg": "f91d",
    	"sym-xvs-s": "f91e",
    	"sym-xvs": "f91f",
    	"sym-xwc-s": "f920",
    	"sym-xwc": "f921",
    	"sym-xyo-s": "f922",
    	"sym-xyo": "f923",
    	"sym-xzc-s": "f924",
    	"sym-xzc": "f925",
    	"sym-yam-s": "f926",
    	"sym-yam": "f927",
    	"sym-yee-s": "f928",
    	"sym-yee": "f929",
    	"sym-yeed-s": "f92a",
    	"sym-yeed": "f92b",
    	"sym-yfi-s": "f92c",
    	"sym-yfi": "f92d",
    	"sym-yfii-s": "f92e",
    	"sym-yfii": "f92f",
    	"sym-ygg-s": "f930",
    	"sym-ygg": "f931",
    	"sym-yoyow-s": "f932",
    	"sym-yoyow": "f933",
    	"sym-zar-s": "f934",
    	"sym-zar": "f935",
    	"sym-zcl-s": "f936",
    	"sym-zcl": "f937",
    	"sym-zcn-s": "f938",
    	"sym-zcn": "f939",
    	"sym-zco-s": "f93a",
    	"sym-zco": "f93b",
    	"sym-zec-s": "f93c",
    	"sym-zec": "f93d",
    	"sym-zen-s": "f93e",
    	"sym-zen": "f93f",
    	"sym-zil-s": "f940",
    	"sym-zil": "f941",
    	"sym-zks-s": "f942",
    	"sym-zks": "f943",
    	"sym-zla-s": "f944",
    	"sym-zla": "f945",
    	"sym-zlk": "f946",
    	"sym-zondo-s": "f947",
    	"sym-zondo": "f948",
    	"sym-zpr-s": "f949",
    	"sym-zpr": "f94a",
    	"sym-zpt-s": "f94b",
    	"sym-zpt": "f94c",
    	"sym-zrc-s": "f94d",
    	"sym-zrc": "f94e",
    	"sym-zrx-s": "f94f",
    	"sym-zrx": "f950",
    	"sym-zsc-s": "f951",
    	"sym-zsc": "f952",
    	"sym-ztg-s": "f953",
    	"sym-ztg": "f954",
    	"cur-anct": "f1c2",
    	"cur-anct-s": "f1c1",
    	"cur-aud": "f1ee",
    	"cur-aud-s": "f1ed",
    	"cur-bnb": "f255",
    	"cur-bnb-s": "f254",
    	"sym-xbt": "f27b",
    	"cur-btc": "f27b",
    	"sym-xbt-s": "f27a",
    	"cur-btc-s": "f27a",
    	"cur-busd": "f299",
    	"cur-busd-s": "f298",
    	"exc-bitz": "f29d",
    	"cur-bz": "f29d",
    	"exc-bitz-s": "f29c",
    	"cur-bz-s": "f29c",
    	"cur-cad": "f2a7",
    	"cur-cad-s": "f2a6",
    	"cur-chf": "f2c7",
    	"cur-chf-s": "f2c6",
    	"cur-cny": "f2eb",
    	"cur-cny-s": "f2ea",
    	"sym-cs": "f2fd",
    	"sym-cs-s": "f2fc",
    	"sym-crm": "f311",
    	"sym-crm-s": "f310",
    	"cur-dai": "f33d",
    	"cur-dai-s": "f33c",
    	"sym-xdg": "f377",
    	"sym-xdg-s": "f376",
    	"cur-eos": "f3c0",
    	"cur-eos-s": "f3bf",
    	"sym-eth2": "f3d0",
    	"sym-eth2s": "f3d0",
    	"sym-eth2.s": "f3d0",
    	"sym-weth": "f3d0",
    	"cur-eth": "f3d0",
    	"sym-eth2-s": "f3cf",
    	"sym-eth2s-s": "f3cf",
    	"sym-eth2.s-s": "f3cf",
    	"sym-weth-s": "f3cf",
    	"cur-eth-s": "f3cf",
    	"cur-eur": "f3d8",
    	"cur-eur-s": "f3d7",
    	"cur-eurs": "f3da",
    	"cur-eurs-s": "f3d9",
    	"sym-usdt": "f3dc",
    	"cur-usdt": "f3dc",
    	"sym-usdt-s": "f3db",
    	"cur-usdt-s": "f3db",
    	"exc-kraken": "f3f0",
    	"exc-kraken-futures": "f3f0",
    	"exc-kraken-s": "f3ef",
    	"exc-kraken-futures-s": "f3ef",
    	"cur-gbp": "f438",
    	"cur-gbp-s": "f437",
    	"exc-gemini": "f474",
    	"cur-gusd": "f474",
    	"exc-gemini-s": "f473",
    	"cur-gusd-s": "f473",
    	"cur-hkd": "f494",
    	"cur-hkd-s": "f493",
    	"sym-husd": "f4ae",
    	"exc-huobi": "f4ae",
    	"cur-ht": "f4ae",
    	"sym-husd-s": "f4ad",
    	"exc-huobi-s": "f4ad",
    	"cur-ht-s": "f4ad",
    	"cur-idr": "f4cc",
    	"cur-idr-s": "f4cb",
    	"sym-iota": "f4f2",
    	"sym-iota-s": "f4f1",
    	"cur-inr": "f4e4",
    	"cur-inr-s": "f4e3",
    	"cur-jpy": "f506",
    	"cur-jpy-s": "f505",
    	"cur-krw": "f52e",
    	"cur-krw-s": "f52d",
    	"sym-medx": "f594",
    	"sym-medx-s": "f593",
    	"cur-mxn": "f5e4",
    	"cur-mxn-s": "f5e3",
    	"cur-myr": "f5e6",
    	"cur-myr-s": "f5e5",
    	"cur-ngn": "f610",
    	"cur-ngn-s": "f60f",
    	"cur-pax": "f67e",
    	"cur-pax-s": "f67d",
    	"cur-php": "f696",
    	"cur-php-s": "f695",
    	"cur-pln": "f6ac",
    	"cur-pln-s": "f6ab",
    	"cur-qash": "f6de",
    	"cur-qash-s": "f6dd",
    	"cur-rub": "f746",
    	"cur-rur": "f746",
    	"cur-rub-s": "f745",
    	"cur-rur-s": "f745",
    	"sym-steem": "f75c",
    	"sym-steem-s": "f75b",
    	"sym-xsc": "f760",
    	"sym-xsc-s": "f75f",
    	"cur-sgd": "f77c",
    	"cur-sgd-s": "f77b",
    	"sym-storj": "f790",
    	"sym-storj-s": "f78f",
    	"sym-tel": "f7fe",
    	"cur-trx": "f841",
    	"cur-trx-s": "f840",
    	"cur-tusd": "f851",
    	"cur-tusd-s": "f850",
    	"cur-usd": "f86f",
    	"cur-usd-s": "f86e",
    	"cur-usdc": "f871",
    	"cur-usdc-s": "f870",
    	"sym-vet": "f88b",
    	"sym-vet-s": "f88a",
    	"sym-waxp": "f8bb",
    	"sym-waxp-s": "f8ba",
    	"cur-xlm": "f8f5",
    	"cur-xlm-s": "f8f4",
    	"cur-xmr": "f8f9",
    	"cur-xmr-s": "f8f8",
    	"cur-xrp": "f90d",
    	"cur-xrp-s": "f90c",
    	"cur-zar": "f935",
    	"cur-zar-s": "f934",
    	"exc-binance-us": "f108",
    	"exc-binance-us-s": "f107",
    	"exc-mexbt": "f11e",
    	"exc-mexbt-s": "f11d",
    	"exc-coinbase-pro": "f128",
    	"exc-gdax": "f128",
    	"exc-coinbase-pro-s": "f127",
    	"exc-gdax-s": "f127",
    	"exc-quadriga": "f14e",
    	"exc-quadriga-s": "f14d",
    	"cur-crc": "f305",
    	"cur-crc-s": "f304",
    	"cur-lak": "f538",
    	"cur-lak-s": "f537",
    	"cur-sek": "f76c",
    	"cur-sek-s": "f76b",
    	"cur-thb": "f80d",
    	"cur-thb-s": "f80c",
    	"cur-try": "f843",
    	"cur-try-s": "f842",
    	"cur-uah": "f855",
    	"cur-uah-s": "f854",
    	"exc-ftx": "f41e",
    	"exc-ftx-s": "f41d",
    	"exc-ftx-us": "f41e",
    	"exc-ftx-us-s": "f41d",
    	"sym-cgld": "f2b7",
    	"sym-cgld-s": "f2b6",
    	"exc-uniswap-v2": "f867",
    	"exc-uniswap-v2-s": "f866",
    	"exc-comex": "f126",
    	"exc-comex-s": "f125",
    	"sym-kshib": "f782",
    	"sym-kshib-s": "f781",
    	"sym-easy-s": "f394",
    	"sym-srare": "f6fe",
    	"sym-srare-s": "f6fd",
    	"sym-ape.2": "f1c8",
    	"sym-ape.2-s": "f1c7"
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
    var aeon = "Aeon";
    var aep = "Aluminium European Premium Duty-Unpaid (Metal Bulletin) Futures";
    var aergo = "Aergo";
    var agi = "SingularityNET";
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
    var ape = "Bored Ape Yacht Club";
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
    var cad = "Canadian dollar";
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
    var easy = "EasyFi";
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
    var eur = "euro";
    var eurs = "STASIS EURS";
    var eurt = "Tether Euro";
    var evn = "Envion";
    var evx = "Everex";
    var ewt = "Energy Web Token";
    var exp = "Expanse";
    var exrd = "Radix";
    var exy = "";
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
    var sol = "Solana";
    var solo = "Sologenic";
    var solve = "SOLVE";
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
    var comex = "COMEX (Beta)";
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
    	aeon: aeon,
    	aep: aep,
    	aergo: aergo,
    	agi: agi,
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
    	sol: sol,
    	solo: solo,
    	solve: solve,
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
    	comex: comex,
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
