<template>
  <div class="container">
    <h1>Beacons</h1>
    <p>
      Crypto icon pack by
      <a href="https://cryptowat.ch" target="_blank" rel="noopener noreferrer"
        >Cryptowatch</a
      >
    </p>
    <input
      v-model="query"
      type="text"
      :placeholder="'Search ' + Object.entries(filtered).length + ' icons'"
    />
    <div class="filters">
      <div v-for="(val, filter) in filters" :key="filter.id" class="filter">
        <input type="checkbox" :id="filter" v-model="filters[filter]" />
        <label
          :for="filter"
          v-text="
            filter +
              ' (' +
              Object.keys(beacons).filter(filterFun[filter]).length +
              ')'
          "
        />
      </div>
    </div>
    <div v-if="filteredBeacons.length" class="beacons-flex">
      <template v-for="(beacon, i) in filteredBeacons">
        <div
          v-if="groupTest(beacon, i)"
          :key="beacon.id"
          class="beacon-container"
        >
          <div class="name" v-text="getName(beacon)" />
          <div class="icon">
            <i class="beacon" :class="beacon" />
            <div class="text">
              <span class="prefix">{{ beacon.slice(0, 4) }}</span
              ><span class="main">{{ getMiddlePart(beacon) }}</span
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
              ><span class="main">{{
                getMiddlePart(filteredBeacons[i + 1])
              }}</span
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

export default {
  name: 'IconList',
  data () {
    return {
      query: '',
      filters: { exchanges: true, symbols: true, currencies: true }
    }
  },
  computed: {
    filtered () {
      const filterKeys = Object.keys(this.filters).filter(
        key => this.filters[key]
      )
      return Object.keys(beacons).filter(item => {
        return filterKeys.some(key => {
          return this.filterFun[key](item)
        })
      })
    },
    filteredBeacons () {
      return this.filtered.filter(key => {
        const query = this.query.toLowerCase()
        const sym = this.getMiddlePart(key)
        const name = beaconNames[sym].toLowerCase()
        return sym.includes(query) || name.includes(query)
      })
    }
  },
  created () {
    this.beacons = beacons
    this.beaconNames = beaconNames
    this.filterFun = {
      exchanges: key => key.slice(0, 4) === 'exc-',
      symbols: key => key.slice(0, 4) === 'sym-',
      currencies: key => key.slice(0, 4) === 'cur-'
    }
  },
  methods: {
    getMiddlePart (beacon) {
      let middle = beacon.slice(4)
      const len = beacon.length
      const end = beacon.slice(len - 2, len)
      if (end === '-s') {
        middle = middle.slice(0, -2)
      }
      return middle
    },
    getName (beacon) {
      const sym = this.getMiddlePart(beacon)
      return beaconNames[sym] ? beaconNames[sym] : sym
    },
    groupTest (beacon, i) {
      const { filteredBeacons } = this
      if (i >= filteredBeacons.length - 1) return false
      const next = filteredBeacons[i + 1]
      const len = next.length
      const start = next.slice(0, -2)
      const end = next.slice(len - 2)
      if (start === beacon && end === '-s') {
        return true
      }
    }
  }
}
</script>
