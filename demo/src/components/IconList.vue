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
          v-if="
            i < filteredBeacons.length - 1 &&
              beacon.split('-')[1] === filteredBeacons[i + 1].split('-')[1]
          "
          :key="beacon.id"
          class="beacon-container"
        >
          <i class="beacon" :class="beacon" />
          <div class="text">
            <div>{{ beaconNames[beacon.split("-")[1]] }}</div>
            <span class="prefix">{{ beacon.split("-")[0] }}-</span
            ><span class="main">{{ beacon.split("-")[1] }}</span
            ><span v-if="beacon.split('-').length > 2" class="postfix"
              >-{{ beacon.split("-")[2] }}</span
            >
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
          const sym = key.split('-')[1]
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
  }
}
</script>
