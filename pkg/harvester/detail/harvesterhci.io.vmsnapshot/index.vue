<script>
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import Loading from '@shell/components/Loading';
import CruResource from '@shell/components/CruResource';
import { Checkbox } from '@components/Form/Checkbox';
import LabelValue from '@shell/components/LabelValue';
import { allHash } from '@shell/utils/promise';
import CreateEditView from '@shell/mixins/create-edit-view';
import VM_MIXIN from '../../mixins/harvester-vm';
import { HCI } from '../../types';
import CpuMemory from '../../edit/kubevirt.io.virtualmachine/VirtualMachineCpuMemory';

import OverviewKeypairs from '../kubevirt.io.virtualmachine/VirtualMachineTabs/VirtualMachineKeypairs';
import Volume from '../../edit/kubevirt.io.virtualmachine/VirtualMachineVolume';
import Network from '../../edit/kubevirt.io.virtualmachine/VirtualMachineNetwork';
import CloudConfig from '../../edit/kubevirt.io.virtualmachine/VirtualMachineCloudConfig';
const UNDEFINED = 'n/a';

export default {
  name: 'VMSnapshotDetail',

  components: {
    Volume,
    Network,
    CruResource,
    Tabbed,
    Loading,
    LabelValue,
    Tab,
    CloudConfig,
    Checkbox,
    CpuMemory,
    OverviewKeypairs,
  },

  mixins: [CreateEditView, VM_MIXIN],

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    },
    mode: {
      type:     String,
      required: true,
    },
  },

  async fetch() {
    await allHash({ allImages: this.$store.dispatch('harvester/findAll', { type: HCI.IMAGE }) });
  },

  data() {
    return { vm: null };
  },

  computed: {
    name() {
      return this.value?.metadata?.name || UNDEFINED;
    },

    hostname() {
      return this?.spec?.template?.spec?.hostname;
    },

    imageName() {
      const imageList = this.$store.getters['harvester/all'](HCI.IMAGE) || [];

      const image = imageList.find( (I) => this.imageId === I.id);

      return image?.spec?.displayName || '-';
    },

    disks() {
      const disks = this?.spec?.template?.spec?.domain?.devices?.disks || [];

      return disks.filter((disk) => {
        return !!disk.bootOrder;
      }).sort((a, b) => {
        if (a.bootOrder < b.bootOrder) {
          return -1;
        }

        return 1;
      });
    },

    cdroms() {
      const disks = this?.spec?.template?.spec?.domain?.devices?.disks || [];

      return disks.filter((disk) => {
        return !!disk.cdrom;
      });
    },
  },

  methods: {
    getDeviceType(o) {
      if (o.disk) {
        return 'Disk';
      } else {
        return 'CD-ROM';
      }
    },
    isEmpty(o) {
      return o !== undefined && Object.keys(o).length === 0;
    },
    onTabChanged({ tab }) {
      if (tab.name === 'advanced') {
        this.$refs.yamlEditor?.refresh();
      }
    }
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <CruResource
    v-else
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :apply-hooks="applyHooks"
    @error="e=>errors=e"
  >
    <Tabbed
      v-if="spec"
      :side-tabs="true"
      @changed="onTabChanged"
    >
      <Tab
        name="Basics"
        :label="t('harvester.virtualMachine.detail.tabs.basics')"
      >
        <div class="row mb-10">
          <div class="col span-6">
            <LabelValue
              :name="t('harvester.virtualMachine.detail.details.name')"
              :value="name"
            />
          </div>

          <div class="col span-6">
            <LabelValue
              :name="t('harvester.fields.image')"
              :value="imageName"
            />
          </div>
        </div>

        <div class="row mb-10">
          <div class="col span-6">
            <LabelValue
              :name="t('harvester.virtualMachine.detail.details.hostname')"
              :value="hostname"
            />
          </div>

          <div class="col span-6">
            <LabelValue
              :name="t('harvester.virtualMachine.input.MachineType')"
              :value="machineType"
            />
          </div>
        </div>

        <CpuMemory
          :cpu="cpu"
          :mode="mode"
          :memory="memory"
          :max-cpu="maxCpu"
          :max-memory="maxMemory"
          :enable-hot-plug="cpuMemoryHotplugEnabled"
        />

        <div class="row mb-10">
          <div class="col span-6">
            <LabelValue :name="t('harvester.virtualMachine.detail.details.bootOrder')">
              <template #value>
                <div>
                  <ul>
                    <li
                      v-for="(disk, i) in disks"
                      :key="i"
                    >
                      {{ disk.bootOrder }}. {{ disk.name }} ({{ getDeviceType(disk) }})
                    </li>
                  </ul>
                </div>
              </template>
            </LabelValue>
          </div>
          <div class="col span-6">
            <LabelValue :name="t('harvester.virtualMachine.detail.details.CDROMs')">
              <template #value>
                <div>
                  <ul v-if="cdroms.length > 0">
                    <li
                      v-for="(rom, i) in cdroms"
                      :key="i"
                    >
                      {{ rom.name }}
                    </li>
                  </ul>
                  <span v-else>
                    {{ t("harvester.virtualMachine.detail.notAvailable") }}
                  </span>
                </div>
              </template>
            </LabelValue>
          </div>
        </div>
      </Tab>

      <Tab
        name="volume"
        :label="t('harvester.tab.volume')"
        :weight="-1"
      >
        <Volume
          v-model:value="diskRows"
          :mode="mode"
        />
      </Tab>

      <Tab
        name="network"
        :label="t('harvester.tab.network')"
        :weight="-2"
      >
        <Network
          v-model:value="networkRows"
          :mode="mode"
        />
      </Tab>

      <Tab
        name="keypairs"
        :label="t('harvester.virtualMachine.detail.tabs.keypairs')"
        class="bordered-table"
        :weight="-3"
      >
        <OverviewKeypairs
          v-if="vm"
          v-model:value="vm"
        />
      </Tab>

      <Tab
        name="advanced"
        :label="t('harvester.tab.advanced')"
        :weight="-4"
      >
        <CloudConfig
          ref="yamlEditor"
          :user-script="userScript"
          :mode="mode"
          :network-script="networkScript"
        />

        <div class="spacer"></div>
        <Checkbox
          v-model:value="installUSBTablet"
          :mode="mode"
          class="check"
          type="checkbox"
          :label="t('harvester.virtualMachine.enableUsb')"
        />
      </Tab>
    </Tabbed>
  </CruResource>
</template>
