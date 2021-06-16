<script>
  import beacons from "../src/assets/beacons.json";
  import beaconNames from "../src/assets/beaconNames.json";

  const hasPostfix = (beacon) => beacon.slice(beacon.length - 2) === "-s";

  const getMiddlePart = (beacon) => {
    const middle = beacon.slice(4);
    return hasPostfix(beacon) ? middle.slice(0, -2) : middle;
  };

  const exclude = ["d", "default", "_default"];

  const beaconKeys = Object.keys(beacons).filter(
    (beacon) => !exclude.includes(getMiddlePart(beacon))
  );

  let query = "";

  const filtered = beaconKeys.filter((beacon) => !hasPostfix(beacon));

  $: filteredBeacons = filtered.filter((key) => {
    const q = query.toLowerCase();
    const sym = syms[key];
    const name = beaconNames[sym].toLowerCase();
    return sym.includes(q) || name.includes(q);
  });

  const groupTest = (beacon) => {
    let group = false;
    const postfix = hasPostfix(beacon);
    const b = postfix ? beacon.slice(0, -2) : beacon + "-s";
    if (beaconKeys.includes(b)) group = true;
    return group;
  };

  const syms = {};
  const names = {};
  const groups = {};
  beaconKeys.forEach((beacon) => {
    const sym = getMiddlePart(beacon);
    const name = beaconNames[sym] ? beaconNames[sym] : sym;
    const group = groupTest(beacon);
    Object.assign(syms, { [beacon]: sym });
    Object.assign(names, { [beacon]: name });
    Object.assign(groups, { [beacon]: group });
  });

  // console.log(Object.keys(groups).filter((beacon) => !groups[beacon]));
</script>

<div class="container">
  <h1>Beacons</h1>
  <p>
    Crypto icon font by
    <a href="https://cryptowat.ch" target="_blank" rel="noopener noreferrer"
      >Cryptowatch</a
    >
    (<a
      href="https://github.com/cryptowatch/beacons"
      target="_blank"
      rel="noopener noreferrer">GitHub</a
    >)
  </p>
  <input
    type="text"
    bind:value={query}
    placeholder={`Search ${beaconKeys.length} icons`}
    spellcheck="false"
  />
  <div class="beacons-flex">
    {#each filteredBeacons as beacon}
      {#if groups[beacon]}
        <div class="beacon-container">
          <div class="name">{names[beacon]}</div>
          <div class="icon">
            <i class={`beacon-${beacon}`} />
            <div class="text">
              <span class="prefix">{beacon.slice(0, 4)}</span><span class="main"
                >{syms[beacon]}</span
              >
            </div>
          </div>
          <div class="icon">
            <i class={`beacon-${beacon}-s`} />
            <div class="text">
              <span class="prefix">{beacon.slice(0, 4)}</span><span class="main"
                >{syms[beacon]}</span
              ><span class="postfix">-s</span>
            </div>
          </div>
        </div>
      {:else}
        <div class="beacon-container">
          <div class="name">{names[beacon]}</div>
          <div class="icon">
            {#if beaconKeys.includes(beacon)}
              <i class={`beacon-${beacon}`} />
              <div class="text">
                <span class="prefix">{beacon.slice(0, 4)}</span><span
                  class="main">{syms[beacon]}</span
                >
              </div>
            {/if}
          </div>
          <div class="icon">
            {#if beaconKeys.includes(beacon + "s")}
              <i class={`beacon-${beacon}-s`} />
              <div class="text">
                <span class="prefix">{beacon.slice(0, 4)}</span><span
                  class="main">{syms[beacon]}</span
                ><span class="postfix">-s</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {:else}
      <div>No results.</div>
    {/each}
  </div>
</div>

<style type="text/scss">
  .container {
    max-width: 960px;
    margin: 0 auto;
    padding: 16px;
    input[type="text"] {
      font-family: "Iosevka Custom Web", monospace;
      width: 100%;
      background-color: transparent;
      color: var(--text);
      padding: 4px 8px;
      border: 1px solid var(--border);
      font-size: 16px;
      max-width: 300px;
      margin-bottom: 16px;
      &:focus {
        outline: 0;
        border-color: var(--text);
      }
      &::placeholder {
        color: var(--weak);
      }
    }
    .beacons-flex {
      display: grid;
      grid-gap: 8px;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      &::after {
        content: "";
        flex: auto;
      }
      .beacon-container {
        display: grid;
        grid-template-columns: 1fr;
        grid-gap: 8px;
        padding: 8px;
        background-color: var(--bg-light);
        .name {
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .icon {
          display: flex;
          align-items: center;
          min-height: 40px;
          i {
            margin-right: 8px;
            height: 40px;
            width: 40px;
            font-size: 40px;
            color: var(--text);
          }
          .text {
            color: var(--weak);
            text-align: left;
            .main {
              color: var(--text);
            }
          }
        }
      }
    }
  }
</style>
