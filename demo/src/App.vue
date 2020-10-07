<template>
  <IconList/>
</template>

<script>
import IconList from './components/IconList.vue'

export default {
  name: 'App',
  components: {
    IconList
  }
}
</script>

<style lang="scss">
@import '../../dist/beacons.css';
@import './assets/style.scss';
</style>
