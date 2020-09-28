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
      <div
        v-for="beacon in filteredBeacons"
        :key="beacon.id"
        class="beacon-container"
      >
        <i class="beacon" :class="beacon" />
        <div class="text">
          <span class="prefix">{{ beacon.split("-")[0] }}-</span
          ><span class="main">{{ beacon.split("-")[1] }}</span
          ><span v-if="beacon.split('-').length > 2" class="postfix"
            >-{{ beacon.split("-")[2] }}</span
          >
        </div>
      </div>
    </div>
    <div v-else>No results</div>
  </div>
</template>

<script>
import beacons from '../../../dist/beacons.json'

export default {
  name: 'IconList',
  data () {
    return {
      query: '',
      filters: { Currencies: true, Exchanges: true, Symbols: true }
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
      return this.filtered.filter(key =>
        key.split('-')[1].includes(this.query.toLowerCase())
      )
    }
  },
  created () {
    this.groups = ['Currencies', 'Exchanges', 'Symbols']
    this.beacons = beacons
    this.filterFun = {
      Currencies: key => key.split('-')[0] === 'cur',
      Exchanges: key => key.split('-')[0] === 'exc',
      Symbols: key => key.split('-')[0] === 'sym'
    }
  }
}
</script>
