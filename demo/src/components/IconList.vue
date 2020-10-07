<template>
  <div class="container">
    <h1>Beacons</h1>
    <p>
      Crypto icon font by
      <a href="https://cryptowat.ch" target="_blank" rel="noopener noreferrer"
        >Cryptowatch</a
      >
    </p>
    <input
      v-model="query"
      type="text"
      :placeholder="'Search ' + Object.entries(filtered).length + ' icons'"
      autofocus
    />
    <div class="filters">
      <div v-for="(val, filter) in filters" :key="filter.id" class="filter">
        <input type="checkbox" :id="filter" v-model="filters[filter]" />
        <label
          :for="filter"
          v-text="
            filter + ' (' + beaconKeys.filter(filterFun[filter]).length + ')'
          "
        />
      </div>
    </div>
    <div v-if="filteredBeacons.length" class="beacons-flex">
      <template v-for="(beacon, i) in filteredBeacons" :key="beacon.id">
        <div v-if="groups[beacon]" class="beacon-container">
          <div class="name" v-text="names[beacon]" />
          <div class="icon">
            <i class="beacon" :class="beacon" />
            <div class="text">
              <span class="prefix">{{ beacon.slice(0, 4) }}</span
              ><span class="main">{{ syms[beacon] }}</span
              ><span
                v-if="beacon.slice(beacon.length - 2, beacon.length) === '-s'"
                class="postfix"
                >-s</span
              >
            </div>
          </div>
          <div class="icon">
            <i class="beacon" :class="filteredBeacons[i + 1]" />
            <div class="text">
              <span class="prefix">{{
                filteredBeacons[i + 1].slice(0, 4)
              }}</span
              ><span class="main">{{ syms[filteredBeacons[i + 1]] }}</span
              ><span
                v-if="
                  filteredBeacons[i + 1].slice(
                    filteredBeacons[i + 1].length - 2,
                    filteredBeacons[i + 1].length
                  ) === '-s'
                "
                class="postfix"
                >-s</span
              >
            </div>
          </div>
        </div>
      </template>
    </div>
    <div v-else>No results</div>
  </div>
</template>

<script>
import beacons from '../assets/beacons.json'
import beaconNames from '../assets/beaconNames.json'
import { computed, reactive, toRefs } from 'vue'

export default {
  name: 'IconList',
  setup () {
    const state = reactive({
      query: '',
      filters: { exchanges: true, symbols: true, currencies: true }
    })

    const filterFun = {
      exchanges: key => key.slice(0, 4) === 'exc-',
      symbols: key => key.slice(0, 4) === 'sym-',
      currencies: key => key.slice(0, 4) === 'cur-'
    }

    const beaconKeys = Object.keys(beacons)

    const filtered = computed(() => {
      const filterKeys = Object.keys(filterFun).filter(
        key => state.filters[key]
      )
      return beaconKeys.filter(item => {
        return filterKeys.some(key => {
          return filterFun[key](item)
        })
      })
    })

    const filteredBeacons = computed(() => {
      return filtered.value.filter(key => {
        const query = state.query.toLowerCase()
        const sym = syms[key]
        const name = beaconNames[sym].toLowerCase()
        return sym.includes(query) || name.includes(query)
      })
    })

    const getMiddlePart = beacon => {
      let middle = beacon.slice(4)
      const len = beacon.length
      const end = beacon.slice(len - 2, len)
      if (end === '-s') {
        middle = middle.slice(0, -2)
      }
      return middle
    }

    const groupTest = beacon => {
      const i = beaconKeys.indexOf(beacon)
      if (i >= beaconKeys.length - 1) return false
      const next = beaconKeys[i + 1]
      const len = next.length
      const start = next.slice(0, -2)
      const end = next.slice(len - 2)
      const isGroup = start === beacon && end === '-s'
      return !!isGroup
    }

    const syms = {}
    const names = {}
    const groups = {}
    beaconKeys.forEach(beacon => {
      const sym = getMiddlePart(beacon)
      const name = beaconNames[sym] ? beaconNames[sym] : sym
      const group = groupTest(beacon)
      Object.assign(syms, { [beacon]: sym })
      Object.assign(names, { [beacon]: name })
      Object.assign(groups, { [beacon]: group })
    })

    return {
      ...toRefs(state),
      filtered,
      filteredBeacons,
      filterFun,
      beaconKeys,
      syms,
      names,
      groups
    }
  }
}
</script>
