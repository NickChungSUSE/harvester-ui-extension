<script>
import ResourceTable from '@shell/components/ResourceTable';
import { Banner } from '@components/Banner';
import { defaultTableSortGenerationFn } from '@shell/components/ResourceTable.vue';
import FilterLabel from '../components/FilterLabel';
import { HCI as HCI_ANNOTATIONS } from '../config/labels-annotations';
import { isInternalStorageClass } from '../utils/storage-class';

export default {
  name: 'ListHarvesterImage',

  components: {
    ResourceTable,
    Banner,
    FilterLabel
  },

  props: {
    schema: {
      type:     Object,
      required: true,
    },
    rows: {
      type:     Array,
      required: true,
    },
  },

  data() {
    return {
      searchLabels: [],
      filterRows:   []
    };
  },

  computed: {
    uploadingImages() {
      return this.$store.getters['harvester-common/uploadingImages'] || [];
    },
  },

  methods: {
    changeRows(filterRows, searchLabels) {
      this['filterRows'] = filterRows;
      this['searchLabels'] = searchLabels;
    },

    sortGenerationFn() {
      let base = defaultTableSortGenerationFn(this.schema, this.$store);

      this.searchLabels.map((label) => {
        base += label.key;
        base += label.value;
      });

      return base;
    },

    isInternalStorageClass(row) {
      const name = row?.spec?.targetStorageClassName ||
                   row?.metadata?.annotations?.[HCI_ANNOTATIONS.STORAGE_CLASS];

      return isInternalStorageClass(name);
    },
  }
};
</script>

<template>
  <div>
    <Banner
      v-if="uploadingImages.length > 0"
      color="warning"
      :label="t('harvester.image.warning.uploading', {count: uploadingImages.length} )"
    />
    <ResourceTable
      v-bind="$attrs"
      :rows="filterRows"
      :schema="schema"
      :sort-generation-fn="sortGenerationFn"
      key-field="_key"
    >
      <template #more-header-middle>
        <FilterLabel
          ref="filterLabel"
          :rows="rows"
          @changeRows="changeRows"
        />
      </template>
      <template #col:name="{row}">
        <td>
          <span>
            <router-link
              v-if="row?.detailLocation"
              :to="row.detailLocation"
            >
              {{ row.nameDisplay }}
              <i
                v-if="row.isEncrypted"
                class="icon icon-lock"
              />
              <i
                v-if="row.isImportedImage"
                v-clean-tooltip="t('harvester.image.tooltip.imported')"
                class="icon icon-info"
              />
            </router-link>
            <span v-else>
              {{ row.nameDisplay }}
            </span>
          </span>
        </td>
      </template>
    </ResourceTable>
  </div>
</template>
