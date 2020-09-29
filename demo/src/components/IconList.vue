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
        <label :for="filter" v-text="filter" />
      </div>
    </div>
    <div v-if="filteredBeacons.length" class="beacons-flex">
      <template v-for="(beacon, i) in filteredBeacons">
        <div
          v-if="groupTest(beacon, i)"
          :key="beacon.id"
          class="beacon-container"
        >
          <div
            class="name"
            v-text="
              beaconNames[beacon.split('-')[1]]
                ? beaconNames[beacon.split('-')[1]]
                : beacon.split('-')[1]
            "
          />
          <div class="icon">
            <i class="beacon" :class="beacon" />
            <div class="text">
              <span class="prefix">{{ beacon.split("-")[0] }}-</span
              ><span class="main">{{ beacon.split("-")[1] }}</span
              ><span v-if="beacon.split('-').length > 2" class="postfix"
                >-{{ beacon.split("-")[2] }}</span
              >
            </div>
          </div>
          <div class="icon">
            <i class="beacon" :class="filteredBeacons[i + 1]" />
            <div class="text">
              <!-- <div>{{ beaconNames[filteredBeacons[i + 1].split("-")[1]] }}</div> -->
              <span class="prefix"
                >{{ filteredBeacons[i + 1].split("-")[0] }}-</span
              ><span class="main">{{
                filteredBeacons[i + 1].split("-")[1]
              }}</span
              ><span
                v-if="filteredBeacons[i + 1].split('-').length > 2"
                class="postfix"
                >-{{ filteredBeacons[i + 1].split("-")[2] }}</span
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
import beacons from '../../../dist/beacons.json'
import beaconNames from '../assets/beaconNames.json'

export default {
  name: 'IconList',
  data () {
    return {
      query: '',
      filters: { currencies: true, exchanges: true, symbols: true }
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
      return this.filtered
        .filter(key => {
          const query = this.query.toLowerCase()
          let sym = key.slice(4)
          const len = key.length
          const end = key.slice(len - 2, len)
          if (end === '-s') {
            sym = sym.slice(0, -2)
          }
          const name = beaconNames[sym].toLowerCase()
          return sym.includes(query) || name.includes(query)
        })
        .sort()
    }
  },
  created () {
    this.groups = ['currencies', 'exchanges', 'symbols']
    this.beacons = beacons
    this.beaconNames = beaconNames
    this.filterFun = {
      currencies: key => key.split('-')[0] === 'cur',
      exchanges: key => key.split('-')[0] === 'exc',
      symbols: key => key.split('-')[0] === 'sym'
    }
  },
  methods: {
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
