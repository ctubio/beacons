<template>
  <div>
    <h1>Beacons</h1>
    <div v-for="(value, key) in beacons" :key="value.id">
      <div>{{ key }} {{ value }}</div>
      <div class="beacon" :class="key"></div>
    </div>
  </div>
</template>

<script>
import beacons from '../../../dist/beacons.json'

export default {
  name: 'IconList',
  created () {
    this.beacons = beacons
  }
}
</script>

<style scoped lang="scss"></style>
