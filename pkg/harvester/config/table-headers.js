/**
 * Harvester
 */
import { DESCRIPTION } from '@shell/config/table-headers';

// image
export const IMAGE_DOWNLOAD_SIZE = {
  name:     'downloadedBytes',
  labelKey: 'tableHeaders.size',
  value:    'downSize',
  sort:     'status.size',
};

export const IMAGE_VIRTUAL_SIZE = {
  name:     'virtualSize',
  labelKey: 'harvester.tableHeaders.virtualSize',
  value:    'virtualSize',
  sort:     'status.virtualSize',
};

export const IMAGE_PROGRESS = {
  name:      'Uploaded',
  labelKey:  'tableHeaders.progress',
  value:     'status.progress',
  sort:      'status.progress',
  formatter: 'ImagePercentageBar',
};

// SSH keys
export const FINGERPRINT = {
  name:     'Fingerprint',
  labelKey: 'tableHeaders.fingerprint',
  value:    'status.fingerPrint',
};

// The column of target volume on snapshot list page
export const SNAPSHOT_TARGET_VOLUME = {
  name:      'TargetVolume',
  labelKey:  'harvester.tableHeaders.snapshotTargetVolume',
  value:     'spec.source.persistentVolumeClaimName',
  sort:      'spec.source.persistentVolumeClaimName',
  formatter: 'SnapshotTargetVolume',
};

// The column of cron expression volume on VM schedules list page
export const VM_SCHEDULE_CRON = {
  name:      'CronExpression',
  labelKey:  'harvester.tableHeaders.cronExpression',
  value:     'spec.cron',
  align:     'center',
  sort:      'spec.cron',
  formatter: 'HarvesterCronExpression',
};

// The column of retain on VM schedules list page
export const VM_SCHEDULE_RETAIN = {
  name:     'Retain',
  labelKey: 'harvester.tableHeaders.retain',
  value:    'spec.retain',
  sort:     'spec.retain',
  align:    'center',
};

// The column of maxFailure on VM schedules list page
export const VM_SCHEDULE_MAX_FAILURE = {
  name:     'MaxFailure',
  labelKey: 'harvester.tableHeaders.maxFailure',
  value:    'spec.maxFailure',
  sort:     'spec.maxFailure',
  align:    'center',
};

// The column of type on VM schedules list page
export const VM_SCHEDULE_TYPE = {
  name:     'Type',
  labelKey: 'harvester.tableHeaders.scheduleType',
  value:    'spec.vmbackup.type',
  sort:     'spec.vmbackup.type',
  align:    'center',
};

// The MACHINE_POOLS column in Virtualization Management list page
export const MACHINE_POOLS = {
  name:     'summary',
  labelKey: 'tableHeaders.machines',
  sort:     false,
  search:   false,
  value:    'nodes.length',
  align:    'center',
  width:    100,
};

// The STORAGE_CLASS column in VM image list page
export const IMAGE_STORAGE_CLASS = {
  name:     'imageStorageClass',
  labelKey: 'harvester.tableHeaders.storageClass',
  sort:     'imageStorageClass',
  value:    'imageStorageClass',
  align:    'left',
  width:    150,
};

export const HARVESTER_DESCRIPTION = {
  ...DESCRIPTION,
  width: 150,
};

// The CIDR_BLOCK column in VPC list page
export const CIDR_BLOCK = {
  name:     'cidrBlock',
  labelKey: 'harvester.subnet.cidrBlock.label',
  sort:     'cidrBlock',
  value:    'spec.cidrBlock',
  align:    'left',
};

// The Protocol column in VPC list page
export const PROTOCOL = {
  name:     'protocol',
  labelKey: 'harvester.subnet.protocol.label',
  sort:     'protocol',
  value:    'spec.protocol',
  align:    'left',
};

// The Provider column in VPC list page
export const PROVIDER = {
  name:     'provider',
  labelKey: 'harvester.subnet.provider.label',
  sort:     'provider',
  value:    'spec.provider',
  align:    'left',
};
