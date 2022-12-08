
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

    var ustc = "fa4e";
    var beacons = {
    	"exc-_default-s": "f103",
    	"exc-_default": "f104",
    	"sym-_default-s": "f16b",
    	"sym-_default": "f16c",
    	"sym-d": "f16c",
    	"sym-d-s": "f16b",
    	"sym-default": "f16c",
    	"sym-default-s": "f16b",
    	"exc-d": "f104",
    	"exc-d-s": "f103",
    	"exc-default": "f104",
    	"exc-default-s": "f103",
    	"cur-default": "f16c",
    	"cur-default-s": "f16b",
    	"cur-sat-s": "f101",
    	"cur-sat": "f102",
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
    	"exc-nbatopshop-s": "f149",
    	"exc-nbatopshop": "f14a",
    	"exc-nymex-s": "f14b",
    	"exc-nymex": "f14c",
    	"exc-okcoin-s": "f14d",
    	"exc-okcoin": "f14e",
    	"exc-okx-s": "f14f",
    	"exc-okx": "f150",
    	"exc-opensea-s": "f151",
    	"exc-opensea": "f152",
    	"exc-poloniex-s": "f153",
    	"exc-poloniex": "f154",
    	"exc-qryptos-s": "f155",
    	"exc-qryptos": "f156",
    	"exc-quadrigacx-s": "f157",
    	"exc-quadrigacx": "f158",
    	"exc-quick-s": "f159",
    	"exc-quick": "f15a",
    	"exc-quoine-s": "f15b",
    	"exc-quoine": "f15c",
    	"exc-rarible-s": "f15d",
    	"exc-rarible": "f15e",
    	"exc-totle-s": "f15f",
    	"exc-totle": "f160",
    	"exc-upbit-s": "f161",
    	"exc-upbit": "f162",
    	"exc-vaultofsatoshi-s": "f163",
    	"exc-vaultofsatoshi": "f164",
    	"exc-wex-s": "f165",
    	"exc-wex": "f166",
    	"exc-zaif-s": "f167",
    	"exc-zaif": "f168",
    	"exc-zonda-s": "f169",
    	"exc-zonda": "f16a",
    	"sym-1inch-s": "f16d",
    	"sym-1inch": "f16e",
    	"sym-1st-s": "f16f",
    	"sym-1st": "f170",
    	"sym-6a-s": "f171",
    	"sym-6a": "f172",
    	"sym-6b-s": "f173",
    	"sym-6b": "f174",
    	"sym-6c-s": "f175",
    	"sym-6c": "f176",
    	"sym-6e-s": "f177",
    	"sym-6e": "f178",
    	"sym-6j-s": "f179",
    	"sym-6j": "f17a",
    	"sym-6l-s": "f17b",
    	"sym-6l": "f17c",
    	"sym-6m-s": "f17d",
    	"sym-6m": "f17e",
    	"sym-6n-s": "f17f",
    	"sym-6n": "f180",
    	"sym-6s-s": "f181",
    	"sym-6s": "f182",
    	"sym-a38-s": "f183",
    	"sym-a38": "f184",
    	"sym-aac-s": "f185",
    	"sym-aac": "f186",
    	"sym-aave-s": "f187",
    	"sym-aave": "f188",
    	"sym-abbc-s": "f189",
    	"sym-abbc": "f18a",
    	"sym-abt-s": "f18b",
    	"sym-abt": "f18c",
    	"sym-abyss-s": "f18d",
    	"sym-abyss": "f18e",
    	"sym-aca-s": "f18f",
    	"sym-aca": "f190",
    	"sym-acat-s": "f191",
    	"sym-acat": "f192",
    	"sym-ach-s": "f193",
    	"sym-ach": "f194",
    	"sym-act-s": "f195",
    	"sym-act": "f196",
    	"sym-ad0-s": "f197",
    	"sym-ad0": "f198",
    	"sym-ada-s": "f199",
    	"sym-ada": "f19a",
    	"sym-adel-s": "f19b",
    	"sym-adel": "f19c",
    	"sym-adh-s": "f19d",
    	"sym-adh": "f19e",
    	"sym-adm-s": "f19f",
    	"sym-adm": "f1a0",
    	"sym-ado-s": "f1a1",
    	"sym-ado": "f1a2",
    	"sym-adt-s": "f1a3",
    	"sym-adt": "f1a4",
    	"sym-adx-s": "f1a5",
    	"sym-adx": "f1a6",
    	"sym-ae-s": "f1a7",
    	"sym-ae": "f1a8",
    	"sym-aed-s": "f1a9",
    	"sym-aed": "f1aa",
    	"sym-aeon-s": "f1ab",
    	"sym-aeon": "f1ac",
    	"sym-aep-s": "f1ad",
    	"sym-aep": "f1ae",
    	"sym-aergo-s": "f1af",
    	"sym-aergo": "f1b0",
    	"sym-agi-s": "f1b1",
    	"sym-agi": "f1b2",
    	"sym-agld-s": "f1b3",
    	"sym-agld": "f1b4",
    	"sym-aid-s": "f1b5",
    	"sym-aid": "f1b6",
    	"sym-aion-s": "f1b7",
    	"sym-aion": "f1b8",
    	"sym-air-s": "f1b9",
    	"sym-air": "f1ba",
    	"sym-akro-s": "f1bb",
    	"sym-akro": "f1bc",
    	"sym-akt-s": "f1bd",
    	"sym-akt": "f1be",
    	"sym-alcx-s": "f1bf",
    	"sym-alcx": "f1c0",
    	"sym-aleph-s": "f1c1",
    	"sym-aleph": "f1c2",
    	"sym-algo-s": "f1c3",
    	"sym-algo": "f1c4",
    	"sym-ali-s": "f1c5",
    	"sym-ali": "f1c6",
    	"sym-alice-s": "f1c7",
    	"sym-alice": "f1c8",
    	"sym-alpha-s": "f1c9",
    	"sym-alpha": "f1ca",
    	"sym-amb-s": "f1cb",
    	"sym-amb": "f1cc",
    	"sym-amlt-s": "f1cd",
    	"sym-amlt": "f1ce",
    	"sym-amp-s": "f1cf",
    	"sym-amp": "f1d0",
    	"sym-ampl-s": "f1d1",
    	"sym-ampl": "f1d2",
    	"sym-anc-s": "f1d3",
    	"sym-anc": "f1d4",
    	"sym-anct-s": "f1d5",
    	"sym-anct": "f1d6",
    	"sym-ankr-s": "f1d7",
    	"sym-ankr": "f1d8",
    	"sym-ant-s": "f1d9",
    	"sym-ant": "f1da",
    	"sym-ape-s": "f1db",
    	"sym-ape": "f1dc",
    	"sym-api3-s": "f1dd",
    	"sym-api3": "f1de",
    	"sym-apis-s": "f1df",
    	"sym-apis": "f1e0",
    	"sym-appc-s": "f1e1",
    	"sym-appc": "f1e2",
    	"sym-aptos-s": "f1e3",
    	"sym-aptos": "f1e4",
    	"sym-ar-s": "f1e5",
    	"sym-ar": "f1e6",
    	"sym-arbi-s": "f1e7",
    	"sym-arbi": "f1e8",
    	"sym-ardr-s": "f1e9",
    	"sym-ardr": "f1ea",
    	"sym-ark-s": "f1eb",
    	"sym-ark": "f1ec",
    	"sym-arn-s": "f1ed",
    	"sym-arn": "f1ee",
    	"sym-arpa-s": "f1ef",
    	"sym-arpa": "f1f0",
    	"sym-art-s": "f1f1",
    	"sym-art": "f1f2",
    	"sym-aspt-s": "f1f3",
    	"sym-aspt": "f1f4",
    	"sym-ast-s": "f1f5",
    	"sym-ast": "f1f6",
    	"sym-astr-s": "f1f7",
    	"sym-astr": "f1f8",
    	"sym-at-s": "f1f9",
    	"sym-at": "f1fa",
    	"sym-atlas-s": "f1fb",
    	"sym-atlas": "f1fc",
    	"sym-atm-s": "f1fd",
    	"sym-atm": "f1fe",
    	"sym-atom-s": "f1ff",
    	"sym-atom": "f200",
    	"sym-atp-s": "f201",
    	"sym-atp": "f202",
    	"sym-atri-s": "f203",
    	"sym-atri": "f204",
    	"sym-auction-s": "f205",
    	"sym-auction": "f206",
    	"sym-aud-s": "f207",
    	"sym-aud": "f208",
    	"sym-audio-s": "f209",
    	"sym-audio": "f20a",
    	"sym-aup-s": "f20b",
    	"sym-aup": "f20c",
    	"sym-aury-s": "f20d",
    	"sym-aury": "f20e",
    	"sym-ausd-s": "f20f",
    	"sym-ausd": "f210",
    	"sym-auto-s": "f211",
    	"sym-auto": "f212",
    	"sym-ava-s": "f213",
    	"sym-ava": "f214",
    	"sym-avax-s": "f215",
    	"sym-avax": "f216",
    	"sym-avt-s": "f217",
    	"sym-avt": "f218",
    	"sym-axl-s": "f219",
    	"sym-axl": "f21a",
    	"sym-axpr-s": "f21b",
    	"sym-axpr": "f21c",
    	"sym-axs-s": "f21d",
    	"sym-axs": "f21e",
    	"sym-b": "f21f",
    	"sym-b0-s": "f220",
    	"sym-b0": "f221",
    	"sym-b2g-s": "f222",
    	"sym-b2g": "f223",
    	"sym-bab-s": "f224",
    	"sym-bab": "f225",
    	"sym-badger-s": "f226",
    	"sym-badger": "f227",
    	"sym-bake-s": "f228",
    	"sym-bake": "f229",
    	"sym-bal-s": "f22a",
    	"sym-bal": "f22b",
    	"sym-banca-s": "f22c",
    	"sym-banca": "f22d",
    	"sym-band-s": "f22e",
    	"sym-band": "f22f",
    	"sym-bat-s": "f230",
    	"sym-bat": "f231",
    	"sym-bay-s": "f232",
    	"sym-bay": "f233",
    	"sym-bbc-s": "f234",
    	"sym-bbc": "f235",
    	"sym-bcc-s": "f236",
    	"sym-bcc": "f237",
    	"sym-bcd-s": "f238",
    	"sym-bcd": "f239",
    	"sym-bch-s": "f23a",
    	"sym-bch": "f23b",
    	"sym-bci-s": "f23c",
    	"sym-bci": "f23d",
    	"sym-bcn-s": "f23e",
    	"sym-bcn": "f23f",
    	"sym-bcpt-s": "f240",
    	"sym-bcpt": "f241",
    	"sym-bcu-s": "f242",
    	"sym-bcu": "f243",
    	"sym-bcv-s": "f244",
    	"sym-bcv": "f245",
    	"sym-bcy-s": "f246",
    	"sym-bcy": "f247",
    	"sym-bdg-s": "f248",
    	"sym-bdg": "f249",
    	"sym-beam-s": "f24a",
    	"sym-beam": "f24b",
    	"sym-beet-s": "f24c",
    	"sym-beet": "f24d",
    	"sym-bel-s": "f24e",
    	"sym-bel": "f24f",
    	"sym-bela-s": "f250",
    	"sym-bela": "f251",
    	"sym-berry-s": "f252",
    	"sym-berry": "f253",
    	"sym-beta-s": "f254",
    	"sym-beta": "f255",
    	"sym-betr-s": "f256",
    	"sym-betr": "f257",
    	"sym-bez-s": "f258",
    	"sym-bez": "f259",
    	"sym-bft-s": "f25a",
    	"sym-bft": "f25b",
    	"sym-bfx-s": "f25c",
    	"sym-bfx": "f25d",
    	"sym-bhd-s": "f25e",
    	"sym-bhd": "f25f",
    	"sym-bht-s": "f260",
    	"sym-bht": "f261",
    	"sym-bico-s": "f262",
    	"sym-bico": "f263",
    	"sym-bit-s": "f264",
    	"sym-bit": "f265",
    	"sym-bitb-s": "f266",
    	"sym-bitb": "f267",
    	"sym-bix-s": "f268",
    	"sym-bix": "f269",
    	"sym-bk-s": "f26a",
    	"sym-bk": "f26b",
    	"sym-bkx-s": "f26c",
    	"sym-bkx": "f26d",
    	"sym-blk-s": "f26e",
    	"sym-blk": "f26f",
    	"sym-block-s": "f270",
    	"sym-block": "f271",
    	"sym-blok-s": "f272",
    	"sym-blok": "f273",
    	"sym-blt-s": "f274",
    	"sym-blt": "f275",
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
    	"sym-orbs-s": "f705",
    	"sym-orbs": "f706",
    	"sym-orca-s": "f707",
    	"sym-orca": "f708",
    	"sym-orme-s": "f709",
    	"sym-orme": "f70a",
    	"sym-orn-s": "f70b",
    	"sym-orn": "f70c",
    	"sym-ors-s": "f70d",
    	"sym-ors": "f70e",
    	"sym-osmo-s": "f70f",
    	"sym-osmo": "f710",
    	"sym-ost-s": "f711",
    	"sym-ost": "f712",
    	"sym-otn-s": "f713",
    	"sym-otn": "f714",
    	"sym-oxt-s": "f715",
    	"sym-oxt": "f716",
    	"sym-oxy-s": "f717",
    	"sym-oxy": "f718",
    	"sym-pai-s": "f719",
    	"sym-pai": "f71a",
    	"sym-pal-s": "f71b",
    	"sym-pal": "f71c",
    	"sym-paper-s": "f71d",
    	"sym-paper": "f71e",
    	"sym-para-s": "f71f",
    	"sym-para": "f720",
    	"sym-part-s": "f721",
    	"sym-part": "f722",
    	"sym-pasc-s": "f723",
    	"sym-pasc": "f724",
    	"sym-pat-s": "f725",
    	"sym-pat": "f726",
    	"sym-pax-s": "f727",
    	"sym-pax": "f728",
    	"sym-paxg-s": "f729",
    	"sym-paxg": "f72a",
    	"sym-pay-s": "f72b",
    	"sym-pay": "f72c",
    	"sym-pbt-s": "f72d",
    	"sym-pbt": "f72e",
    	"sym-pcl-s": "f72f",
    	"sym-pcl": "f730",
    	"sym-pcx-s": "f731",
    	"sym-pcx": "f732",
    	"sym-pdex-s": "f733",
    	"sym-pdex": "f734",
    	"sym-people-s": "f735",
    	"sym-people": "f736",
    	"sym-perl-s": "f737",
    	"sym-perl": "f738",
    	"sym-perp-s": "f739",
    	"sym-perp": "f73a",
    	"sym-pha-s": "f73b",
    	"sym-pha": "f73c",
    	"sym-phb-s": "f73d",
    	"sym-phb": "f73e",
    	"sym-php-s": "f73f",
    	"sym-php": "f740",
    	"sym-phx-s": "f741",
    	"sym-phx": "f742",
    	"sym-pi-s": "f743",
    	"sym-pi": "f744",
    	"sym-pica-s": "f745",
    	"sym-pica": "f746",
    	"sym-pink-s": "f747",
    	"sym-pink": "f748",
    	"sym-pivx-s": "f749",
    	"sym-pivx": "f74a",
    	"sym-pkt-s": "f74b",
    	"sym-pkt": "f74c",
    	"sym-pl-s": "f74d",
    	"sym-pl": "f74e",
    	"sym-pla-s": "f74f",
    	"sym-pla": "f750",
    	"sym-plbt-s": "f751",
    	"sym-plbt": "f752",
    	"sym-plm-s": "f753",
    	"sym-plm": "f754",
    	"sym-pln-s": "f755",
    	"sym-pln": "f756",
    	"sym-plr-s": "f757",
    	"sym-plr": "f758",
    	"sym-ply-s": "f759",
    	"sym-ply": "f75a",
    	"sym-pma-s": "f75b",
    	"sym-pma": "f75c",
    	"sym-png-s": "f75d",
    	"sym-png": "f75e",
    	"sym-pnt-s": "f75f",
    	"sym-pnt": "f760",
    	"sym-poa-s": "f761",
    	"sym-poa": "f762",
    	"sym-poe-s": "f763",
    	"sym-poe": "f764",
    	"sym-polis-s": "f765",
    	"sym-polis": "f766",
    	"sym-pols-s": "f767",
    	"sym-pols": "f768",
    	"sym-poly-s": "f769",
    	"sym-poly": "f76a",
    	"sym-pond-s": "f76b",
    	"sym-pond": "f76c",
    	"sym-pot-s": "f76d",
    	"sym-pot": "f76e",
    	"sym-powr-s": "f76f",
    	"sym-powr": "f770",
    	"sym-ppc-s": "f771",
    	"sym-ppc": "f772",
    	"sym-ppt-s": "f773",
    	"sym-ppt": "f774",
    	"sym-pra-s": "f775",
    	"sym-pra": "f776",
    	"sym-pre-s": "f777",
    	"sym-pre": "f778",
    	"sym-prg-s": "f779",
    	"sym-prg": "f77a",
    	"sym-pro-s": "f77b",
    	"sym-pro": "f77c",
    	"sym-prq-s": "f77d",
    	"sym-prq": "f77e",
    	"sym-pst-s": "f77f",
    	"sym-pst": "f780",
    	"sym-pstake-s": "f781",
    	"sym-pstake": "f782",
    	"sym-pton-s": "f783",
    	"sym-pton": "f784",
    	"sym-pundix-s": "f785",
    	"sym-pundix": "f786",
    	"sym-pvt-s": "f787",
    	"sym-pvt": "f788",
    	"sym-pxg-s": "f789",
    	"sym-pxg": "f78a",
    	"sym-pyr-s": "f78b",
    	"sym-pyr": "f78c",
    	"sym-qash-s": "f78d",
    	"sym-qash": "f78e",
    	"sym-qau-s": "f78f",
    	"sym-qau": "f790",
    	"sym-qc-s": "f791",
    	"sym-qc": "f792",
    	"sym-qi-s": "f793",
    	"sym-qi": "f794",
    	"sym-qi2-s": "f795",
    	"sym-qi2": "f796",
    	"sym-qkc-s": "f797",
    	"sym-qkc": "f798",
    	"sym-qlc-s": "f799",
    	"sym-qlc": "f79a",
    	"sym-qnt-s": "f79b",
    	"sym-qnt": "f79c",
    	"sym-qntu-s": "f79d",
    	"sym-qntu": "f79e",
    	"sym-qo-s": "f79f",
    	"sym-qo": "f7a0",
    	"sym-qrdo-s": "f7a1",
    	"sym-qrdo": "f7a2",
    	"sym-qrl-s": "f7a3",
    	"sym-qrl": "f7a4",
    	"sym-qsp-s": "f7a5",
    	"sym-qsp": "f7a6",
    	"sym-qtum-s": "f7a7",
    	"sym-qtum": "f7a8",
    	"sym-quick-s": "f7a9",
    	"sym-quick": "f7aa",
    	"sym-qun-s": "f7ab",
    	"sym-qun": "f7ac",
    	"sym-r-s": "f7ad",
    	"sym-r": "f7ae",
    	"sym-rad-s": "f7af",
    	"sym-rad": "f7b0",
    	"sym-radar-s": "f7b1",
    	"sym-radar": "f7b2",
    	"sym-rads-s": "f7b3",
    	"sym-rads": "f7b4",
    	"sym-ramp-s": "f7b5",
    	"sym-ramp": "f7b6",
    	"sym-rare-s": "f7b7",
    	"sym-rare": "f7b8",
    	"sym-rari-s": "f7b9",
    	"sym-rari": "f7ba",
    	"sym-rating-s": "f7bb",
    	"sym-rating": "f7bc",
    	"sym-ray-s": "f7bd",
    	"sym-ray": "f7be",
    	"sym-rb-s": "f7bf",
    	"sym-rb": "f7c0",
    	"sym-rbc-s": "f7c1",
    	"sym-rbc": "f7c2",
    	"sym-rblx-s": "f7c3",
    	"sym-rblx": "f7c4",
    	"sym-rbn-s": "f7c5",
    	"sym-rbn": "f7c6",
    	"sym-rbtc-s": "f7c7",
    	"sym-rbtc": "f7c8",
    	"sym-rby-s": "f7c9",
    	"sym-rby": "f7ca",
    	"sym-rcn-s": "f7cb",
    	"sym-rcn": "f7cc",
    	"sym-rdd-s": "f7cd",
    	"sym-rdd": "f7ce",
    	"sym-rdn-s": "f7cf",
    	"sym-rdn": "f7d0",
    	"sym-real-s": "f7d1",
    	"sym-real": "f7d2",
    	"sym-reef-s": "f7d3",
    	"sym-reef": "f7d4",
    	"sym-rem-s": "f7d5",
    	"sym-rem": "f7d6",
    	"sym-ren-s": "f7d7",
    	"sym-ren": "f7d8",
    	"sym-rep-s": "f7d9",
    	"sym-rep": "f7da",
    	"sym-repv2-s": "f7db",
    	"sym-repv2": "f7dc",
    	"sym-req-s": "f7dd",
    	"sym-req": "f7de",
    	"sym-rev-s": "f7df",
    	"sym-rev": "f7e0",
    	"sym-revv-s": "f7e1",
    	"sym-revv": "f7e2",
    	"sym-rfox-s": "f7e3",
    	"sym-rfox": "f7e4",
    	"sym-rfr-s": "f7e5",
    	"sym-rfr": "f7e6",
    	"sym-ric-s": "f7e7",
    	"sym-ric": "f7e8",
    	"sym-rif-s": "f7e9",
    	"sym-rif": "f7ea",
    	"sym-ring-s": "f7eb",
    	"sym-ring": "f7ec",
    	"sym-rlc-s": "f7ed",
    	"sym-rlc": "f7ee",
    	"sym-rly-s": "f7ef",
    	"sym-rly": "f7f0",
    	"sym-rmrk-s": "f7f1",
    	"sym-rmrk": "f7f2",
    	"sym-rndr-s": "f7f3",
    	"sym-rndr": "f7f4",
    	"sym-rntb-s": "f7f5",
    	"sym-rntb": "f7f6",
    	"sym-ron-s": "f7f7",
    	"sym-ron": "f7f8",
    	"sym-rook-s": "f7f9",
    	"sym-rook": "f7fa",
    	"sym-rose-s": "f7fb",
    	"sym-rose": "f7fc",
    	"sym-rox-s": "f7fd",
    	"sym-rox": "f7fe",
    	"sym-rp-s": "f7ff",
    	"sym-rp": "f800",
    	"sym-rpl-s": "f801",
    	"sym-rpl": "f802",
    	"sym-rpx-s": "f803",
    	"sym-rpx": "f804",
    	"sym-rsr-s": "f805",
    	"sym-rsr": "f806",
    	"sym-rsv-s": "f807",
    	"sym-rsv": "f808",
    	"sym-rty-s": "f809",
    	"sym-rty": "f80a",
    	"sym-rub-s": "f80b",
    	"sym-rub": "f80c",
    	"sym-ruff-s": "f80d",
    	"sym-ruff": "f80e",
    	"sym-rune-s": "f80f",
    	"sym-rune": "f810",
    	"sym-rvn-s": "f811",
    	"sym-rvn": "f812",
    	"sym-rvr-s": "f813",
    	"sym-rvr": "f814",
    	"sym-rvt-s": "f815",
    	"sym-rvt": "f816",
    	"sym-sai-s": "f817",
    	"sym-sai": "f818",
    	"sym-salt-s": "f819",
    	"sym-salt": "f81a",
    	"sym-samo-s": "f81b",
    	"sym-samo": "f81c",
    	"sym-san-s": "f81d",
    	"sym-san": "f81e",
    	"sym-sand-s": "f81f",
    	"sym-sand": "f820",
    	"sym-sbd-s": "f821",
    	"sym-sbd": "f822",
    	"sym-sbr-s": "f823",
    	"sym-sbr": "f824",
    	"sym-sc-s": "f825",
    	"sym-sc": "f826",
    	"sym-scc-s": "f827",
    	"sym-scc": "f828",
    	"sym-scrt-s": "f829",
    	"sym-scrt": "f82a",
    	"sym-sdc-s": "f82b",
    	"sym-sdc": "f82c",
    	"sym-sdn-s": "f82d",
    	"sym-sdn": "f82e",
    	"sym-seele-s": "f82f",
    	"sym-seele": "f830",
    	"sym-sek-s": "f831",
    	"sym-sek": "f832",
    	"sym-sen-s": "f833",
    	"sym-sen": "f834",
    	"sym-sent-s": "f835",
    	"sym-sent": "f836",
    	"sym-sero-s": "f837",
    	"sym-sero": "f838",
    	"sym-sexc-s": "f839",
    	"sym-sexc": "f83a",
    	"sym-sfp-s": "f83b",
    	"sym-sfp": "f83c",
    	"sym-sgb-s": "f83d",
    	"sym-sgb": "f83e",
    	"sym-sgc-s": "f83f",
    	"sym-sgc": "f840",
    	"sym-sgd-s": "f841",
    	"sym-sgd": "f842",
    	"sym-sgn-s": "f843",
    	"sym-sgn": "f844",
    	"sym-sgu-s": "f845",
    	"sym-sgu": "f846",
    	"sym-shib-s": "f847",
    	"sym-shib": "f848",
    	"sym-shift-s": "f849",
    	"sym-shift": "f84a",
    	"sym-ship-s": "f84b",
    	"sym-ship": "f84c",
    	"sym-shping-s": "f84d",
    	"sym-shping": "f84e",
    	"sym-si-s": "f84f",
    	"sym-si": "f850",
    	"sym-sib-s": "f851",
    	"sym-sib": "f852",
    	"sym-sil-s": "f853",
    	"sym-sil": "f854",
    	"sym-six-s": "f855",
    	"sym-six": "f856",
    	"sym-sjcx-s": "f857",
    	"sym-sjcx": "f858",
    	"sym-skl-s": "f859",
    	"sym-skl": "f85a",
    	"sym-skm-s": "f85b",
    	"sym-skm": "f85c",
    	"sym-sku-s": "f85d",
    	"sym-sku": "f85e",
    	"sym-sky-s": "f85f",
    	"sym-sky": "f860",
    	"sym-slp-s": "f861",
    	"sym-slp": "f862",
    	"sym-slr-s": "f863",
    	"sym-slr": "f864",
    	"sym-sls-s": "f865",
    	"sym-sls": "f866",
    	"sym-slt-s": "f867",
    	"sym-slt": "f868",
    	"sym-slv-s": "f869",
    	"sym-slv": "f86a",
    	"sym-smart-s": "f86b",
    	"sym-smart": "f86c",
    	"sym-smn-s": "f86d",
    	"sym-smn": "f86e",
    	"sym-smt-s": "f86f",
    	"sym-smt": "f870",
    	"sym-snc-s": "f871",
    	"sym-snc": "f872",
    	"sym-snet-s": "f873",
    	"sym-snet": "f874",
    	"sym-sngls-s": "f875",
    	"sym-sngls": "f876",
    	"sym-snm-s": "f877",
    	"sym-snm": "f878",
    	"sym-snt-s": "f879",
    	"sym-snt": "f87a",
    	"sym-snx-s": "f87b",
    	"sym-snx": "f87c",
    	"sym-soc-s": "f87d",
    	"sym-soc": "f87e",
    	"sym-socks-s": "f87f",
    	"sym-socks": "f880",
    	"sym-sol-s": "f881",
    	"sym-sol": "f882",
    	"sym-solid-s": "f883",
    	"sym-solid": "f884",
    	"sym-solo-s": "f885",
    	"sym-solo": "f886",
    	"sym-solve-s": "f887",
    	"sym-solve": "f888",
    	"sym-sos-s": "f889",
    	"sym-sos": "f88a",
    	"sym-soul-s": "f88b",
    	"sym-soul": "f88c",
    	"sym-sp-s": "f88d",
    	"sym-sp": "f88e",
    	"sym-sparta-s": "f88f",
    	"sym-sparta": "f890",
    	"sym-spc-s": "f891",
    	"sym-spc": "f892",
    	"sym-spd-s": "f893",
    	"sym-spd": "f894",
    	"sym-spell-s": "f895",
    	"sym-spell": "f896",
    	"sym-sphr-s": "f897",
    	"sym-sphr": "f898",
    	"sym-sphtx-s": "f899",
    	"sym-sphtx": "f89a",
    	"sym-spnd-s": "f89b",
    	"sym-spnd": "f89c",
    	"sym-spnk-s": "f89d",
    	"sym-spnk": "f89e",
    	"sym-srm-s": "f89f",
    	"sym-srm": "f8a0",
    	"sym-srn-s": "f8a1",
    	"sym-srn": "f8a2",
    	"sym-ssp-s": "f8a3",
    	"sym-ssp": "f8a4",
    	"sym-ssv-s": "f8a5",
    	"sym-ssv": "f8a6",
    	"sym-stacs-s": "f8a7",
    	"sym-stacs": "f8a8",
    	"sym-step-s": "f8a9",
    	"sym-step": "f8aa",
    	"sym-stg-s": "f8ab",
    	"sym-stg": "f8ac",
    	"sym-stmx-s": "f8ad",
    	"sym-stmx": "f8ae",
    	"sym-storm-s": "f8af",
    	"sym-storm": "f8b0",
    	"sym-stpt-s": "f8b1",
    	"sym-stpt": "f8b2",
    	"sym-stq-s": "f8b3",
    	"sym-stq": "f8b4",
    	"sym-str-s": "f8b5",
    	"sym-str": "f8b6",
    	"sym-strat-s": "f8b7",
    	"sym-strat": "f8b8",
    	"sym-strax-s": "f8b9",
    	"sym-strax": "f8ba",
    	"sym-strk-s": "f8bb",
    	"sym-strk": "f8bc",
    	"sym-strong-s": "f8bd",
    	"sym-strong": "f8be",
    	"sym-stx-s": "f8bf",
    	"sym-stx": "f8c0",
    	"sym-sub-s": "f8c1",
    	"sym-sub": "f8c2",
    	"sym-sui-s": "f8c3",
    	"sym-sui": "f8c4",
    	"sym-sun-s": "f8c5",
    	"sym-sun": "f8c6",
    	"sym-super-s": "f8c7",
    	"sym-super": "f8c8",
    	"sym-susd-s": "f8c9",
    	"sym-susd": "f8ca",
    	"sym-sushi-s": "f8cb",
    	"sym-sushi": "f8cc",
    	"sym-swftc-s": "f8cd",
    	"sym-swftc": "f8ce",
    	"sym-swm-s": "f8cf",
    	"sym-swm": "f8d0",
    	"sym-swrv-s": "f8d1",
    	"sym-swrv": "f8d2",
    	"sym-swt-s": "f8d3",
    	"sym-swt": "f8d4",
    	"sym-swth-s": "f8d5",
    	"sym-swth": "f8d6",
    	"sym-sxp-s": "f8d7",
    	"sym-sxp": "f8d8",
    	"sym-syn-s": "f8d9",
    	"sym-syn": "f8da",
    	"sym-sys-s": "f8db",
    	"sym-sys": "f8dc",
    	"sym-t-s": "f8dd",
    	"sym-t": "f8de",
    	"sym-taas-s": "f8df",
    	"sym-taas": "f8e0",
    	"sym-tau-s": "f8e1",
    	"sym-tau": "f8e2",
    	"sym-tbtc-s": "f8e3",
    	"sym-tbtc": "f8e4",
    	"sym-tct-s": "f8e5",
    	"sym-tct": "f8e6",
    	"sym-teer-s": "f8e7",
    	"sym-teer": "f8e8",
    	"sym-tel-s": "f8e9",
    	"sym-temco-s": "f8ea",
    	"sym-temco": "f8eb",
    	"sym-tfuel-s": "f8ec",
    	"sym-tfuel": "f8ed",
    	"sym-thb-s": "f8ee",
    	"sym-thb": "f8ef",
    	"sym-thc-s": "f8f0",
    	"sym-thc": "f8f1",
    	"sym-theta-s": "f8f2",
    	"sym-theta": "f8f3",
    	"sym-thx-s": "f8f4",
    	"sym-thx": "f8f5",
    	"sym-time-s": "f8f6",
    	"sym-time": "f8f7",
    	"sym-tio-s": "f8f8",
    	"sym-tio": "f8f9",
    	"sym-tix-s": "f8fa",
    	"sym-tix": "f8fb",
    	"sym-tkn-s": "f8fc",
    	"sym-tkn": "f8fd",
    	"sym-tky-s": "f8fe",
    	"sym-tky": "f8ff",
    	"sym-tlm-s": "f900",
    	"sym-tlm": "f901",
    	"sym-tnb-s": "f902",
    	"sym-tnb": "f903",
    	"sym-tnc-s": "f904",
    	"sym-tnc": "f905",
    	"sym-tnt-s": "f906",
    	"sym-tnt": "f907",
    	"sym-toke-s": "f908",
    	"sym-toke": "f909",
    	"sym-tomb-s": "f90a",
    	"sym-tomb": "f90b",
    	"sym-tomo-s": "f90c",
    	"sym-tomo": "f90d",
    	"sym-top-s": "f90e",
    	"sym-top": "f90f",
    	"sym-torn-s": "f910",
    	"sym-torn": "f911",
    	"sym-tower-s": "f912",
    	"sym-tower": "f913",
    	"sym-tpay-s": "f914",
    	"sym-tpay": "f915",
    	"sym-trac-s": "f916",
    	"sym-trac": "f917",
    	"sym-trb-s": "f918",
    	"sym-trb": "f919",
    	"sym-tribe-s": "f91a",
    	"sym-tribe": "f91b",
    	"sym-trig-s": "f91c",
    	"sym-trig": "f91d",
    	"sym-trio-s": "f91e",
    	"sym-trio": "f91f",
    	"sym-troy-s": "f920",
    	"sym-troy": "f921",
    	"sym-trst-s": "f922",
    	"sym-trst": "f923",
    	"sym-tru-s": "f924",
    	"sym-tru": "f925",
    	"sym-true-s": "f926",
    	"sym-true": "f927",
    	"sym-trx-s": "f928",
    	"sym-trx": "f929",
    	"sym-try-s": "f92a",
    	"sym-try": "f92b",
    	"sym-tryb-s": "f92c",
    	"sym-tryb": "f92d",
    	"sym-tt-s": "f92e",
    	"sym-tt": "f92f",
    	"sym-ttc-s": "f930",
    	"sym-ttc": "f931",
    	"sym-ttt-s": "f932",
    	"sym-ttt": "f933",
    	"sym-ttu-s": "f934",
    	"sym-ttu": "f935",
    	"sym-tube-s": "f936",
    	"sym-tube": "f937",
    	"sym-tusd-s": "f938",
    	"sym-tusd": "f939",
    	"sym-tvk-s": "f93a",
    	"sym-tvk": "f93b",
    	"sym-twt-s": "f93c",
    	"sym-twt": "f93d",
    	"sym-uah-s": "f93e",
    	"sym-uah": "f93f",
    	"sym-ubq-s": "f940",
    	"sym-ubq": "f941",
    	"sym-ubt-s": "f942",
    	"sym-ubt": "f943",
    	"sym-uft-s": "f944",
    	"sym-uft": "f945",
    	"sym-ugas-s": "f946",
    	"sym-ugas": "f947",
    	"sym-uip-s": "f948",
    	"sym-uip": "f949",
    	"sym-ukg-s": "f94a",
    	"sym-ukg": "f94b",
    	"sym-uma-s": "f94c",
    	"sym-uma": "f94d",
    	"sym-umami-s": "f94e",
    	"sym-umami": "f94f",
    	"sym-unfi-s": "f950",
    	"sym-unfi": "f951",
    	"sym-uni-s": "f952",
    	"sym-uni": "f953",
    	"sym-unq-s": "f954",
    	"sym-unq": "f955",
    	"sym-up-s": "f956",
    	"sym-up": "f957",
    	"sym-upp-s": "f958",
    	"sym-upp": "f959",
    	"sym-usd-s": "f95a",
    	"sym-usd": "f95b",
    	"sym-usdc-s": "f95c",
    	"sym-usdc": "f95d",
    	"sym-usds-s": "f95e",
    	"sym-usds": "f95f",
    	"sym-usk-s": "f960",
    	"sym-usk": "f961",
    	"sym-ust-s": "f962",
    	"sym-ust": "f963",
    	"sym-utk-s": "f964",
    	"sym-utk": "f965",
    	"sym-utnp-s": "f966",
    	"sym-utnp": "f967",
    	"sym-utt-s": "f968",
    	"sym-utt": "f969",
    	"sym-uuu-s": "f96a",
    	"sym-uuu": "f96b",
    	"sym-ux-s": "f96c",
    	"sym-ux": "f96d",
    	"sym-vader-s": "f96e",
    	"sym-vader": "f96f",
    	"sym-vai-s": "f970",
    	"sym-vai": "f971",
    	"sym-vbk-s": "f972",
    	"sym-vbk": "f973",
    	"sym-vdx-s": "f974",
    	"sym-vdx": "f975",
    	"sym-vee-s": "f976",
    	"sym-vee": "f977",
    	"sym-vemp-s": "f978",
    	"sym-vemp": "f979",
    	"sym-ven-s": "f97a",
    	"sym-ven": "f97b",
    	"sym-veo-s": "f97c",
    	"sym-veo": "f97d",
    	"sym-veri-s": "f97e",
    	"sym-veri": "f97f",
    	"sym-vex-s": "f980",
    	"sym-vex": "f981",
    	"sym-vgx-s": "f982",
    	"sym-vgx": "f983",
    	"sym-via-s": "f984",
    	"sym-via": "f985",
    	"sym-vib-s": "f986",
    	"sym-vib": "f987",
    	"sym-vibe-s": "f988",
    	"sym-vibe": "f989",
    	"sym-vid-s": "f98a",
    	"sym-vid": "f98b",
    	"sym-vidt-s": "f98c",
    	"sym-vidt": "f98d",
    	"sym-vidy-s": "f98e",
    	"sym-vidy": "f98f",
    	"sym-vitae-s": "f990",
    	"sym-vitae": "f991",
    	"sym-vite-s": "f992",
    	"sym-vite": "f993",
    	"sym-vlx-s": "f994",
    	"sym-vlx": "f995",
    	"sym-vox-s": "f996",
    	"sym-vox": "f997",
    	"sym-voxel-s": "f998",
    	"sym-voxel": "f999",
    	"sym-vra-s": "f99a",
    	"sym-vra": "f99b",
    	"sym-vrc-s": "f99c",
    	"sym-vrc": "f99d",
    	"sym-vrm-s": "f99e",
    	"sym-vrm": "f99f",
    	"sym-vsys-s": "f9a0",
    	"sym-vsys": "f9a1",
    	"sym-vtc-s": "f9a2",
    	"sym-vtc": "f9a3",
    	"sym-vtho-s": "f9a4",
    	"sym-vtho": "f9a5",
    	"sym-wabi-s": "f9a6",
    	"sym-wabi": "f9a7",
    	"sym-wan-s": "f9a8",
    	"sym-wan": "f9a9",
    	"sym-waves-s": "f9aa",
    	"sym-waves": "f9ab",
    	"sym-wax-s": "f9ac",
    	"sym-wax": "f9ad",
    	"sym-wbtc-s": "f9ae",
    	"sym-wbtc": "f9af",
    	"sym-wet-s": "f9b0",
    	"sym-wet": "f9b1",
    	"sym-weth-s": "f9b2",
    	"sym-weth": "f9b3",
    	"sym-wib-s": "f9b4",
    	"sym-wib": "f9b5",
    	"sym-wicc-s": "f9b6",
    	"sym-wicc": "f9b7",
    	"sym-win-s": "f9b8",
    	"sym-win": "f9b9",
    	"sym-wing-s": "f9ba",
    	"sym-wing": "f9bb",
    	"sym-wings-s": "f9bc",
    	"sym-wings": "f9bd",
    	"sym-wnxm-s": "f9be",
    	"sym-wnxm": "f9bf",
    	"sym-woo-s": "f9c0",
    	"sym-woo": "f9c1",
    	"sym-wpr-s": "f9c2",
    	"sym-wpr": "f9c3",
    	"sym-wrx-s": "f9c4",
    	"sym-wrx": "f9c5",
    	"sym-wtc-s": "f9c6",
    	"sym-wtc": "f9c7",
    	"sym-wtt-s": "f9c8",
    	"sym-wtt": "f9c9",
    	"sym-wwb-s": "f9ca",
    	"sym-wwb": "f9cb",
    	"sym-wxt-s": "f9cc",
    	"sym-wxt": "f9cd",
    	"sym-xas-s": "f9ce",
    	"sym-xas": "f9cf",
    	"sym-xaur-s": "f9d0",
    	"sym-xaur": "f9d1",
    	"sym-xaut-s": "f9d2",
    	"sym-xaut": "f9d3",
    	"sym-xava-s": "f9d4",
    	"sym-xava": "f9d5",
    	"sym-xbc-s": "f9d6",
    	"sym-xbc": "f9d7",
    	"sym-xcn-s": "f9d8",
    	"sym-xcn": "f9d9",
    	"sym-xcon-s": "f9da",
    	"sym-xcon": "f9db",
    	"sym-xcp-s": "f9dc",
    	"sym-xcp": "f9dd",
    	"sym-xdefi-s": "f9de",
    	"sym-xdefi": "f9df",
    	"sym-xdn-s": "f9e0",
    	"sym-xdn": "f9e1",
    	"sym-xel-s": "f9e2",
    	"sym-xel": "f9e3",
    	"sym-xem-s": "f9e4",
    	"sym-xem": "f9e5",
    	"sym-xes-s": "f9e6",
    	"sym-xes": "f9e7",
    	"sym-xhv-s": "f9e8",
    	"sym-xhv": "f9e9",
    	"sym-xin-s": "f9ea",
    	"sym-xin": "f9eb",
    	"sym-xlm-s": "f9ec",
    	"sym-xlm": "f9ed",
    	"sym-xmc-s": "f9ee",
    	"sym-xmc": "f9ef",
    	"sym-xmr-s": "f9f0",
    	"sym-xmr": "f9f1",
    	"sym-xmx-s": "f9f2",
    	"sym-xmx": "f9f3",
    	"sym-xmy-s": "f9f4",
    	"sym-xmy": "f9f5",
    	"sym-xnk-s": "f9f6",
    	"sym-xnk": "f9f7",
    	"sym-xns-s": "f9f8",
    	"sym-xns": "f9f9",
    	"sym-xor-s": "f9fa",
    	"sym-xor": "f9fb",
    	"sym-xos-s": "f9fc",
    	"sym-xos": "f9fd",
    	"sym-xpm-s": "f9fe",
    	"sym-xpm": "f9ff",
    	"sym-xpr-s": "fa00",
    	"sym-xpr": "fa01",
    	"sym-xrc-s": "fa02",
    	"sym-xrc": "fa03",
    	"sym-xrp-s": "fa04",
    	"sym-xrp": "fa05",
    	"sym-xrpx-s": "fa06",
    	"sym-xrpx": "fa07",
    	"sym-xrt-s": "fa08",
    	"sym-xrt": "fa09",
    	"sym-xst-s": "fa0a",
    	"sym-xst": "fa0b",
    	"sym-xtp-s": "fa0c",
    	"sym-xtp": "fa0d",
    	"sym-xtz-s": "fa0e",
    	"sym-xtz": "fa0f",
    	"sym-xtzdown-s": "fa10",
    	"sym-xtzdown": "fa11",
    	"sym-xvc-s": "fa12",
    	"sym-xvc": "fa13",
    	"sym-xvg-s": "fa14",
    	"sym-xvg": "fa15",
    	"sym-xvs-s": "fa16",
    	"sym-xvs": "fa17",
    	"sym-xwc-s": "fa18",
    	"sym-xwc": "fa19",
    	"sym-xyo-s": "fa1a",
    	"sym-xyo": "fa1b",
    	"sym-xzc-s": "fa1c",
    	"sym-xzc": "fa1d",
    	"sym-yam-s": "fa1e",
    	"sym-yam": "fa1f",
    	"sym-yee-s": "fa20",
    	"sym-yee": "fa21",
    	"sym-yeed-s": "fa22",
    	"sym-yeed": "fa23",
    	"sym-yfi-s": "fa24",
    	"sym-yfi": "fa25",
    	"sym-yfii-s": "fa26",
    	"sym-yfii": "fa27",
    	"sym-ygg-s": "fa28",
    	"sym-ygg": "fa29",
    	"sym-yoyow-s": "fa2a",
    	"sym-yoyow": "fa2b",
    	"sym-zar-s": "fa2c",
    	"sym-zar": "fa2d",
    	"sym-zcl-s": "fa2e",
    	"sym-zcl": "fa2f",
    	"sym-zcn-s": "fa30",
    	"sym-zcn": "fa31",
    	"sym-zco-s": "fa32",
    	"sym-zco": "fa33",
    	"sym-zec-s": "fa34",
    	"sym-zec": "fa35",
    	"sym-zen-s": "fa36",
    	"sym-zen": "fa37",
    	"sym-zil-s": "fa38",
    	"sym-zil": "fa39",
    	"sym-zks-s": "fa3a",
    	"sym-zks": "fa3b",
    	"sym-zla-s": "fa3c",
    	"sym-zla": "fa3d",
    	"sym-zlk": "fa3e",
    	"sym-zondo-s": "fa3f",
    	"sym-zondo": "fa40",
    	"sym-zpr-s": "fa41",
    	"sym-zpr": "fa42",
    	"sym-zpt-s": "fa43",
    	"sym-zpt": "fa44",
    	"sym-zrc-s": "fa45",
    	"sym-zrc": "fa46",
    	"sym-zrx-s": "fa47",
    	"sym-zrx": "fa48",
    	"sym-zsc-s": "fa49",
    	"sym-zsc": "fa4a",
    	"sym-ztg-s": "fa4b",
    	"sym-ztg": "fa4c",
    	"ustc-s": "fa4d",
    	ustc: ustc,
    	"cur-anct": "f1d6",
    	"cur-anct-s": "f1d5",
    	"cur-aud": "f208",
    	"cur-aud-s": "f207",
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
    	"cur-pax": "f728",
    	"cur-pax-s": "f727",
    	"cur-php": "f740",
    	"cur-php-s": "f73f",
    	"cur-pln": "f756",
    	"cur-pln-s": "f755",
    	"cur-qash": "f78e",
    	"cur-qash-s": "f78d",
    	"cur-rub": "f80c",
    	"cur-rur": "f80c",
    	"cur-rub-s": "f80b",
    	"cur-rur-s": "f80b",
    	"sym-steem": "f822",
    	"sym-steem-s": "f821",
    	"sym-xsc": "f826",
    	"sym-xsc-s": "f825",
    	"cur-sgd": "f842",
    	"cur-sgd-s": "f841",
    	"sym-storj": "f858",
    	"sym-storj-s": "f857",
    	"sym-tel": "f8e0",
    	"cur-trx": "f929",
    	"cur-trx-s": "f928",
    	"cur-tusd": "f939",
    	"cur-tusd-s": "f938",
    	"cur-usd": "f95b",
    	"cur-usd-s": "f95a",
    	"cur-usdc": "f95d",
    	"cur-usdc-s": "f95c",
    	"sym-vet": "f97b",
    	"sym-vet-s": "f97a",
    	"sym-waxp": "f9ad",
    	"sym-waxp-s": "f9ac",
    	"cur-xlm": "f9ed",
    	"cur-xlm-s": "f9ec",
    	"cur-xmr": "f9f1",
    	"cur-xmr-s": "f9f0",
    	"cur-xrp": "fa05",
    	"cur-xrp-s": "fa04",
    	"cur-zar": "fa2d",
    	"cur-zar-s": "fa2c",
    	"exc-binance-us": "f10a",
    	"exc-binance-us-s": "f109",
    	"exc-mexbt": "f120",
    	"exc-mexbt-s": "f11f",
    	"exc-coinbase-pro": "f12e",
    	"exc-gdax": "f12e",
    	"exc-coinbase-pro-s": "f12d",
    	"exc-gdax-s": "f12d",
    	"exc-quadriga": "f158",
    	"exc-quadriga-s": "f157",
    	"cur-crc": "f337",
    	"cur-crc-s": "f336",
    	"cur-lak": "f5b6",
    	"cur-lak-s": "f5b5",
    	"cur-sek": "f832",
    	"cur-sek-s": "f831",
    	"cur-thb": "f8ef",
    	"cur-thb-s": "f8ee",
    	"cur-try": "f92b",
    	"cur-try-s": "f92a",
    	"cur-uah": "f93f",
    	"cur-uah-s": "f93e",
    	"exc-ftx": "f46e",
    	"exc-ftx-s": "f46d",
    	"exc-ftx-us": "f46e",
    	"exc-ftx-us-s": "f46d",
    	"sym-cgld": "f2e3",
    	"sym-cgld-s": "f2e2",
    	"exc-uniswap-v2": "f953",
    	"exc-uniswap-v2-s": "f952",
    	"sym-kshib": "f848",
    	"sym-kshib-s": "f847",
    	"sym-easy-s": "f3d2",
    	"sym-srare": "f7b8",
    	"sym-srare-s": "f7b7",
    	"sym-ape.2": "f1dc",
    	"sym-ape.2-s": "f1db"
    };

    var _default = "";
    var d = "";
    var sat = "";
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
    	sat: sat,
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
