<template>
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
        rel="noopener noreferrer"
        >GitHub</a
      >)
    </p>
    <input
      v-model.trim="state.query"
      type="text"
      :placeholder="`Search ${nIcons} icons`"
      autofocus
    />
    <div class="filters">
      <div
        v-for="(val, filter) in state.filters"
        :key="filter.id"
        class="filter"
      >
        <input type="checkbox" :id="filter" v-model="state.filters[filter]" />
        <label :for="filter" v-text="`${filter} (${iconsPerFilter[filter]})`" />
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
              ><span v-if="hasPostfix(beacon)" class="postfix">-s</span>
            </div>
          </div>
          <div class="icon">
            <i class="beacon" :class="filteredBeacons[i + 1]" />
            <div class="text">
              <span class="prefix">{{
                filteredBeacons[i + 1].slice(0, 4)
              }}</span
              ><span class="main">{{ syms[filteredBeacons[i + 1]] }}</span
              ><span v-if="hasPostfix(filteredBeacons[i + 1])" class="postfix"
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

<script setup>
import beacons from '../assets/beacons.json'
import beaconNames from '../assets/beaconNames.json'
import { computed, reactive } from 'vue'

export const beaconKeys = Object.keys(beacons)

export const state = reactive({
  query: '',
  filters: { exchanges: true, symbols: true, currencies: true }
})

export const filterFun = {
  exchanges: key => key.slice(0, 4) === 'exc-',
  symbols: key => key.slice(0, 4) === 'sym-',
  currencies: key => key.slice(0, 4) === 'cur-'
}

export const iconsPerFilter = {}
Object.keys(filterFun).forEach(filter => {
  Object.assign(iconsPerFilter, {
    [filter]: beaconKeys.filter(filterFun[filter]).length
  })
})

export const filtered = computed(() => {
  const filterKeys = Object.keys(filterFun).filter(key => state.filters[key])
  return beaconKeys.filter(item => {
    return filterKeys.some(key => {
      return filterFun[key](item)
    })
  })
})

export const nIcons = computed(() => Object.entries(filtered.value).length)

export const filteredBeacons = computed(() => {
  return filtered.value.filter(key => {
    const query = state.query.toLowerCase()
    const sym = syms[key]
    const name = beaconNames[sym].toLowerCase()
    return sym.includes(query) || name.includes(query)
  })
})

const getMiddlePart = beacon => {
  let middle = beacon.slice(4)
  if (hasPostfix(beacon)) {
    middle = middle.slice(0, -2)
  }
  return middle
}

const groupTest = beacon => {
  const i = beaconKeys.indexOf(beacon)
  if (i >= beaconKeys.length - 1) return false
  const nextBeacon = beaconKeys[i + 1]
  const start = nextBeacon.slice(0, -2)
  const isGroup = start === beacon && hasPostfix(nextBeacon)
  return !!isGroup
}

export const hasPostfix = beacon => beacon.slice(beacon.length - 2) === '-s'

export const syms = {}
export const names = {}
export const groups = {}
beaconKeys.forEach(beacon => {
  const sym = getMiddlePart(beacon)
  const name = beaconNames[sym] ? beaconNames[sym] : sym
  const group = groupTest(beacon)
  Object.assign(syms, { [beacon]: sym })
  Object.assign(names, { [beacon]: name })
  Object.assign(groups, { [beacon]: group })
})
</script>
