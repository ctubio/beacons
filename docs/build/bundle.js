
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
    	"sym-_default-s": "f163",
    	"sym-_default": "f164",
    	"sym-d": "f164",
    	"sym-d-s": "f163",
    	"sym-default": "f164",
    	"sym-default-s": "f163",
    	"exc-d": "f102",
    	"exc-d-s": "f101",
    	"exc-default": "f102",
    	"exc-default-s": "f101",
    	"cur-default": "f164",
    	"cur-default-s": "f163",
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
    	"exc-quick-s": "f151",
    	"exc-quick": "f152",
    	"exc-quoine-s": "f153",
    	"exc-quoine": "f154",
    	"exc-rarible-s": "f155",
    	"exc-rarible": "f156",
    	"exc-totle-s": "f157",
    	"exc-totle": "f158",
    	"exc-upbit-s": "f159",
    	"exc-upbit": "f15a",
    	"exc-vaultofsatoshi-s": "f15b",
    	"exc-vaultofsatoshi": "f15c",
    	"exc-wex-s": "f15d",
    	"exc-wex": "f15e",
    	"exc-zaif-s": "f15f",
    	"exc-zaif": "f160",
    	"exc-zonda-s": "f161",
    	"exc-zonda": "f162",
    	"sym-1inch-s": "f165",
    	"sym-1inch": "f166",
    	"sym-1st-s": "f167",
    	"sym-1st": "f168",
    	"sym-6a-s": "f169",
    	"sym-6a": "f16a",
    	"sym-6b-s": "f16b",
    	"sym-6b": "f16c",
    	"sym-6c-s": "f16d",
    	"sym-6c": "f16e",
    	"sym-6e-s": "f16f",
    	"sym-6e": "f170",
    	"sym-6j-s": "f171",
    	"sym-6j": "f172",
    	"sym-6l-s": "f173",
    	"sym-6l": "f174",
    	"sym-6m-s": "f175",
    	"sym-6m": "f176",
    	"sym-6n-s": "f177",
    	"sym-6n": "f178",
    	"sym-6s-s": "f179",
    	"sym-6s": "f17a",
    	"sym-a38-s": "f17b",
    	"sym-a38": "f17c",
    	"sym-aac-s": "f17d",
    	"sym-aac": "f17e",
    	"sym-aave-s": "f17f",
    	"sym-aave": "f180",
    	"sym-abbc-s": "f181",
    	"sym-abbc": "f182",
    	"sym-abt-s": "f183",
    	"sym-abt": "f184",
    	"sym-abyss-s": "f185",
    	"sym-abyss": "f186",
    	"sym-aca-s": "f187",
    	"sym-aca": "f188",
    	"sym-acat-s": "f189",
    	"sym-acat": "f18a",
    	"sym-ach-s": "f18b",
    	"sym-ach": "f18c",
    	"sym-act-s": "f18d",
    	"sym-act": "f18e",
    	"sym-ad0-s": "f18f",
    	"sym-ad0": "f190",
    	"sym-ada-s": "f191",
    	"sym-ada": "f192",
    	"sym-adel-s": "f193",
    	"sym-adel": "f194",
    	"sym-adh-s": "f195",
    	"sym-adh": "f196",
    	"sym-adm-s": "f197",
    	"sym-adm": "f198",
    	"sym-ado-s": "f199",
    	"sym-ado": "f19a",
    	"sym-adt-s": "f19b",
    	"sym-adt": "f19c",
    	"sym-adx-s": "f19d",
    	"sym-adx": "f19e",
    	"sym-ae-s": "f19f",
    	"sym-ae": "f1a0",
    	"sym-aed-s": "f1a1",
    	"sym-aed": "f1a2",
    	"sym-aeon-s": "f1a3",
    	"sym-aeon": "f1a4",
    	"sym-aep-s": "f1a5",
    	"sym-aep": "f1a6",
    	"sym-aergo-s": "f1a7",
    	"sym-aergo": "f1a8",
    	"sym-agi-s": "f1a9",
    	"sym-agi": "f1aa",
    	"sym-agld-s": "f1ab",
    	"sym-agld": "f1ac",
    	"sym-aid-s": "f1ad",
    	"sym-aid": "f1ae",
    	"sym-aion-s": "f1af",
    	"sym-aion": "f1b0",
    	"sym-air-s": "f1b1",
    	"sym-air": "f1b2",
    	"sym-akro-s": "f1b3",
    	"sym-akro": "f1b4",
    	"sym-akt-s": "f1b5",
    	"sym-akt": "f1b6",
    	"sym-alcx-s": "f1b7",
    	"sym-alcx": "f1b8",
    	"sym-algo-s": "f1b9",
    	"sym-algo": "f1ba",
    	"sym-ali-s": "f1bb",
    	"sym-ali": "f1bc",
    	"sym-alice-s": "f1bd",
    	"sym-alice": "f1be",
    	"sym-alpha-s": "f1bf",
    	"sym-alpha": "f1c0",
    	"sym-amb-s": "f1c1",
    	"sym-amb": "f1c2",
    	"sym-amlt-s": "f1c3",
    	"sym-amlt": "f1c4",
    	"sym-amp-s": "f1c5",
    	"sym-amp": "f1c6",
    	"sym-ampl-s": "f1c7",
    	"sym-ampl": "f1c8",
    	"sym-anct-s": "f1c9",
    	"sym-anct": "f1ca",
    	"sym-ankr-s": "f1cb",
    	"sym-ankr": "f1cc",
    	"sym-ant-s": "f1cd",
    	"sym-ant": "f1ce",
    	"sym-ape-s": "f1cf",
    	"sym-ape": "f1d0",
    	"sym-api3-s": "f1d1",
    	"sym-api3": "f1d2",
    	"sym-apis-s": "f1d3",
    	"sym-apis": "f1d4",
    	"sym-appc-s": "f1d5",
    	"sym-appc": "f1d6",
    	"sym-ar-s": "f1d7",
    	"sym-ar": "f1d8",
    	"sym-ardr-s": "f1d9",
    	"sym-ardr": "f1da",
    	"sym-ark-s": "f1db",
    	"sym-ark": "f1dc",
    	"sym-arn-s": "f1dd",
    	"sym-arn": "f1de",
    	"sym-arpa-s": "f1df",
    	"sym-arpa": "f1e0",
    	"sym-art-s": "f1e1",
    	"sym-art": "f1e2",
    	"sym-aspt-s": "f1e3",
    	"sym-aspt": "f1e4",
    	"sym-ast-s": "f1e5",
    	"sym-ast": "f1e6",
    	"sym-astr-s": "f1e7",
    	"sym-astr": "f1e8",
    	"sym-at-s": "f1e9",
    	"sym-at": "f1ea",
    	"sym-atlas-s": "f1eb",
    	"sym-atlas": "f1ec",
    	"sym-atm-s": "f1ed",
    	"sym-atm": "f1ee",
    	"sym-atom-s": "f1ef",
    	"sym-atom": "f1f0",
    	"sym-atp-s": "f1f1",
    	"sym-atp": "f1f2",
    	"sym-auction-s": "f1f3",
    	"sym-auction": "f1f4",
    	"sym-aud-s": "f1f5",
    	"sym-aud": "f1f6",
    	"sym-audio-s": "f1f7",
    	"sym-audio": "f1f8",
    	"sym-aup-s": "f1f9",
    	"sym-aup": "f1fa",
    	"sym-auto-s": "f1fb",
    	"sym-auto": "f1fc",
    	"sym-ava-s": "f1fd",
    	"sym-ava": "f1fe",
    	"sym-avax-s": "f1ff",
    	"sym-avax": "f200",
    	"sym-avt-s": "f201",
    	"sym-avt": "f202",
    	"sym-axp-s": "f203",
    	"sym-axp": "f204",
    	"sym-axs-s": "f205",
    	"sym-axs": "f206",
    	"sym-b": "f207",
    	"sym-b0-s": "f208",
    	"sym-b0": "f209",
    	"sym-b2g-s": "f20a",
    	"sym-b2g": "f20b",
    	"sym-bab-s": "f20c",
    	"sym-bab": "f20d",
    	"sym-badger-s": "f20e",
    	"sym-badger": "f20f",
    	"sym-bake-s": "f210",
    	"sym-bake": "f211",
    	"sym-bal-s": "f212",
    	"sym-bal": "f213",
    	"sym-banca-s": "f214",
    	"sym-banca": "f215",
    	"sym-band-s": "f216",
    	"sym-band": "f217",
    	"sym-bat-s": "f218",
    	"sym-bat": "f219",
    	"sym-bay-s": "f21a",
    	"sym-bay": "f21b",
    	"sym-bbc-s": "f21c",
    	"sym-bbc": "f21d",
    	"sym-bcc-s": "f21e",
    	"sym-bcc": "f21f",
    	"sym-bcd-s": "f220",
    	"sym-bcd": "f221",
    	"sym-bch-s": "f222",
    	"sym-bch": "f223",
    	"sym-bci-s": "f224",
    	"sym-bci": "f225",
    	"sym-bcn-s": "f226",
    	"sym-bcn": "f227",
    	"sym-bcpt-s": "f228",
    	"sym-bcpt": "f229",
    	"sym-bcu-s": "f22a",
    	"sym-bcu": "f22b",
    	"sym-bcv-s": "f22c",
    	"sym-bcv": "f22d",
    	"sym-bcy-s": "f22e",
    	"sym-bcy": "f22f",
    	"sym-bdg-s": "f230",
    	"sym-bdg": "f231",
    	"sym-beam-s": "f232",
    	"sym-beam": "f233",
    	"sym-beet-s": "f234",
    	"sym-beet": "f235",
    	"sym-bel-s": "f236",
    	"sym-bel": "f237",
    	"sym-bela-s": "f238",
    	"sym-bela": "f239",
    	"sym-berry-s": "f23a",
    	"sym-berry": "f23b",
    	"sym-betr-s": "f23c",
    	"sym-betr": "f23d",
    	"sym-bez-s": "f23e",
    	"sym-bez": "f23f",
    	"sym-bft-s": "f240",
    	"sym-bft": "f241",
    	"sym-bfx-s": "f242",
    	"sym-bfx": "f243",
    	"sym-bhd-s": "f244",
    	"sym-bhd": "f245",
    	"sym-bht-s": "f246",
    	"sym-bht": "f247",
    	"sym-bico-s": "f248",
    	"sym-bico": "f249",
    	"sym-bitb-s": "f24a",
    	"sym-bitb": "f24b",
    	"sym-bix-s": "f24c",
    	"sym-bix": "f24d",
    	"sym-bk-s": "f24e",
    	"sym-bk": "f24f",
    	"sym-bkx-s": "f250",
    	"sym-bkx": "f251",
    	"sym-blk-s": "f252",
    	"sym-blk": "f253",
    	"sym-block-s": "f254",
    	"sym-block": "f255",
    	"sym-blt-s": "f256",
    	"sym-blt": "f257",
    	"sym-blz-s": "f258",
    	"sym-blz": "f259",
    	"sym-bmc-s": "f25a",
    	"sym-bmc": "f25b",
    	"sym-bnb-s": "f25c",
    	"sym-bnb": "f25d",
    	"sym-bnc-s": "f25e",
    	"sym-bnc": "f25f",
    	"sym-bnk-s": "f260",
    	"sym-bnk": "f261",
    	"sym-bnt-s": "f262",
    	"sym-bnt": "f263",
    	"sym-bo-s": "f264",
    	"sym-bo": "f265",
    	"sym-bond-s": "f266",
    	"sym-bond": "f267",
    	"sym-boo-s": "f268",
    	"sym-boo": "f269",
    	"sym-bor-s": "f26a",
    	"sym-bor": "f26b",
    	"sym-bora-s": "f26c",
    	"sym-bora": "f26d",
    	"sym-bos-s": "f26e",
    	"sym-bos": "f26f",
    	"sym-box-s": "f270",
    	"sym-box": "f271",
    	"sym-brd-s": "f272",
    	"sym-brd": "f273",
    	"sym-brg-s": "f274",
    	"sym-brg": "f275",
    	"sym-brick-s": "f276",
    	"sym-brick": "f277",
    	"sym-bsd-s": "f278",
    	"sym-bsd": "f279",
    	"sym-bsv-s": "f27a",
    	"sym-bsv": "f27b",
    	"sym-bsx-s": "f27c",
    	"sym-bsx": "f27d",
    	"sym-bt1-s": "f27e",
    	"sym-bt1": "f27f",
    	"sym-bt2-s": "f280",
    	"sym-bt2": "f281",
    	"sym-btc-s": "f282",
    	"sym-btc": "f283",
    	"sym-btcd-s": "f284",
    	"sym-btcd": "f285",
    	"sym-btcfx-s": "f286",
    	"sym-btcfx": "f287",
    	"sym-btcp-s": "f288",
    	"sym-btcp": "f289",
    	"sym-btg-s": "f28a",
    	"sym-btg": "f28b",
    	"sym-btm-s": "f28c",
    	"sym-btm": "f28d",
    	"sym-btn-s": "f28e",
    	"sym-btn": "f28f",
    	"sym-bto-s": "f290",
    	"sym-bto": "f291",
    	"sym-bts-s": "f292",
    	"sym-bts": "f293",
    	"sym-btt-s": "f294",
    	"sym-btt": "f295",
    	"sym-btu-s": "f296",
    	"sym-btu": "f297",
    	"sym-btx-s": "f298",
    	"sym-btx": "f299",
    	"sym-burger-s": "f29a",
    	"sym-burger": "f29b",
    	"sym-burst-s": "f29c",
    	"sym-burst": "f29d",
    	"sym-bus-s": "f29e",
    	"sym-bus": "f29f",
    	"sym-busd-s": "f2a0",
    	"sym-busd": "f2a1",
    	"sym-bwx-s": "f2a2",
    	"sym-bwx": "f2a3",
    	"sym-bz-s": "f2a4",
    	"sym-bz": "f2a5",
    	"sym-bzrx-s": "f2a6",
    	"sym-bzrx": "f2a7",
    	"sym-c-s": "f2a8",
    	"sym-c": "f2a9",
    	"sym-c20-s": "f2aa",
    	"sym-c20": "f2ab",
    	"sym-c98-s": "f2ac",
    	"sym-c98": "f2ad",
    	"sym-cad-s": "f2ae",
    	"sym-cad": "f2af",
    	"sym-cake-s": "f2b0",
    	"sym-cake": "f2b1",
    	"sym-cas-s": "f2b2",
    	"sym-cas": "f2b3",
    	"sym-cat-s": "f2b4",
    	"sym-cat": "f2b5",
    	"sym-cbc-s": "f2b6",
    	"sym-cbc": "f2b7",
    	"sym-cbt-s": "f2b8",
    	"sym-cbt": "f2b9",
    	"sym-cdt-s": "f2ba",
    	"sym-cdt": "f2bb",
    	"sym-cel-s": "f2bc",
    	"sym-cel": "f2bd",
    	"sym-celo-s": "f2be",
    	"sym-celo": "f2bf",
    	"sym-celr-s": "f2c0",
    	"sym-celr": "f2c1",
    	"sym-cennz-s": "f2c2",
    	"sym-cennz": "f2c3",
    	"sym-cfg-s": "f2c4",
    	"sym-cfg": "f2c5",
    	"sym-cfi-s": "f2c6",
    	"sym-cfi": "f2c7",
    	"sym-cfx-s": "f2c8",
    	"sym-cfx": "f2c9",
    	"sym-cgt-s": "f2ca",
    	"sym-cgt": "f2cb",
    	"sym-chat-s": "f2cc",
    	"sym-chat": "f2cd",
    	"sym-chf-s": "f2ce",
    	"sym-chf": "f2cf",
    	"sym-chp-s": "f2d0",
    	"sym-chp": "f2d1",
    	"sym-chr-s": "f2d2",
    	"sym-chr": "f2d3",
    	"sym-chsb-s": "f2d4",
    	"sym-chsb": "f2d5",
    	"sym-chx-s": "f2d6",
    	"sym-chx": "f2d7",
    	"sym-chz-s": "f2d8",
    	"sym-chz": "f2d9",
    	"sym-ckb-s": "f2da",
    	"sym-ckb": "f2db",
    	"sym-cl-s": "f2dc",
    	"sym-cl": "f2dd",
    	"sym-clam-s": "f2de",
    	"sym-clam": "f2df",
    	"sym-cln-s": "f2e0",
    	"sym-cln": "f2e1",
    	"sym-clo-s": "f2e2",
    	"sym-clo": "f2e3",
    	"sym-cloak-s": "f2e4",
    	"sym-cloak": "f2e5",
    	"sym-clv-s": "f2e6",
    	"sym-clv": "f2e7",
    	"sym-cmct-s": "f2e8",
    	"sym-cmct": "f2e9",
    	"sym-cmt-s": "f2ea",
    	"sym-cmt": "f2eb",
    	"sym-cnd-s": "f2ec",
    	"sym-cnd": "f2ed",
    	"sym-cnn-s": "f2ee",
    	"sym-cnn": "f2ef",
    	"sym-cnx-s": "f2f0",
    	"sym-cnx": "f2f1",
    	"sym-cny-s": "f2f2",
    	"sym-cny": "f2f3",
    	"sym-cob-s": "f2f4",
    	"sym-cob": "f2f5",
    	"sym-cocos-s": "f2f6",
    	"sym-cocos": "f2f7",
    	"sym-comp-s": "f2f8",
    	"sym-comp": "f2f9",
    	"sym-cope-s": "f2fa",
    	"sym-cope": "f2fb",
    	"sym-cos-s": "f2fc",
    	"sym-cos": "f2fd",
    	"sym-cosm-s": "f2fe",
    	"sym-cosm": "f2ff",
    	"sym-coss-s": "f300",
    	"sym-coss": "f301",
    	"sym-coti-s": "f302",
    	"sym-coti": "f303",
    	"sym-cov-s": "f304",
    	"sym-cov": "f305",
    	"sym-cova-s": "f306",
    	"sym-cova": "f307",
    	"sym-cpt-s": "f308",
    	"sym-cpt": "f309",
    	"sym-cpx-s": "f30a",
    	"sym-cpx": "f30b",
    	"sym-cqt-s": "f30c",
    	"sym-cqt": "f30d",
    	"sym-crab-s": "f30e",
    	"sym-crab": "f30f",
    	"sym-crc-s": "f310",
    	"sym-crc": "f311",
    	"sym-cre-s": "f312",
    	"sym-cre": "f313",
    	"sym-cream-s": "f314",
    	"sym-cream": "f315",
    	"sym-cring-s": "f316",
    	"sym-cring": "f317",
    	"sym-cro-s": "f318",
    	"sym-cro": "f319",
    	"sym-crpt-s": "f31a",
    	"sym-crpt": "f31b",
    	"sym-cru-s": "f31c",
    	"sym-cru": "f31d",
    	"sym-crv-s": "f31e",
    	"sym-crv": "f31f",
    	"sym-crw-s": "f320",
    	"sym-crw": "f321",
    	"sym-csm-s": "f322",
    	"sym-csm": "f323",
    	"sym-csx-s": "f324",
    	"sym-csx": "f325",
    	"sym-ctc-s": "f326",
    	"sym-ctc": "f327",
    	"sym-ctk-s": "f328",
    	"sym-ctk": "f329",
    	"sym-ctsi-s": "f32a",
    	"sym-ctsi": "f32b",
    	"sym-ctxc-s": "f32c",
    	"sym-ctxc": "f32d",
    	"sym-cur-s": "f32e",
    	"sym-cur": "f32f",
    	"sym-cvc-s": "f330",
    	"sym-cvc": "f331",
    	"sym-cvcoin-s": "f332",
    	"sym-cvcoin": "f333",
    	"sym-cvnt-s": "f334",
    	"sym-cvnt": "f335",
    	"sym-cvp-s": "f336",
    	"sym-cvp": "f337",
    	"sym-cvt-s": "f338",
    	"sym-cvt": "f339",
    	"sym-cvx-s": "f33a",
    	"sym-cvx": "f33b",
    	"sym-cw-s": "f33c",
    	"sym-cw": "f33d",
    	"sym-cyc-s": "f33e",
    	"sym-cyc": "f33f",
    	"sym-dac-s": "f340",
    	"sym-dac": "f341",
    	"sym-dacs-s": "f342",
    	"sym-dacs": "f343",
    	"sym-dadi-s": "f344",
    	"sym-dadi": "f345",
    	"sym-dag-s": "f346",
    	"sym-dag": "f347",
    	"sym-dai-s": "f348",
    	"sym-dai": "f349",
    	"sym-dao-s": "f34a",
    	"sym-dao": "f34b",
    	"sym-dar-s": "f34c",
    	"sym-dar": "f34d",
    	"sym-dash-s": "f34e",
    	"sym-dash": "f34f",
    	"sym-dat-s": "f350",
    	"sym-dat": "f351",
    	"sym-data-s": "f352",
    	"sym-data": "f353",
    	"sym-datx-s": "f354",
    	"sym-datx": "f355",
    	"sym-dbc-s": "f356",
    	"sym-dbc": "f357",
    	"sym-dbet-s": "f358",
    	"sym-dbet": "f359",
    	"sym-dbix-s": "f35a",
    	"sym-dbix": "f35b",
    	"sym-dcn-s": "f35c",
    	"sym-dcn": "f35d",
    	"sym-dcr-s": "f35e",
    	"sym-dcr": "f35f",
    	"sym-dct-s": "f360",
    	"sym-dct": "f361",
    	"sym-ddd-s": "f362",
    	"sym-ddd": "f363",
    	"sym-dego-s": "f364",
    	"sym-dego": "f365",
    	"sym-dent-s": "f366",
    	"sym-dent": "f367",
    	"sym-dgb-s": "f368",
    	"sym-dgb": "f369",
    	"sym-dgd-s": "f36a",
    	"sym-dgd": "f36b",
    	"sym-dgtx-s": "f36c",
    	"sym-dgtx": "f36d",
    	"sym-dgx-s": "f36e",
    	"sym-dgx": "f36f",
    	"sym-dhx-s": "f370",
    	"sym-dhx": "f371",
    	"sym-dia-s": "f372",
    	"sym-dia": "f373",
    	"sym-dice-s": "f374",
    	"sym-dice": "f375",
    	"sym-dim-s": "f376",
    	"sym-dim": "f377",
    	"sym-dlt-s": "f378",
    	"sym-dlt": "f379",
    	"sym-dmd-s": "f37a",
    	"sym-dmd": "f37b",
    	"sym-dmt-s": "f37c",
    	"sym-dmt": "f37d",
    	"sym-dnt-s": "f37e",
    	"sym-dnt": "f37f",
    	"sym-dock-s": "f380",
    	"sym-dock": "f381",
    	"sym-dodo-s": "f382",
    	"sym-dodo": "f383",
    	"sym-doge-s": "f384",
    	"sym-doge": "f385",
    	"sym-dot-s": "f386",
    	"sym-dot": "f387",
    	"sym-dpy-s": "f388",
    	"sym-dpy": "f389",
    	"sym-dream-s": "f38a",
    	"sym-dream": "f38b",
    	"sym-drep-s": "f38c",
    	"sym-drep": "f38d",
    	"sym-drg-s": "f38e",
    	"sym-drg": "f38f",
    	"sym-drgn-s": "f390",
    	"sym-drgn": "f391",
    	"sym-drt-s": "f392",
    	"sym-drt": "f393",
    	"sym-dta-s": "f394",
    	"sym-dta": "f395",
    	"sym-dtb-s": "f396",
    	"sym-dtb": "f397",
    	"sym-dtr-s": "f398",
    	"sym-dtr": "f399",
    	"sym-dusk-s": "f39a",
    	"sym-dusk": "f39b",
    	"sym-dx-s": "f39c",
    	"sym-dx": "f39d",
    	"sym-dydx-s": "f39e",
    	"sym-dydx": "f39f",
    	"sym-dyn-s": "f3a0",
    	"sym-dyn": "f3a1",
    	"sym-easy": "f3a2",
    	"sym-ecom-s": "f3a3",
    	"sym-ecom": "f3a4",
    	"sym-edc-s": "f3a5",
    	"sym-edc": "f3a6",
    	"sym-edg-s": "f3a7",
    	"sym-edg": "f3a8",
    	"sym-edo-s": "f3a9",
    	"sym-edo": "f3aa",
    	"sym-edp-s": "f3ab",
    	"sym-edp": "f3ac",
    	"sym-edr-s": "f3ad",
    	"sym-edr": "f3ae",
    	"sym-efi-s": "f3af",
    	"sym-efi": "f3b0",
    	"sym-egld-s": "f3b1",
    	"sym-egld": "f3b2",
    	"sym-egt-s": "f3b3",
    	"sym-egt": "f3b4",
    	"sym-ehr-s": "f3b5",
    	"sym-ehr": "f3b6",
    	"sym-eko-s": "f3b7",
    	"sym-eko": "f3b8",
    	"sym-ekt-s": "f3b9",
    	"sym-ekt": "f3ba",
    	"sym-ela-s": "f3bb",
    	"sym-ela": "f3bc",
    	"sym-elec-s": "f3bd",
    	"sym-elec": "f3be",
    	"sym-elf-s": "f3bf",
    	"sym-elf": "f3c0",
    	"sym-em-s": "f3c1",
    	"sym-em": "f3c2",
    	"sym-emc-s": "f3c3",
    	"sym-emc": "f3c4",
    	"sym-emc2-s": "f3c5",
    	"sym-emc2": "f3c6",
    	"sym-eng-s": "f3c7",
    	"sym-eng": "f3c8",
    	"sym-enj-s": "f3c9",
    	"sym-enj": "f3ca",
    	"sym-ens-s": "f3cb",
    	"sym-ens": "f3cc",
    	"sym-eos-s": "f3cd",
    	"sym-eos": "f3ce",
    	"sym-eosdac-s": "f3cf",
    	"sym-eosdac": "f3d0",
    	"sym-eq-s": "f3d1",
    	"sym-eq": "f3d2",
    	"sym-erd-s": "f3d3",
    	"sym-erd": "f3d4",
    	"sym-ern-s": "f3d5",
    	"sym-ern": "f3d6",
    	"sym-es": "f3d7",
    	"sym-es-s": "f3d8",
    	"sym-esd-s": "f3d9",
    	"sym-esd": "f3da",
    	"sym-etc-s": "f3db",
    	"sym-etc": "f3dc",
    	"sym-eth-s": "f3dd",
    	"sym-eth": "f3de",
    	"sym-ethup-s": "f3df",
    	"sym-ethup": "f3e0",
    	"sym-etn-s": "f3e1",
    	"sym-etn": "f3e2",
    	"sym-etp-s": "f3e3",
    	"sym-etp": "f3e4",
    	"sym-eur-s": "f3e5",
    	"sym-eur": "f3e6",
    	"sym-eurs-s": "f3e7",
    	"sym-eurs": "f3e8",
    	"sym-eurt-s": "f3e9",
    	"sym-eurt": "f3ea",
    	"sym-evn-s": "f3eb",
    	"sym-evn": "f3ec",
    	"sym-evx-s": "f3ed",
    	"sym-evx": "f3ee",
    	"sym-ewt-s": "f3ef",
    	"sym-ewt": "f3f0",
    	"sym-exp-s": "f3f1",
    	"sym-exp": "f3f2",
    	"sym-exrd-s": "f3f3",
    	"sym-exrd": "f3f4",
    	"sym-exy-s": "f3f5",
    	"sym-exy": "f3f6",
    	"sym-ez-s": "f3f7",
    	"sym-ez": "f3f8",
    	"sym-fair-s": "f3f9",
    	"sym-fair": "f3fa",
    	"sym-farm-s": "f3fb",
    	"sym-farm": "f3fc",
    	"sym-fct-s": "f3fd",
    	"sym-fct": "f3fe",
    	"sym-fdz-s": "f3ff",
    	"sym-fdz": "f400",
    	"sym-fee-s": "f401",
    	"sym-fee": "f402",
    	"sym-fet-s": "f403",
    	"sym-fet": "f404",
    	"sym-fida-s": "f405",
    	"sym-fida": "f406",
    	"sym-fil-s": "f407",
    	"sym-fil": "f408",
    	"sym-fio-s": "f409",
    	"sym-fio": "f40a",
    	"sym-firo-s": "f40b",
    	"sym-firo": "f40c",
    	"sym-fis-s": "f40d",
    	"sym-fis": "f40e",
    	"sym-fldc-s": "f40f",
    	"sym-fldc": "f410",
    	"sym-flo-s": "f411",
    	"sym-flo": "f412",
    	"sym-floki-s": "f413",
    	"sym-floki": "f414",
    	"sym-flow-s": "f415",
    	"sym-flow": "f416",
    	"sym-flr-s": "f417",
    	"sym-flr": "f418",
    	"sym-fluz-s": "f419",
    	"sym-fluz": "f41a",
    	"sym-fnb-s": "f41b",
    	"sym-fnb": "f41c",
    	"sym-foam-s": "f41d",
    	"sym-foam": "f41e",
    	"sym-for-s": "f41f",
    	"sym-for": "f420",
    	"sym-forth-s": "f421",
    	"sym-forth": "f422",
    	"sym-fota-s": "f423",
    	"sym-fota": "f424",
    	"sym-frax-s": "f425",
    	"sym-frax": "f426",
    	"sym-front-s": "f427",
    	"sym-front": "f428",
    	"sym-fsn-s": "f429",
    	"sym-fsn": "f42a",
    	"sym-ftc-s": "f42b",
    	"sym-ftc": "f42c",
    	"sym-fti-s": "f42d",
    	"sym-fti": "f42e",
    	"sym-ftm-s": "f42f",
    	"sym-ftm": "f430",
    	"sym-ftt-s": "f431",
    	"sym-ftt": "f432",
    	"sym-ftx-s": "f433",
    	"sym-ftx": "f434",
    	"sym-fuel-s": "f435",
    	"sym-fuel": "f436",
    	"sym-fun-s": "f437",
    	"sym-fun": "f438",
    	"sym-fx-s": "f439",
    	"sym-fx": "f43a",
    	"sym-fxc-s": "f43b",
    	"sym-fxc": "f43c",
    	"sym-fxs-s": "f43d",
    	"sym-fxs": "f43e",
    	"sym-fxt-s": "f43f",
    	"sym-fxt": "f440",
    	"sym-gala-s": "f441",
    	"sym-gala": "f442",
    	"sym-game-s": "f443",
    	"sym-game": "f444",
    	"sym-gard-s": "f445",
    	"sym-gard": "f446",
    	"sym-gari-s": "f447",
    	"sym-gari": "f448",
    	"sym-gas-s": "f449",
    	"sym-gas": "f44a",
    	"sym-gbc-s": "f44b",
    	"sym-gbc": "f44c",
    	"sym-gbp-s": "f44d",
    	"sym-gbp": "f44e",
    	"sym-gbx-s": "f44f",
    	"sym-gbx": "f450",
    	"sym-gbyte-s": "f451",
    	"sym-gbyte": "f452",
    	"sym-gc-s": "f453",
    	"sym-gc": "f454",
    	"sym-gcc-s": "f455",
    	"sym-gcc": "f456",
    	"sym-ge-s": "f457",
    	"sym-ge": "f458",
    	"sym-geist-s": "f459",
    	"sym-geist": "f45a",
    	"sym-gen-s": "f45b",
    	"sym-gen": "f45c",
    	"sym-gens-s": "f45d",
    	"sym-gens": "f45e",
    	"sym-get-s": "f45f",
    	"sym-get": "f460",
    	"sym-ghst-s": "f461",
    	"sym-ghst": "f462",
    	"sym-glc-s": "f463",
    	"sym-glc": "f464",
    	"sym-gld-s": "f465",
    	"sym-gld": "f466",
    	"sym-glm-s": "f467",
    	"sym-glm": "f468",
    	"sym-glmr-s": "f469",
    	"sym-glmr": "f46a",
    	"sym-gmat-s": "f46b",
    	"sym-gmat": "f46c",
    	"sym-gmt-s": "f46d",
    	"sym-gmt": "f46e",
    	"sym-gno-s": "f46f",
    	"sym-gno": "f470",
    	"sym-gnt-s": "f471",
    	"sym-gnt": "f472",
    	"sym-gnx-s": "f473",
    	"sym-gnx": "f474",
    	"sym-go-s": "f475",
    	"sym-go": "f476",
    	"sym-gods-s": "f477",
    	"sym-gods": "f478",
    	"sym-got-s": "f479",
    	"sym-got": "f47a",
    	"sym-grc-s": "f47b",
    	"sym-grc": "f47c",
    	"sym-grin-s": "f47d",
    	"sym-grin": "f47e",
    	"sym-grs-s": "f47f",
    	"sym-grs": "f480",
    	"sym-grt-s": "f481",
    	"sym-grt": "f482",
    	"sym-gsc-s": "f483",
    	"sym-gsc": "f484",
    	"sym-gst-s": "f485",
    	"sym-gst": "f486",
    	"sym-gt-s": "f487",
    	"sym-gt": "f488",
    	"sym-gtc-s": "f489",
    	"sym-gtc": "f48a",
    	"sym-gtc2-s": "f48b",
    	"sym-gtc2": "f48c",
    	"sym-gto-s": "f48d",
    	"sym-gto": "f48e",
    	"sym-gup-s": "f48f",
    	"sym-gup": "f490",
    	"sym-gusd-s": "f491",
    	"sym-gusd": "f492",
    	"sym-gvt-s": "f493",
    	"sym-gvt": "f494",
    	"sym-gxc-s": "f495",
    	"sym-gxc": "f496",
    	"sym-gxs-s": "f497",
    	"sym-gxs": "f498",
    	"sym-hard-s": "f499",
    	"sym-hard": "f49a",
    	"sym-hbar-s": "f49b",
    	"sym-hbar": "f49c",
    	"sym-hc-s": "f49d",
    	"sym-hc": "f49e",
    	"sym-hdx-s": "f49f",
    	"sym-hdx": "f4a0",
    	"sym-hedg-s": "f4a1",
    	"sym-hedg": "f4a2",
    	"sym-hex-s": "f4a3",
    	"sym-hex": "f4a4",
    	"sym-hft-s": "f4a5",
    	"sym-hft": "f4a6",
    	"sym-hg-s": "f4a7",
    	"sym-hg": "f4a8",
    	"sym-hgs-s": "f4a9",
    	"sym-hgs": "f4aa",
    	"sym-hh-s": "f4ab",
    	"sym-hh": "f4ac",
    	"sym-high-s": "f4ad",
    	"sym-high": "f4ae",
    	"sym-hit-s": "f4af",
    	"sym-hit": "f4b0",
    	"sym-hive-s": "f4b1",
    	"sym-hive": "f4b2",
    	"sym-hkd-s": "f4b3",
    	"sym-hkd": "f4b4",
    	"sym-hmq-s": "f4b5",
    	"sym-hmq": "f4b6",
    	"sym-hns-s": "f4b7",
    	"sym-hns": "f4b8",
    	"sym-ho-s": "f4b9",
    	"sym-ho": "f4ba",
    	"sym-hot-s": "f4bb",
    	"sym-hot": "f4bc",
    	"sym-hp-s": "f4bd",
    	"sym-hp": "f4be",
    	"sym-hpb-s": "f4bf",
    	"sym-hpb": "f4c0",
    	"sym-hpc-s": "f4c1",
    	"sym-hpc": "f4c2",
    	"sym-hpt-s": "f4c3",
    	"sym-hpt": "f4c4",
    	"sym-hrc-s": "f4c5",
    	"sym-hrc": "f4c6",
    	"sym-hsc-s": "f4c7",
    	"sym-hsc": "f4c8",
    	"sym-hsr-s": "f4c9",
    	"sym-hsr": "f4ca",
    	"sym-hst-s": "f4cb",
    	"sym-hst": "f4cc",
    	"sym-ht-s": "f4cd",
    	"sym-ht": "f4ce",
    	"sym-html-s": "f4cf",
    	"sym-html": "f4d0",
    	"sym-htt-s": "f4d1",
    	"sym-htt": "f4d2",
    	"sym-huc-s": "f4d3",
    	"sym-huc": "f4d4",
    	"sym-hvn-s": "f4d5",
    	"sym-hvn": "f4d6",
    	"sym-hxro-s": "f4d7",
    	"sym-hxro": "f4d8",
    	"sym-hyc-s": "f4d9",
    	"sym-hyc": "f4da",
    	"sym-hydra-s": "f4db",
    	"sym-hydra": "f4dc",
    	"sym-hydro-s": "f4dd",
    	"sym-hydro": "f4de",
    	"sym-icn-s": "f4df",
    	"sym-icn": "f4e0",
    	"sym-icos-s": "f4e1",
    	"sym-icos": "f4e2",
    	"sym-icp-s": "f4e3",
    	"sym-icp": "f4e4",
    	"sym-icx-s": "f4e5",
    	"sym-icx": "f4e6",
    	"sym-idex-s": "f4e7",
    	"sym-idex": "f4e8",
    	"sym-idh-s": "f4e9",
    	"sym-idh": "f4ea",
    	"sym-idr-s": "f4eb",
    	"sym-idr": "f4ec",
    	"sym-ift-s": "f4ed",
    	"sym-ift": "f4ee",
    	"sym-ignis-s": "f4ef",
    	"sym-ignis": "f4f0",
    	"sym-ihf-s": "f4f1",
    	"sym-ihf": "f4f2",
    	"sym-iht-s": "f4f3",
    	"sym-iht": "f4f4",
    	"sym-ilc-s": "f4f5",
    	"sym-ilc": "f4f6",
    	"sym-ilv-s": "f4f7",
    	"sym-ilv": "f4f8",
    	"sym-imx-s": "f4f9",
    	"sym-imx": "f4fa",
    	"sym-incnt-s": "f4fb",
    	"sym-incnt": "f4fc",
    	"sym-ind-s": "f4fd",
    	"sym-ind": "f4fe",
    	"sym-inj-s": "f4ff",
    	"sym-inj": "f500",
    	"sym-ink-s": "f501",
    	"sym-ink": "f502",
    	"sym-inr-s": "f503",
    	"sym-inr": "f504",
    	"sym-ins-s": "f505",
    	"sym-ins": "f506",
    	"sym-int-s": "f507",
    	"sym-int": "f508",
    	"sym-intr-s": "f509",
    	"sym-intr": "f50a",
    	"sym-ioc-s": "f50b",
    	"sym-ioc": "f50c",
    	"sym-ion-s": "f50d",
    	"sym-ion": "f50e",
    	"sym-iost-s": "f50f",
    	"sym-iost": "f510",
    	"sym-iot-s": "f511",
    	"sym-iot": "f512",
    	"sym-iotx-s": "f513",
    	"sym-iotx": "f514",
    	"sym-iq-s": "f515",
    	"sym-iq": "f516",
    	"sym-iris-s": "f517",
    	"sym-iris": "f518",
    	"sym-itc-s": "f519",
    	"sym-itc": "f51a",
    	"sym-ivy-s": "f51b",
    	"sym-ivy": "f51c",
    	"sym-ixt-s": "f51d",
    	"sym-ixt": "f51e",
    	"sym-jasmy-s": "f51f",
    	"sym-jasmy": "f520",
    	"sym-jnt-s": "f521",
    	"sym-jnt": "f522",
    	"sym-joe-s": "f523",
    	"sym-joe": "f524",
    	"sym-jpy-s": "f525",
    	"sym-jpy": "f526",
    	"sym-jst-s": "f527",
    	"sym-jst": "f528",
    	"sym-juno-s": "f529",
    	"sym-juno": "f52a",
    	"sym-juv-s": "f52b",
    	"sym-juv": "f52c",
    	"sym-kan-s": "f52d",
    	"sym-kan": "f52e",
    	"sym-kar-s": "f52f",
    	"sym-kar": "f530",
    	"sym-kava-s": "f531",
    	"sym-kava": "f532",
    	"sym-kbc-s": "f533",
    	"sym-kbc": "f534",
    	"sym-kcash-s": "f535",
    	"sym-kcash": "f536",
    	"sym-kda-s": "f537",
    	"sym-kda": "f538",
    	"sym-keep-s": "f539",
    	"sym-keep": "f53a",
    	"sym-key-s": "f53b",
    	"sym-key": "f53c",
    	"sym-kick-s": "f53d",
    	"sym-kick": "f53e",
    	"sym-kilt-s": "f53f",
    	"sym-kilt": "f540",
    	"sym-kin-s": "f541",
    	"sym-kin": "f542",
    	"sym-kint-s": "f543",
    	"sym-kint": "f544",
    	"sym-kma-s": "f545",
    	"sym-kma": "f546",
    	"sym-kmd-s": "f547",
    	"sym-kmd": "f548",
    	"sym-knc-s": "f549",
    	"sym-knc": "f54a",
    	"sym-kore-s": "f54b",
    	"sym-kore": "f54c",
    	"sym-kp3r-s": "f54d",
    	"sym-kp3r": "f54e",
    	"sym-krm-s": "f54f",
    	"sym-krm": "f550",
    	"sym-krw-s": "f551",
    	"sym-krw": "f552",
    	"sym-ksm-s": "f553",
    	"sym-ksm": "f554",
    	"sym-ksx-s": "f555",
    	"sym-ksx": "f556",
    	"sym-kyl-s": "f557",
    	"sym-kyl": "f558",
    	"sym-la-s": "f559",
    	"sym-la": "f55a",
    	"sym-lak-s": "f55b",
    	"sym-lak": "f55c",
    	"sym-lamb-s": "f55d",
    	"sym-lamb": "f55e",
    	"sym-latx-s": "f55f",
    	"sym-latx": "f560",
    	"sym-layr-s": "f561",
    	"sym-layr": "f562",
    	"sym-lba-s": "f563",
    	"sym-lba": "f564",
    	"sym-lbc-s": "f565",
    	"sym-lbc": "f566",
    	"sym-lcc-s": "f567",
    	"sym-lcc": "f568",
    	"sym-lcx-s": "f569",
    	"sym-lcx": "f56a",
    	"sym-ldo-s": "f56b",
    	"sym-ldo": "f56c",
    	"sym-lend-s": "f56d",
    	"sym-lend": "f56e",
    	"sym-leo-s": "f56f",
    	"sym-leo": "f570",
    	"sym-leoc-s": "f571",
    	"sym-leoc": "f572",
    	"sym-let-s": "f573",
    	"sym-let": "f574",
    	"sym-life-s": "f575",
    	"sym-life": "f576",
    	"sym-lina-s": "f577",
    	"sym-lina": "f578",
    	"sym-link-s": "f579",
    	"sym-link": "f57a",
    	"sym-lit-s": "f57b",
    	"sym-lit": "f57c",
    	"sym-lmc-s": "f57d",
    	"sym-lmc": "f57e",
    	"sym-lml-s": "f57f",
    	"sym-lml": "f580",
    	"sym-lnc-s": "f581",
    	"sym-lnc": "f582",
    	"sym-lnd-s": "f583",
    	"sym-lnd": "f584",
    	"sym-loc-s": "f585",
    	"sym-loc": "f586",
    	"sym-looks-s": "f587",
    	"sym-looks": "f588",
    	"sym-loom-s": "f589",
    	"sym-loom": "f58a",
    	"sym-lpt-s": "f58b",
    	"sym-lpt": "f58c",
    	"sym-lrc-s": "f58d",
    	"sym-lrc": "f58e",
    	"sym-lrn-s": "f58f",
    	"sym-lrn": "f590",
    	"sym-lsk-s": "f591",
    	"sym-lsk": "f592",
    	"sym-ltc-s": "f593",
    	"sym-ltc": "f594",
    	"sym-lto-s": "f595",
    	"sym-lto": "f596",
    	"sym-lun-s": "f597",
    	"sym-lun": "f598",
    	"sym-luna-s": "f599",
    	"sym-luna": "f59a",
    	"sym-lxt-s": "f59b",
    	"sym-lxt": "f59c",
    	"sym-lym-s": "f59d",
    	"sym-lym": "f59e",
    	"sym-m2k-s": "f59f",
    	"sym-m2k": "f5a0",
    	"sym-ma-s": "f5a1",
    	"sym-ma": "f5a2",
    	"sym-maid-s": "f5a3",
    	"sym-maid": "f5a4",
    	"sym-man-s": "f5a5",
    	"sym-man": "f5a6",
    	"sym-mana-s": "f5a7",
    	"sym-mana": "f5a8",
    	"sym-mask-s": "f5a9",
    	"sym-mask": "f5aa",
    	"sym-mass-s": "f5ab",
    	"sym-mass": "f5ac",
    	"sym-matic-s": "f5ad",
    	"sym-matic": "f5ae",
    	"sym-mbl-s": "f5af",
    	"sym-mbl": "f5b0",
    	"sym-mbt-s": "f5b1",
    	"sym-mbt": "f5b2",
    	"sym-mc-s": "f5b3",
    	"sym-mc": "f5b4",
    	"sym-mco-s": "f5b5",
    	"sym-mco": "f5b6",
    	"sym-mda-s": "f5b7",
    	"sym-mda": "f5b8",
    	"sym-mds-s": "f5b9",
    	"sym-mds": "f5ba",
    	"sym-mdt-s": "f5bb",
    	"sym-mdt": "f5bc",
    	"sym-mdx-s": "f5bd",
    	"sym-mdx": "f5be",
    	"sym-med-s": "f5bf",
    	"sym-med": "f5c0",
    	"sym-mer-s": "f5c1",
    	"sym-mer": "f5c2",
    	"sym-mes-s": "f5c3",
    	"sym-mes": "f5c4",
    	"sym-met-s": "f5c5",
    	"sym-met": "f5c6",
    	"sym-meta-s": "f5c7",
    	"sym-meta": "f5c8",
    	"sym-mft-s": "f5c9",
    	"sym-mft": "f5ca",
    	"sym-mgc-s": "f5cb",
    	"sym-mgc": "f5cc",
    	"sym-mgo-s": "f5cd",
    	"sym-mgo": "f5ce",
    	"sym-mhc-s": "f5cf",
    	"sym-mhc": "f5d0",
    	"sym-mina-s": "f5d1",
    	"sym-mina": "f5d2",
    	"sym-mir-s": "f5d3",
    	"sym-mir": "f5d4",
    	"sym-mith-s": "f5d5",
    	"sym-mith": "f5d6",
    	"sym-mitx-s": "f5d7",
    	"sym-mitx": "f5d8",
    	"sym-mjp-s": "f5d9",
    	"sym-mjp": "f5da",
    	"sym-mkr-s": "f5db",
    	"sym-mkr": "f5dc",
    	"sym-mln-s": "f5dd",
    	"sym-mln": "f5de",
    	"sym-mngo-s": "f5df",
    	"sym-mngo": "f5e0",
    	"sym-mnx-s": "f5e1",
    	"sym-mnx": "f5e2",
    	"sym-moac-s": "f5e3",
    	"sym-moac": "f5e4",
    	"sym-mob-s": "f5e5",
    	"sym-mob": "f5e6",
    	"sym-mobi-s": "f5e7",
    	"sym-mobi": "f5e8",
    	"sym-moc-s": "f5e9",
    	"sym-moc": "f5ea",
    	"sym-mod-s": "f5eb",
    	"sym-mod": "f5ec",
    	"sym-mona-s": "f5ed",
    	"sym-mona": "f5ee",
    	"sym-moon-s": "f5ef",
    	"sym-moon": "f5f0",
    	"sym-morph-s": "f5f1",
    	"sym-morph": "f5f2",
    	"sym-movr-s": "f5f3",
    	"sym-movr": "f5f4",
    	"sym-mpl-s": "f5f5",
    	"sym-mpl": "f5f6",
    	"sym-mrk-s": "f5f7",
    	"sym-mrk": "f5f8",
    	"sym-msol-s": "f5f9",
    	"sym-msol": "f5fa",
    	"sym-msp-s": "f5fb",
    	"sym-msp": "f5fc",
    	"sym-mta-s": "f5fd",
    	"sym-mta": "f5fe",
    	"sym-mtc-s": "f5ff",
    	"sym-mtc": "f600",
    	"sym-mth-s": "f601",
    	"sym-mth": "f602",
    	"sym-mtl-s": "f603",
    	"sym-mtl": "f604",
    	"sym-mtn-s": "f605",
    	"sym-mtn": "f606",
    	"sym-mtx-s": "f607",
    	"sym-mtx": "f608",
    	"sym-mue-s": "f609",
    	"sym-mue": "f60a",
    	"sym-multi-s": "f60b",
    	"sym-multi": "f60c",
    	"sym-mv-s": "f60d",
    	"sym-mv": "f60e",
    	"sym-mx-s": "f60f",
    	"sym-mx": "f610",
    	"sym-mxc-s": "f611",
    	"sym-mxc": "f612",
    	"sym-mxm-s": "f613",
    	"sym-mxm": "f614",
    	"sym-mxn-s": "f615",
    	"sym-mxn": "f616",
    	"sym-myr-s": "f617",
    	"sym-myr": "f618",
    	"sym-n9l-s": "f619",
    	"sym-n9l": "f61a",
    	"sym-nanj-s": "f61b",
    	"sym-nanj": "f61c",
    	"sym-nano-s": "f61d",
    	"sym-nano": "f61e",
    	"sym-nas-s": "f61f",
    	"sym-nas": "f620",
    	"sym-naut-s": "f621",
    	"sym-naut": "f622",
    	"sym-nav-s": "f623",
    	"sym-nav": "f624",
    	"sym-ncash-s": "f625",
    	"sym-ncash": "f626",
    	"sym-nct-s": "f627",
    	"sym-nct": "f628",
    	"sym-near-s": "f629",
    	"sym-near": "f62a",
    	"sym-nebl-s": "f62b",
    	"sym-nebl": "f62c",
    	"sym-nec-s": "f62d",
    	"sym-nec": "f62e",
    	"sym-neo-s": "f62f",
    	"sym-neo": "f630",
    	"sym-neos-s": "f631",
    	"sym-neos": "f632",
    	"sym-nest-s": "f633",
    	"sym-nest": "f634",
    	"sym-neu-s": "f635",
    	"sym-neu": "f636",
    	"sym-new-s": "f637",
    	"sym-new": "f638",
    	"sym-nexo-s": "f639",
    	"sym-nexo": "f63a",
    	"sym-nft-s": "f63b",
    	"sym-nft": "f63c",
    	"sym-ng-s": "f63d",
    	"sym-ng": "f63e",
    	"sym-ngc-s": "f63f",
    	"sym-ngc": "f640",
    	"sym-ngn-s": "f641",
    	"sym-ngn": "f642",
    	"sym-nim-s": "f643",
    	"sym-nim": "f644",
    	"sym-niy-s": "f645",
    	"sym-niy": "f646",
    	"sym-nkd-s": "f647",
    	"sym-nkd": "f648",
    	"sym-nkn-s": "f649",
    	"sym-nkn": "f64a",
    	"sym-nlc2-s": "f64b",
    	"sym-nlc2": "f64c",
    	"sym-nlg-s": "f64d",
    	"sym-nlg": "f64e",
    	"sym-nmc-s": "f64f",
    	"sym-nmc": "f650",
    	"sym-nmr-s": "f651",
    	"sym-nmr": "f652",
    	"sym-nn-s": "f653",
    	"sym-nn": "f654",
    	"sym-noah-s": "f655",
    	"sym-noah": "f656",
    	"sym-nodl-s": "f657",
    	"sym-nodl": "f658",
    	"sym-note-s": "f659",
    	"sym-note": "f65a",
    	"sym-npg-s": "f65b",
    	"sym-npg": "f65c",
    	"sym-nplc-s": "f65d",
    	"sym-nplc": "f65e",
    	"sym-npxs-s": "f65f",
    	"sym-npxs": "f660",
    	"sym-nq-s": "f661",
    	"sym-nq": "f662",
    	"sym-nrg-s": "f663",
    	"sym-nrg": "f664",
    	"sym-ntk-s": "f665",
    	"sym-ntk": "f666",
    	"sym-nu-s": "f667",
    	"sym-nu": "f668",
    	"sym-nuls-s": "f669",
    	"sym-nuls": "f66a",
    	"sym-nvc-s": "f66b",
    	"sym-nvc": "f66c",
    	"sym-nxc-s": "f66d",
    	"sym-nxc": "f66e",
    	"sym-nxs-s": "f66f",
    	"sym-nxs": "f670",
    	"sym-nxt-s": "f671",
    	"sym-nxt": "f672",
    	"sym-nym-s": "f673",
    	"sym-nym": "f674",
    	"sym-o-s": "f675",
    	"sym-o": "f676",
    	"sym-oax-s": "f677",
    	"sym-oax": "f678",
    	"sym-ocean-s": "f679",
    	"sym-ocean": "f67a",
    	"sym-ocn-s": "f67b",
    	"sym-ocn": "f67c",
    	"sym-ode-s": "f67d",
    	"sym-ode": "f67e",
    	"sym-ogn-s": "f67f",
    	"sym-ogn": "f680",
    	"sym-ogo-s": "f681",
    	"sym-ogo": "f682",
    	"sym-ok-s": "f683",
    	"sym-ok": "f684",
    	"sym-okb-s": "f685",
    	"sym-okb": "f686",
    	"sym-om-s": "f687",
    	"sym-om": "f688",
    	"sym-omg-s": "f689",
    	"sym-omg": "f68a",
    	"sym-omni-s": "f68b",
    	"sym-omni": "f68c",
    	"sym-one-s": "f68d",
    	"sym-one": "f68e",
    	"sym-ong-s": "f68f",
    	"sym-ong": "f690",
    	"sym-onot-s": "f691",
    	"sym-onot": "f692",
    	"sym-ont-s": "f693",
    	"sym-ont": "f694",
    	"sym-orbs-s": "f695",
    	"sym-orbs": "f696",
    	"sym-orca-s": "f697",
    	"sym-orca": "f698",
    	"sym-orme-s": "f699",
    	"sym-orme": "f69a",
    	"sym-orn-s": "f69b",
    	"sym-orn": "f69c",
    	"sym-ors-s": "f69d",
    	"sym-ors": "f69e",
    	"sym-osmo-s": "f69f",
    	"sym-osmo": "f6a0",
    	"sym-ost-s": "f6a1",
    	"sym-ost": "f6a2",
    	"sym-otn-s": "f6a3",
    	"sym-otn": "f6a4",
    	"sym-oxt-s": "f6a5",
    	"sym-oxt": "f6a6",
    	"sym-oxy-s": "f6a7",
    	"sym-oxy": "f6a8",
    	"sym-pai-s": "f6a9",
    	"sym-pai": "f6aa",
    	"sym-pal-s": "f6ab",
    	"sym-pal": "f6ac",
    	"sym-para-s": "f6ad",
    	"sym-para": "f6ae",
    	"sym-part-s": "f6af",
    	"sym-part": "f6b0",
    	"sym-pasc-s": "f6b1",
    	"sym-pasc": "f6b2",
    	"sym-pat-s": "f6b3",
    	"sym-pat": "f6b4",
    	"sym-pax-s": "f6b5",
    	"sym-pax": "f6b6",
    	"sym-paxg-s": "f6b7",
    	"sym-paxg": "f6b8",
    	"sym-pay-s": "f6b9",
    	"sym-pay": "f6ba",
    	"sym-pbt-s": "f6bb",
    	"sym-pbt": "f6bc",
    	"sym-pcl-s": "f6bd",
    	"sym-pcl": "f6be",
    	"sym-pcx-s": "f6bf",
    	"sym-pcx": "f6c0",
    	"sym-pdex-s": "f6c1",
    	"sym-pdex": "f6c2",
    	"sym-people-s": "f6c3",
    	"sym-people": "f6c4",
    	"sym-perl-s": "f6c5",
    	"sym-perl": "f6c6",
    	"sym-perp-s": "f6c7",
    	"sym-perp": "f6c8",
    	"sym-pha-s": "f6c9",
    	"sym-pha": "f6ca",
    	"sym-phb-s": "f6cb",
    	"sym-phb": "f6cc",
    	"sym-php-s": "f6cd",
    	"sym-php": "f6ce",
    	"sym-phx-s": "f6cf",
    	"sym-phx": "f6d0",
    	"sym-pi-s": "f6d1",
    	"sym-pi": "f6d2",
    	"sym-pica-s": "f6d3",
    	"sym-pica": "f6d4",
    	"sym-pink-s": "f6d5",
    	"sym-pink": "f6d6",
    	"sym-pivx-s": "f6d7",
    	"sym-pivx": "f6d8",
    	"sym-pkt-s": "f6d9",
    	"sym-pkt": "f6da",
    	"sym-pl-s": "f6db",
    	"sym-pl": "f6dc",
    	"sym-pla-s": "f6dd",
    	"sym-pla": "f6de",
    	"sym-plbt-s": "f6df",
    	"sym-plbt": "f6e0",
    	"sym-plm-s": "f6e1",
    	"sym-plm": "f6e2",
    	"sym-pln-s": "f6e3",
    	"sym-pln": "f6e4",
    	"sym-plr-s": "f6e5",
    	"sym-plr": "f6e6",
    	"sym-ply-s": "f6e7",
    	"sym-ply": "f6e8",
    	"sym-pma-s": "f6e9",
    	"sym-pma": "f6ea",
    	"sym-png-s": "f6eb",
    	"sym-png": "f6ec",
    	"sym-pnt-s": "f6ed",
    	"sym-pnt": "f6ee",
    	"sym-poa-s": "f6ef",
    	"sym-poa": "f6f0",
    	"sym-poe-s": "f6f1",
    	"sym-poe": "f6f2",
    	"sym-polis-s": "f6f3",
    	"sym-polis": "f6f4",
    	"sym-pols-s": "f6f5",
    	"sym-pols": "f6f6",
    	"sym-poly-s": "f6f7",
    	"sym-poly": "f6f8",
    	"sym-pond-s": "f6f9",
    	"sym-pond": "f6fa",
    	"sym-pot-s": "f6fb",
    	"sym-pot": "f6fc",
    	"sym-powr-s": "f6fd",
    	"sym-powr": "f6fe",
    	"sym-ppc-s": "f6ff",
    	"sym-ppc": "f700",
    	"sym-ppt-s": "f701",
    	"sym-ppt": "f702",
    	"sym-pra-s": "f703",
    	"sym-pra": "f704",
    	"sym-pre-s": "f705",
    	"sym-pre": "f706",
    	"sym-prg-s": "f707",
    	"sym-prg": "f708",
    	"sym-pro-s": "f709",
    	"sym-pro": "f70a",
    	"sym-pst-s": "f70b",
    	"sym-pst": "f70c",
    	"sym-pstake-s": "f70d",
    	"sym-pstake": "f70e",
    	"sym-pton-s": "f70f",
    	"sym-pton": "f710",
    	"sym-pvt-s": "f711",
    	"sym-pvt": "f712",
    	"sym-pxg-s": "f713",
    	"sym-pxg": "f714",
    	"sym-pyr-s": "f715",
    	"sym-pyr": "f716",
    	"sym-qash-s": "f717",
    	"sym-qash": "f718",
    	"sym-qau-s": "f719",
    	"sym-qau": "f71a",
    	"sym-qc-s": "f71b",
    	"sym-qc": "f71c",
    	"sym-qi-s": "f71d",
    	"sym-qi": "f71e",
    	"sym-qi2-s": "f71f",
    	"sym-qi2": "f720",
    	"sym-qkc-s": "f721",
    	"sym-qkc": "f722",
    	"sym-qlc-s": "f723",
    	"sym-qlc": "f724",
    	"sym-qnt-s": "f725",
    	"sym-qnt": "f726",
    	"sym-qntu-s": "f727",
    	"sym-qntu": "f728",
    	"sym-qo-s": "f729",
    	"sym-qo": "f72a",
    	"sym-qrl-s": "f72b",
    	"sym-qrl": "f72c",
    	"sym-qsp-s": "f72d",
    	"sym-qsp": "f72e",
    	"sym-qtum-s": "f72f",
    	"sym-qtum": "f730",
    	"sym-quick-s": "f731",
    	"sym-quick": "f732",
    	"sym-qun-s": "f733",
    	"sym-qun": "f734",
    	"sym-r-s": "f735",
    	"sym-r": "f736",
    	"sym-rad-s": "f737",
    	"sym-rad": "f738",
    	"sym-rads-s": "f739",
    	"sym-rads": "f73a",
    	"sym-rare-s": "f73b",
    	"sym-rare": "f73c",
    	"sym-rari-s": "f73d",
    	"sym-rari": "f73e",
    	"sym-rating-s": "f73f",
    	"sym-rating": "f740",
    	"sym-ray-s": "f741",
    	"sym-ray": "f742",
    	"sym-rb-s": "f743",
    	"sym-rb": "f744",
    	"sym-rbc-s": "f745",
    	"sym-rbc": "f746",
    	"sym-rblx-s": "f747",
    	"sym-rblx": "f748",
    	"sym-rbtc-s": "f749",
    	"sym-rbtc": "f74a",
    	"sym-rby-s": "f74b",
    	"sym-rby": "f74c",
    	"sym-rcn-s": "f74d",
    	"sym-rcn": "f74e",
    	"sym-rdd-s": "f74f",
    	"sym-rdd": "f750",
    	"sym-rdn-s": "f751",
    	"sym-rdn": "f752",
    	"sym-reef-s": "f753",
    	"sym-reef": "f754",
    	"sym-rem-s": "f755",
    	"sym-rem": "f756",
    	"sym-ren-s": "f757",
    	"sym-ren": "f758",
    	"sym-rep-s": "f759",
    	"sym-rep": "f75a",
    	"sym-repv2-s": "f75b",
    	"sym-repv2": "f75c",
    	"sym-req-s": "f75d",
    	"sym-req": "f75e",
    	"sym-rev-s": "f75f",
    	"sym-rev": "f760",
    	"sym-rfox-s": "f761",
    	"sym-rfox": "f762",
    	"sym-rfr-s": "f763",
    	"sym-rfr": "f764",
    	"sym-ric-s": "f765",
    	"sym-ric": "f766",
    	"sym-rif-s": "f767",
    	"sym-rif": "f768",
    	"sym-ring-s": "f769",
    	"sym-ring": "f76a",
    	"sym-rlc-s": "f76b",
    	"sym-rlc": "f76c",
    	"sym-rly-s": "f76d",
    	"sym-rly": "f76e",
    	"sym-rmrk-s": "f76f",
    	"sym-rmrk": "f770",
    	"sym-rndr-s": "f771",
    	"sym-rndr": "f772",
    	"sym-rntb-s": "f773",
    	"sym-rntb": "f774",
    	"sym-ron-s": "f775",
    	"sym-ron": "f776",
    	"sym-rook-s": "f777",
    	"sym-rook": "f778",
    	"sym-rose-s": "f779",
    	"sym-rose": "f77a",
    	"sym-rox-s": "f77b",
    	"sym-rox": "f77c",
    	"sym-rp-s": "f77d",
    	"sym-rp": "f77e",
    	"sym-rpx-s": "f77f",
    	"sym-rpx": "f780",
    	"sym-rsr-s": "f781",
    	"sym-rsr": "f782",
    	"sym-rsv-s": "f783",
    	"sym-rsv": "f784",
    	"sym-rty-s": "f785",
    	"sym-rty": "f786",
    	"sym-rub-s": "f787",
    	"sym-rub": "f788",
    	"sym-ruff-s": "f789",
    	"sym-ruff": "f78a",
    	"sym-rune-s": "f78b",
    	"sym-rune": "f78c",
    	"sym-rvn-s": "f78d",
    	"sym-rvn": "f78e",
    	"sym-rvr-s": "f78f",
    	"sym-rvr": "f790",
    	"sym-rvt-s": "f791",
    	"sym-rvt": "f792",
    	"sym-sai-s": "f793",
    	"sym-sai": "f794",
    	"sym-salt-s": "f795",
    	"sym-salt": "f796",
    	"sym-samo-s": "f797",
    	"sym-samo": "f798",
    	"sym-san-s": "f799",
    	"sym-san": "f79a",
    	"sym-sand-s": "f79b",
    	"sym-sand": "f79c",
    	"sym-sats-s": "f79d",
    	"sym-sats": "f79e",
    	"sym-sbd-s": "f79f",
    	"sym-sbd": "f7a0",
    	"sym-sbr-s": "f7a1",
    	"sym-sbr": "f7a2",
    	"sym-sc-s": "f7a3",
    	"sym-sc": "f7a4",
    	"sym-scc-s": "f7a5",
    	"sym-scc": "f7a6",
    	"sym-scrt-s": "f7a7",
    	"sym-scrt": "f7a8",
    	"sym-sdc-s": "f7a9",
    	"sym-sdc": "f7aa",
    	"sym-sdn-s": "f7ab",
    	"sym-sdn": "f7ac",
    	"sym-seele-s": "f7ad",
    	"sym-seele": "f7ae",
    	"sym-sek-s": "f7af",
    	"sym-sek": "f7b0",
    	"sym-sen-s": "f7b1",
    	"sym-sen": "f7b2",
    	"sym-sent-s": "f7b3",
    	"sym-sent": "f7b4",
    	"sym-sero-s": "f7b5",
    	"sym-sero": "f7b6",
    	"sym-sexc-s": "f7b7",
    	"sym-sexc": "f7b8",
    	"sym-sfp-s": "f7b9",
    	"sym-sfp": "f7ba",
    	"sym-sgb-s": "f7bb",
    	"sym-sgb": "f7bc",
    	"sym-sgc-s": "f7bd",
    	"sym-sgc": "f7be",
    	"sym-sgd-s": "f7bf",
    	"sym-sgd": "f7c0",
    	"sym-sgn-s": "f7c1",
    	"sym-sgn": "f7c2",
    	"sym-sgu-s": "f7c3",
    	"sym-sgu": "f7c4",
    	"sym-shib-s": "f7c5",
    	"sym-shib": "f7c6",
    	"sym-shift-s": "f7c7",
    	"sym-shift": "f7c8",
    	"sym-ship-s": "f7c9",
    	"sym-ship": "f7ca",
    	"sym-si-s": "f7cb",
    	"sym-si": "f7cc",
    	"sym-sib-s": "f7cd",
    	"sym-sib": "f7ce",
    	"sym-sil-s": "f7cf",
    	"sym-sil": "f7d0",
    	"sym-six-s": "f7d1",
    	"sym-six": "f7d2",
    	"sym-sjcx-s": "f7d3",
    	"sym-sjcx": "f7d4",
    	"sym-skl-s": "f7d5",
    	"sym-skl": "f7d6",
    	"sym-skm-s": "f7d7",
    	"sym-skm": "f7d8",
    	"sym-sku-s": "f7d9",
    	"sym-sku": "f7da",
    	"sym-sky-s": "f7db",
    	"sym-sky": "f7dc",
    	"sym-slp-s": "f7dd",
    	"sym-slp": "f7de",
    	"sym-slr-s": "f7df",
    	"sym-slr": "f7e0",
    	"sym-sls-s": "f7e1",
    	"sym-sls": "f7e2",
    	"sym-slt-s": "f7e3",
    	"sym-slt": "f7e4",
    	"sym-slv-s": "f7e5",
    	"sym-slv": "f7e6",
    	"sym-smart-s": "f7e7",
    	"sym-smart": "f7e8",
    	"sym-smn-s": "f7e9",
    	"sym-smn": "f7ea",
    	"sym-smt-s": "f7eb",
    	"sym-smt": "f7ec",
    	"sym-snc-s": "f7ed",
    	"sym-snc": "f7ee",
    	"sym-snet-s": "f7ef",
    	"sym-snet": "f7f0",
    	"sym-sngls-s": "f7f1",
    	"sym-sngls": "f7f2",
    	"sym-snm-s": "f7f3",
    	"sym-snm": "f7f4",
    	"sym-snt-s": "f7f5",
    	"sym-snt": "f7f6",
    	"sym-snx-s": "f7f7",
    	"sym-snx": "f7f8",
    	"sym-soc-s": "f7f9",
    	"sym-soc": "f7fa",
    	"sym-socks-s": "f7fb",
    	"sym-socks": "f7fc",
    	"sym-sol-s": "f7fd",
    	"sym-sol": "f7fe",
    	"sym-solid-s": "f7ff",
    	"sym-solid": "f800",
    	"sym-solo-s": "f801",
    	"sym-solo": "f802",
    	"sym-solve-s": "f803",
    	"sym-solve": "f804",
    	"sym-sos-s": "f805",
    	"sym-sos": "f806",
    	"sym-soul-s": "f807",
    	"sym-soul": "f808",
    	"sym-sp-s": "f809",
    	"sym-sp": "f80a",
    	"sym-sparta-s": "f80b",
    	"sym-sparta": "f80c",
    	"sym-spc-s": "f80d",
    	"sym-spc": "f80e",
    	"sym-spd-s": "f80f",
    	"sym-spd": "f810",
    	"sym-spell-s": "f811",
    	"sym-spell": "f812",
    	"sym-sphr-s": "f813",
    	"sym-sphr": "f814",
    	"sym-sphtx-s": "f815",
    	"sym-sphtx": "f816",
    	"sym-spnd-s": "f817",
    	"sym-spnd": "f818",
    	"sym-spnk-s": "f819",
    	"sym-spnk": "f81a",
    	"sym-srm-s": "f81b",
    	"sym-srm": "f81c",
    	"sym-srn-s": "f81d",
    	"sym-srn": "f81e",
    	"sym-ssp-s": "f81f",
    	"sym-ssp": "f820",
    	"sym-stacs-s": "f821",
    	"sym-stacs": "f822",
    	"sym-step-s": "f823",
    	"sym-step": "f824",
    	"sym-storm-s": "f825",
    	"sym-storm": "f826",
    	"sym-stpt-s": "f827",
    	"sym-stpt": "f828",
    	"sym-stq-s": "f829",
    	"sym-stq": "f82a",
    	"sym-str-s": "f82b",
    	"sym-str": "f82c",
    	"sym-strat-s": "f82d",
    	"sym-strat": "f82e",
    	"sym-strax-s": "f82f",
    	"sym-strax": "f830",
    	"sym-strong-s": "f831",
    	"sym-strong": "f832",
    	"sym-stx-s": "f833",
    	"sym-stx": "f834",
    	"sym-sub-s": "f835",
    	"sym-sub": "f836",
    	"sym-super-s": "f837",
    	"sym-super": "f838",
    	"sym-susd-s": "f839",
    	"sym-susd": "f83a",
    	"sym-sushi-s": "f83b",
    	"sym-sushi": "f83c",
    	"sym-swftc-s": "f83d",
    	"sym-swftc": "f83e",
    	"sym-swm-s": "f83f",
    	"sym-swm": "f840",
    	"sym-swrv-s": "f841",
    	"sym-swrv": "f842",
    	"sym-swt-s": "f843",
    	"sym-swt": "f844",
    	"sym-swth-s": "f845",
    	"sym-swth": "f846",
    	"sym-sxp-s": "f847",
    	"sym-sxp": "f848",
    	"sym-syn-s": "f849",
    	"sym-syn": "f84a",
    	"sym-sys-s": "f84b",
    	"sym-sys": "f84c",
    	"sym-t-s": "f84d",
    	"sym-t": "f84e",
    	"sym-taas-s": "f84f",
    	"sym-taas": "f850",
    	"sym-tau-s": "f851",
    	"sym-tau": "f852",
    	"sym-tbtc-s": "f853",
    	"sym-tbtc": "f854",
    	"sym-tct-s": "f855",
    	"sym-tct": "f856",
    	"sym-teer-s": "f857",
    	"sym-teer": "f858",
    	"sym-tel-s": "f859",
    	"sym-temco-s": "f85a",
    	"sym-temco": "f85b",
    	"sym-tfuel-s": "f85c",
    	"sym-tfuel": "f85d",
    	"sym-thb-s": "f85e",
    	"sym-thb": "f85f",
    	"sym-thc-s": "f860",
    	"sym-thc": "f861",
    	"sym-theta-s": "f862",
    	"sym-theta": "f863",
    	"sym-thx-s": "f864",
    	"sym-thx": "f865",
    	"sym-time-s": "f866",
    	"sym-time": "f867",
    	"sym-tio-s": "f868",
    	"sym-tio": "f869",
    	"sym-tix-s": "f86a",
    	"sym-tix": "f86b",
    	"sym-tkn-s": "f86c",
    	"sym-tkn": "f86d",
    	"sym-tky-s": "f86e",
    	"sym-tky": "f86f",
    	"sym-tlm-s": "f870",
    	"sym-tlm": "f871",
    	"sym-tnb-s": "f872",
    	"sym-tnb": "f873",
    	"sym-tnc-s": "f874",
    	"sym-tnc": "f875",
    	"sym-tnt-s": "f876",
    	"sym-tnt": "f877",
    	"sym-toke-s": "f878",
    	"sym-toke": "f879",
    	"sym-tomo-s": "f87a",
    	"sym-tomo": "f87b",
    	"sym-top-s": "f87c",
    	"sym-top": "f87d",
    	"sym-torn-s": "f87e",
    	"sym-torn": "f87f",
    	"sym-tpay-s": "f880",
    	"sym-tpay": "f881",
    	"sym-trac-s": "f882",
    	"sym-trac": "f883",
    	"sym-trb-s": "f884",
    	"sym-trb": "f885",
    	"sym-tribe-s": "f886",
    	"sym-tribe": "f887",
    	"sym-trig-s": "f888",
    	"sym-trig": "f889",
    	"sym-trio-s": "f88a",
    	"sym-trio": "f88b",
    	"sym-troy-s": "f88c",
    	"sym-troy": "f88d",
    	"sym-trst-s": "f88e",
    	"sym-trst": "f88f",
    	"sym-tru-s": "f890",
    	"sym-tru": "f891",
    	"sym-true-s": "f892",
    	"sym-true": "f893",
    	"sym-trx-s": "f894",
    	"sym-trx": "f895",
    	"sym-try-s": "f896",
    	"sym-try": "f897",
    	"sym-tryb-s": "f898",
    	"sym-tryb": "f899",
    	"sym-tt-s": "f89a",
    	"sym-tt": "f89b",
    	"sym-ttc-s": "f89c",
    	"sym-ttc": "f89d",
    	"sym-ttt-s": "f89e",
    	"sym-ttt": "f89f",
    	"sym-ttu-s": "f8a0",
    	"sym-ttu": "f8a1",
    	"sym-tube-s": "f8a2",
    	"sym-tube": "f8a3",
    	"sym-tusd-s": "f8a4",
    	"sym-tusd": "f8a5",
    	"sym-twt-s": "f8a6",
    	"sym-twt": "f8a7",
    	"sym-uah-s": "f8a8",
    	"sym-uah": "f8a9",
    	"sym-ubq-s": "f8aa",
    	"sym-ubq": "f8ab",
    	"sym-ubt-s": "f8ac",
    	"sym-ubt": "f8ad",
    	"sym-uft-s": "f8ae",
    	"sym-uft": "f8af",
    	"sym-ugas-s": "f8b0",
    	"sym-ugas": "f8b1",
    	"sym-uip-s": "f8b2",
    	"sym-uip": "f8b3",
    	"sym-ukg-s": "f8b4",
    	"sym-ukg": "f8b5",
    	"sym-uma-s": "f8b6",
    	"sym-uma": "f8b7",
    	"sym-unfi-s": "f8b8",
    	"sym-unfi": "f8b9",
    	"sym-uni-s": "f8ba",
    	"sym-uni": "f8bb",
    	"sym-unq-s": "f8bc",
    	"sym-unq": "f8bd",
    	"sym-up-s": "f8be",
    	"sym-up": "f8bf",
    	"sym-upp-s": "f8c0",
    	"sym-upp": "f8c1",
    	"sym-usd-s": "f8c2",
    	"sym-usd": "f8c3",
    	"sym-usdc-s": "f8c4",
    	"sym-usdc": "f8c5",
    	"sym-usds-s": "f8c6",
    	"sym-usds": "f8c7",
    	"sym-usk-s": "f8c8",
    	"sym-usk": "f8c9",
    	"sym-ust-s": "f8ca",
    	"sym-ust": "f8cb",
    	"sym-utk-s": "f8cc",
    	"sym-utk": "f8cd",
    	"sym-utnp-s": "f8ce",
    	"sym-utnp": "f8cf",
    	"sym-utt-s": "f8d0",
    	"sym-utt": "f8d1",
    	"sym-uuu-s": "f8d2",
    	"sym-uuu": "f8d3",
    	"sym-ux-s": "f8d4",
    	"sym-ux": "f8d5",
    	"sym-vader-s": "f8d6",
    	"sym-vader": "f8d7",
    	"sym-vai-s": "f8d8",
    	"sym-vai": "f8d9",
    	"sym-vbk-s": "f8da",
    	"sym-vbk": "f8db",
    	"sym-vdx-s": "f8dc",
    	"sym-vdx": "f8dd",
    	"sym-vee-s": "f8de",
    	"sym-vee": "f8df",
    	"sym-ven-s": "f8e0",
    	"sym-ven": "f8e1",
    	"sym-veo-s": "f8e2",
    	"sym-veo": "f8e3",
    	"sym-veri-s": "f8e4",
    	"sym-veri": "f8e5",
    	"sym-vex-s": "f8e6",
    	"sym-vex": "f8e7",
    	"sym-vgx-s": "f8e8",
    	"sym-vgx": "f8e9",
    	"sym-via-s": "f8ea",
    	"sym-via": "f8eb",
    	"sym-vib-s": "f8ec",
    	"sym-vib": "f8ed",
    	"sym-vibe-s": "f8ee",
    	"sym-vibe": "f8ef",
    	"sym-vid-s": "f8f0",
    	"sym-vid": "f8f1",
    	"sym-vidt-s": "f8f2",
    	"sym-vidt": "f8f3",
    	"sym-vidy-s": "f8f4",
    	"sym-vidy": "f8f5",
    	"sym-vitae-s": "f8f6",
    	"sym-vitae": "f8f7",
    	"sym-vite-s": "f8f8",
    	"sym-vite": "f8f9",
    	"sym-vlx-s": "f8fa",
    	"sym-vlx": "f8fb",
    	"sym-vox-s": "f8fc",
    	"sym-vox": "f8fd",
    	"sym-vra-s": "f8fe",
    	"sym-vra": "f8ff",
    	"sym-vrc-s": "f900",
    	"sym-vrc": "f901",
    	"sym-vrm-s": "f902",
    	"sym-vrm": "f903",
    	"sym-vsys-s": "f904",
    	"sym-vsys": "f905",
    	"sym-vtc-s": "f906",
    	"sym-vtc": "f907",
    	"sym-vtho-s": "f908",
    	"sym-vtho": "f909",
    	"sym-wabi-s": "f90a",
    	"sym-wabi": "f90b",
    	"sym-wan-s": "f90c",
    	"sym-wan": "f90d",
    	"sym-waves-s": "f90e",
    	"sym-waves": "f90f",
    	"sym-wax-s": "f910",
    	"sym-wax": "f911",
    	"sym-wbtc-s": "f912",
    	"sym-wbtc": "f913",
    	"sym-wet-s": "f914",
    	"sym-wet": "f915",
    	"sym-weth-s": "f916",
    	"sym-weth": "f917",
    	"sym-wib-s": "f918",
    	"sym-wib": "f919",
    	"sym-wicc-s": "f91a",
    	"sym-wicc": "f91b",
    	"sym-win-s": "f91c",
    	"sym-win": "f91d",
    	"sym-wing-s": "f91e",
    	"sym-wing": "f91f",
    	"sym-wings-s": "f920",
    	"sym-wings": "f921",
    	"sym-wnxm-s": "f922",
    	"sym-wnxm": "f923",
    	"sym-woo-s": "f924",
    	"sym-woo": "f925",
    	"sym-wpr-s": "f926",
    	"sym-wpr": "f927",
    	"sym-wrx-s": "f928",
    	"sym-wrx": "f929",
    	"sym-wtc-s": "f92a",
    	"sym-wtc": "f92b",
    	"sym-wtt-s": "f92c",
    	"sym-wtt": "f92d",
    	"sym-wwb-s": "f92e",
    	"sym-wwb": "f92f",
    	"sym-wxt-s": "f930",
    	"sym-wxt": "f931",
    	"sym-xas-s": "f932",
    	"sym-xas": "f933",
    	"sym-xaur-s": "f934",
    	"sym-xaur": "f935",
    	"sym-xaut-s": "f936",
    	"sym-xaut": "f937",
    	"sym-xava-s": "f938",
    	"sym-xava": "f939",
    	"sym-xbc-s": "f93a",
    	"sym-xbc": "f93b",
    	"sym-xcon-s": "f93c",
    	"sym-xcon": "f93d",
    	"sym-xcp-s": "f93e",
    	"sym-xcp": "f93f",
    	"sym-xdn-s": "f940",
    	"sym-xdn": "f941",
    	"sym-xel-s": "f942",
    	"sym-xel": "f943",
    	"sym-xem-s": "f944",
    	"sym-xem": "f945",
    	"sym-xes-s": "f946",
    	"sym-xes": "f947",
    	"sym-xhv-s": "f948",
    	"sym-xhv": "f949",
    	"sym-xin-s": "f94a",
    	"sym-xin": "f94b",
    	"sym-xlm-s": "f94c",
    	"sym-xlm": "f94d",
    	"sym-xmc-s": "f94e",
    	"sym-xmc": "f94f",
    	"sym-xmr-s": "f950",
    	"sym-xmr": "f951",
    	"sym-xmx-s": "f952",
    	"sym-xmx": "f953",
    	"sym-xmy-s": "f954",
    	"sym-xmy": "f955",
    	"sym-xnk-s": "f956",
    	"sym-xnk": "f957",
    	"sym-xns-s": "f958",
    	"sym-xns": "f959",
    	"sym-xor-s": "f95a",
    	"sym-xor": "f95b",
    	"sym-xos-s": "f95c",
    	"sym-xos": "f95d",
    	"sym-xpm-s": "f95e",
    	"sym-xpm": "f95f",
    	"sym-xpr-s": "f960",
    	"sym-xpr": "f961",
    	"sym-xrc-s": "f962",
    	"sym-xrc": "f963",
    	"sym-xrp-s": "f964",
    	"sym-xrp": "f965",
    	"sym-xrpx-s": "f966",
    	"sym-xrpx": "f967",
    	"sym-xrt-s": "f968",
    	"sym-xrt": "f969",
    	"sym-xst-s": "f96a",
    	"sym-xst": "f96b",
    	"sym-xtp-s": "f96c",
    	"sym-xtp": "f96d",
    	"sym-xtz-s": "f96e",
    	"sym-xtz": "f96f",
    	"sym-xtzdown-s": "f970",
    	"sym-xtzdown": "f971",
    	"sym-xvc-s": "f972",
    	"sym-xvc": "f973",
    	"sym-xvg-s": "f974",
    	"sym-xvg": "f975",
    	"sym-xvs-s": "f976",
    	"sym-xvs": "f977",
    	"sym-xwc-s": "f978",
    	"sym-xwc": "f979",
    	"sym-xyo-s": "f97a",
    	"sym-xyo": "f97b",
    	"sym-xzc-s": "f97c",
    	"sym-xzc": "f97d",
    	"sym-yam-s": "f97e",
    	"sym-yam": "f97f",
    	"sym-yee-s": "f980",
    	"sym-yee": "f981",
    	"sym-yeed-s": "f982",
    	"sym-yeed": "f983",
    	"sym-yfi-s": "f984",
    	"sym-yfi": "f985",
    	"sym-yfii-s": "f986",
    	"sym-yfii": "f987",
    	"sym-ygg-s": "f988",
    	"sym-ygg": "f989",
    	"sym-yoyow-s": "f98a",
    	"sym-yoyow": "f98b",
    	"sym-zar-s": "f98c",
    	"sym-zar": "f98d",
    	"sym-zcl-s": "f98e",
    	"sym-zcl": "f98f",
    	"sym-zcn-s": "f990",
    	"sym-zcn": "f991",
    	"sym-zco-s": "f992",
    	"sym-zco": "f993",
    	"sym-zec-s": "f994",
    	"sym-zec": "f995",
    	"sym-zen-s": "f996",
    	"sym-zen": "f997",
    	"sym-zil-s": "f998",
    	"sym-zil": "f999",
    	"sym-zks-s": "f99a",
    	"sym-zks": "f99b",
    	"sym-zla-s": "f99c",
    	"sym-zla": "f99d",
    	"sym-zlk": "f99e",
    	"sym-zondo-s": "f99f",
    	"sym-zondo": "f9a0",
    	"sym-zpr-s": "f9a1",
    	"sym-zpr": "f9a2",
    	"sym-zpt-s": "f9a3",
    	"sym-zpt": "f9a4",
    	"sym-zrc-s": "f9a5",
    	"sym-zrc": "f9a6",
    	"sym-zrx-s": "f9a7",
    	"sym-zrx": "f9a8",
    	"sym-zsc-s": "f9a9",
    	"sym-zsc": "f9aa",
    	"sym-ztg-s": "f9ab",
    	"sym-ztg": "f9ac",
    	"cur-anct": "f1ca",
    	"cur-anct-s": "f1c9",
    	"cur-aud": "f1f6",
    	"cur-aud-s": "f1f5",
    	"cur-bnb": "f25d",
    	"cur-bnb-s": "f25c",
    	"sym-xbt": "f283",
    	"cur-btc": "f283",
    	"sym-xbt-s": "f282",
    	"cur-btc-s": "f282",
    	"cur-busd": "f2a1",
    	"cur-busd-s": "f2a0",
    	"exc-bitz": "f2a5",
    	"cur-bz": "f2a5",
    	"exc-bitz-s": "f2a4",
    	"cur-bz-s": "f2a4",
    	"cur-cad": "f2af",
    	"cur-cad-s": "f2ae",
    	"cur-chf": "f2cf",
    	"cur-chf-s": "f2ce",
    	"cur-cny": "f2f3",
    	"cur-cny-s": "f2f2",
    	"sym-cs": "f307",
    	"sym-cs-s": "f306",
    	"sym-crm": "f31d",
    	"sym-crm-s": "f31c",
    	"cur-dai": "f349",
    	"cur-dai-s": "f348",
    	"sym-xdg": "f385",
    	"sym-xdg-s": "f384",
    	"cur-eos": "f3ce",
    	"cur-eos-s": "f3cd",
    	"sym-eth2": "f3de",
    	"sym-eth2s": "f3de",
    	"sym-eth2.s": "f3de",
    	"cur-eth": "f3de",
    	"sym-eth2-s": "f3dd",
    	"sym-eth2s-s": "f3dd",
    	"sym-eth2.s-s": "f3dd",
    	"cur-eth-s": "f3dd",
    	"cur-eur": "f3e6",
    	"cur-eur-s": "f3e5",
    	"cur-eurs": "f3e8",
    	"cur-eurs-s": "f3e7",
    	"sym-usdt": "f3ea",
    	"cur-usdt": "f3ea",
    	"sym-usdt-s": "f3e9",
    	"cur-usdt-s": "f3e9",
    	"exc-kraken": "f402",
    	"exc-kraken-futures": "f402",
    	"exc-kraken-s": "f401",
    	"exc-kraken-futures-s": "f401",
    	"cur-gbp": "f44e",
    	"cur-gbp-s": "f44d",
    	"exc-gemini": "f492",
    	"cur-gusd": "f492",
    	"exc-gemini-s": "f491",
    	"cur-gusd-s": "f491",
    	"cur-hkd": "f4b4",
    	"cur-hkd-s": "f4b3",
    	"sym-husd": "f4ce",
    	"exc-huobi": "f4ce",
    	"cur-ht": "f4ce",
    	"sym-husd-s": "f4cd",
    	"exc-huobi-s": "f4cd",
    	"cur-ht-s": "f4cd",
    	"cur-idr": "f4ec",
    	"cur-idr-s": "f4eb",
    	"sym-iota": "f512",
    	"sym-iota-s": "f511",
    	"cur-inr": "f504",
    	"cur-inr-s": "f503",
    	"cur-jpy": "f526",
    	"cur-jpy-s": "f525",
    	"cur-krw": "f552",
    	"cur-krw-s": "f551",
    	"sym-medx": "f5c0",
    	"sym-medx-s": "f5bf",
    	"cur-mxn": "f616",
    	"cur-mxn-s": "f615",
    	"cur-myr": "f618",
    	"cur-myr-s": "f617",
    	"cur-ngn": "f642",
    	"cur-ngn-s": "f641",
    	"cur-pax": "f6b6",
    	"cur-pax-s": "f6b5",
    	"cur-php": "f6ce",
    	"cur-php-s": "f6cd",
    	"cur-pln": "f6e4",
    	"cur-pln-s": "f6e3",
    	"cur-qash": "f718",
    	"cur-qash-s": "f717",
    	"cur-rub": "f788",
    	"cur-rur": "f788",
    	"cur-rub-s": "f787",
    	"cur-rur-s": "f787",
    	"sym-steem": "f7a0",
    	"sym-steem-s": "f79f",
    	"sym-xsc": "f7a4",
    	"sym-xsc-s": "f7a3",
    	"cur-sgd": "f7c0",
    	"cur-sgd-s": "f7bf",
    	"sym-storj": "f7d4",
    	"sym-storj-s": "f7d3",
    	"sym-tel": "f850",
    	"cur-trx": "f895",
    	"cur-trx-s": "f894",
    	"cur-tusd": "f8a5",
    	"cur-tusd-s": "f8a4",
    	"cur-usd": "f8c3",
    	"cur-usd-s": "f8c2",
    	"cur-usdc": "f8c5",
    	"cur-usdc-s": "f8c4",
    	"sym-vet": "f8e1",
    	"sym-vet-s": "f8e0",
    	"sym-waxp": "f911",
    	"sym-waxp-s": "f910",
    	"cur-xlm": "f94d",
    	"cur-xlm-s": "f94c",
    	"cur-xmr": "f951",
    	"cur-xmr-s": "f950",
    	"cur-xrp": "f965",
    	"cur-xrp-s": "f964",
    	"cur-zar": "f98d",
    	"cur-zar-s": "f98c",
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
    	"cur-crc": "f311",
    	"cur-crc-s": "f310",
    	"cur-lak": "f55c",
    	"cur-lak-s": "f55b",
    	"cur-sek": "f7b0",
    	"cur-sek-s": "f7af",
    	"cur-thb": "f85f",
    	"cur-thb-s": "f85e",
    	"cur-try": "f897",
    	"cur-try-s": "f896",
    	"cur-uah": "f8a9",
    	"cur-uah-s": "f8a8",
    	"exc-ftx": "f432",
    	"exc-ftx-s": "f431",
    	"exc-ftx-us": "f432",
    	"exc-ftx-us-s": "f431",
    	"sym-cgld": "f2bf",
    	"sym-cgld-s": "f2be",
    	"exc-uniswap-v2": "f8bb",
    	"exc-uniswap-v2-s": "f8ba",
    	"sym-kshib": "f7c6",
    	"sym-kshib-s": "f7c5",
    	"sym-easy-s": "f3a2",
    	"sym-srare": "f73c",
    	"sym-srare-s": "f73b",
    	"sym-ape.2": "f1d0",
    	"sym-ape.2-s": "f1cf"
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
